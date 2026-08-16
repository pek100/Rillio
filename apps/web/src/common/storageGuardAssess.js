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

module.exports = { assessStorage, DISK_FLOOR_BYTES };
