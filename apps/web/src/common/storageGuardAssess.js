// The storage guard's pure decision (see storageGuard.ts for the story and
// the wiring). CommonJS so the jest suite can exercise it directly, like
// routesRegexp.
//
// Inputs:
//   sentinelPresent - localStorage answered the healthy-boot sentinel key
//   userDataPresent - localStorage answered any known user-data key
//   diskBytes       - size of the Local Storage leveldb on disk per the shell,
//                     or null when there is no disk oracle (browser build,
//                     probe failure)
// Verdicts:
//   'ok'         - storage answers match a booted install; run normally
//   'first-run'  - storage empty and the disk agrees (or cannot disagree)
//   'unreadable' - storage answers EMPTY but the disk holds real data: this
//                  session must not boot the core (it would persist a default
//                  profile over data it merely cannot see)

// A Local Storage leveldb this large cannot belong to a never-booted install.
// A genuinely fresh profile has no database at all (0 bytes); the 2026-08-16
// incident database was ~130KB. Sized well above leveldb boilerplate (LOG
// text + MANIFEST) so a healthy-but-nearly-empty install can never trip it.
const DISK_FLOOR_BYTES = 16 * 1024;

const assessStorage = (sentinelPresent, userDataPresent, diskBytes) => {
    if (sentinelPresent || userDataPresent) return 'ok';
    if (typeof diskBytes === 'number' && diskBytes >= DISK_FLOOR_BYTES) return 'unreadable';
    return 'first-run';
};

// How many automatic restarts one dead-storage streak may spend before the
// manual refusal screen takes over. Each restart is a fresh roll of the
// WebView2 coin flip, so a few silent retries clear most streaks without the
// user ever seeing the refusal screen; a streak that survives them needs a
// human (and the manual Restart button keeps counting into the same budget).
const MAX_STORAGE_AUTO_RETRIES = 3;

// Pause before each automatic restart. Observed live (2026-08-17, runtime
// 151.0.4129.86): rapid back-to-back restarts tend to SHARE the broken
// storage fate, while launches spaced further apart come up healthy - so the
// re-roll is worth more the longer we wait. Escalates per attempt; the window
// stays hidden the whole time (index.html hands the reveal to the guard), so
// the pause is invisible rather than a flicker of open-and-close windows.
const AUTO_RETRY_DELAYS_MS = [2000, 4000, 6000];
const autoRetryDelayMs = (retryCount) => {
    const i = typeof retryCount === 'number' && Number.isInteger(retryCount) && retryCount >= 0 ? retryCount : 0;
    return AUTO_RETRY_DELAYS_MS[Math.min(i, AUTO_RETRY_DELAYS_MS.length - 1)];
};

// What to do about an 'unreadable' verdict, given how many restarts this
// streak has already spent. The count comes from a SHELL-side file
// (storage_retry_count): localStorage is dead in exactly the sessions that
// need to count, so the counter can never live there.
//
// Inputs:
//   retryCount - restarts already attempted, or null when there is no counter
//                (browser build, or the shell probe failed)
//   canRestart - a shell restart is actually available
// Returns:
//   'auto-retry' - restart silently behind an interim screen
//   'refuse'     - show the manual refusal screen
//
// No shell or no counter means refuse: an auto-retry that cannot restart does
// nothing, and one that cannot count its attempts loops forever.
const decideUnreadableAction = (retryCount, canRestart) => {
    if (!canRestart) return 'refuse';
    if (typeof retryCount !== 'number' || !Number.isInteger(retryCount) || retryCount < 0) return 'refuse';
    return retryCount < MAX_STORAGE_AUTO_RETRIES ? 'auto-retry' : 'refuse';
};

module.exports = { assessStorage, DISK_FLOOR_BYTES, decideUnreadableAction, MAX_STORAGE_AUTO_RETRIES, autoRetryDelayMs, AUTO_RETRY_DELAYS_MS };
