// Copyright (C) 2017-2026 Smart code 203358507

/**
 * Content-type poster fallback glyphs, shared by every card that renders a poster
 * placeholder (MetaItem, the Player "up next" card, ...). Keyed by the ICON_FOR_TYPE
 * alias map values in common/CONSTANTS, with Film as the ultimate fallback (unknown
 * types resolve through 'other' -> 'movies' -> Film).
 */

import {
    Film, Tv, RadioTower, MonitorPlay, BookOpen, Gamepad2, Music, VenetianMask, Radio, Podcast,
    type LucideIcon,
} from 'lucide-react';

const { ICON_FOR_TYPE } = require('rillio/common/CONSTANTS');

export const TYPE_ICON: Record<string, LucideIcon> = {
    movies: Film,
    series: Tv,
    channels: RadioTower,
    tv: MonitorPlay,
    ic_book: BookOpen,
    ic_games: Gamepad2,
    ic_music: Music,
    ic_adult: VenetianMask,
    ic_radio: Radio,
    ic_podcast: Podcast,
};

export function iconForType(type: string | undefined): LucideIcon {
    const key = ICON_FOR_TYPE.has(type) ? ICON_FOR_TYPE.get(type) : ICON_FOR_TYPE.get('other');
    return TYPE_ICON[key as string] ?? Film;
}
