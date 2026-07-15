// Copyright (C) 2017-2026 Smart code 203358507
//
// Adapted from Harbor (https://github.com/harborstremio/harbor),
// MIT License, Copyright (c) Harbor contributors.

// Chapter-name heuristics: when a file carries chapters actually NAMED
// "Opening" / "Recap" / "End Credits", those beat any external database - they
// are the encoder telling us exactly where the segment is. Files with only
// numbered chapters ("Chapter 1") classify to nothing and contribute nothing.

import type { SkipKind, SkipSegment } from './types';

// The player bridge reports chapters in milliseconds (like every time value
// that crosses it); this lib runs in seconds like the external APIs.
export type PlayerChapter = { title: string; time: number };

const RECAP_PATTERNS = [/\b(recap|previously)\b/i];
const INTRO_PATTERNS = [/\b(opening|op)\b/i, /\bintro\b/i, /\bopening\s*credits\b/i, /\btheme\s*song\b/i];
const OUTRO_PATTERNS = [/\b(ending|ed)\b/i, /\b(outro|outtro)\b/i, /\bend\s*credits?\b/i, /\bclosing\s*credits?\b/i, /\bcredits?\b/i];

const classify = (title: string): SkipKind | null => {
    if (!title) return null;
    // Recap first: "Previously on..." chapters sometimes also contain "opening".
    for (const pattern of RECAP_PATTERNS) if (pattern.test(title)) return 'recap';
    for (const pattern of INTRO_PATTERNS) if (pattern.test(title)) return 'intro';
    for (const pattern of OUTRO_PATTERNS) if (pattern.test(title)) return 'outro';
    return null;
};

export const chaptersToSegments = (chapters: PlayerChapter[], durationSec: number): SkipSegment[] => {
    if (!Array.isArray(chapters) || chapters.length === 0) return [];
    const sorted = [...chapters].sort((a, b) => a.time - b.time);
    const out: SkipSegment[] = [];
    for (let i = 0; i < sorted.length; i++) {
        const kind = classify(sorted[i].title);
        if (kind === null) continue;
        const startSec = sorted[i].time / 1000;
        // A chapter ends where the next begins; the last one runs to the end of
        // the file (or a 90s guess when the duration is not known yet).
        const next = sorted[i + 1];
        const endSec = next ? next.time / 1000 : (durationSec > 0 ? durationSec : startSec + 90);
        if (endSec <= startSec) continue;
        out.push({ kind, startSec, endSec, source: 'chapters' });
    }
    return out;
};
