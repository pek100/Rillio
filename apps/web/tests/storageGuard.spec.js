// The boot storage guard's decision table (incident 2026-08-16: a WebView2
// session came up with DOM storage unreadable and the app looked wiped while
// the data sat intact on disk - the guard must refuse to boot the core then).

const { assessStorage, DISK_FLOOR_BYTES } = require('../src/common/storageGuardAssess');

describe('storage guard verdicts', () => {
    it('a healthy booted install is ok (sentinel present)', () => {
        expect(assessStorage(true, true, 200 * 1024)).toBe('ok');
        expect(assessStorage(true, false, 200 * 1024)).toBe('ok');
    });

    it('user data without a sentinel is ok (first boot on a build that predates the sentinel)', () => {
        expect(assessStorage(false, true, 200 * 1024)).toBe('ok');
        expect(assessStorage(false, true, null)).toBe('ok');
    });

    it('empty storage with an empty disk is a first run', () => {
        expect(assessStorage(false, false, 0)).toBe('first-run');
        expect(assessStorage(false, false, DISK_FLOOR_BYTES - 1)).toBe('first-run');
    });

    it('empty storage with no disk oracle (browser build) is trusted as a first run', () => {
        expect(assessStorage(false, false, null)).toBe('first-run');
    });

    it('THE INCIDENT: empty storage but a data-bearing database on disk is unreadable', () => {
        expect(assessStorage(false, false, DISK_FLOOR_BYTES)).toBe('unreadable');
        expect(assessStorage(false, false, 130 * 1024)).toBe('unreadable');
    });

    it('leveldb boilerplate alone never blocks a boot', () => {
        // CURRENT + LOCK + LOG + a small MANIFEST on a fresh-but-created db.
        expect(assessStorage(false, false, 4 * 1024)).toBe('first-run');
    });
});
