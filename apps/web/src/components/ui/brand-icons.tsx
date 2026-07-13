// Copyright (C) 2017-2026 Smart code 203358507

/**
 * Brand + badge glyphs that lucide-react does not ship (third-party logos and the
 * HDR badge). Kept as small local inline SVGs so we never force a semantically wrong
 * lucide pick for a recognizable brand mark. Every glyph draws with `currentColor`
 * (same inheritance model as lucide), accepts a `className` for sizing (`size-4`,
 * etc.), and defaults to a 24x24 box so it drops in wherever a lucide icon would.
 */

import React from 'react';

type BrandIconProps = React.SVGProps<SVGSVGElement>;

const base = (props: BrandIconProps) => ({
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: '0 0 24 24',
    width: 24,
    height: 24,
    ...props,
});

export const Facebook = (props: BrandIconProps) => (
    <svg {...base(props)} fill="currentColor">
        <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.09 24 18.1 24 12.07z" />
    </svg>
);

export const Apple = (props: BrandIconProps) => (
    <svg {...base(props)} fill="currentColor">
        <path d="M17.05 12.54c-.03-2.6 2.13-3.85 2.22-3.91-1.21-1.77-3.1-2.02-3.77-2.05-1.6-.16-3.13.94-3.94.94-.81 0-2.07-.92-3.4-.9-1.75.03-3.36 1.02-4.26 2.58-1.82 3.16-.46 7.83 1.3 10.39.86 1.25 1.89 2.66 3.24 2.61 1.3-.05 1.79-.84 3.36-.84 1.57 0 2.01.84 3.39.81 1.4-.02 2.29-1.28 3.15-2.54.99-1.46 1.4-2.87 1.42-2.94-.03-.01-2.72-1.04-2.75-4.14zM14.54 5.11c.72-.87 1.2-2.08 1.07-3.29-1.03.04-2.28.69-3.02 1.56-.66.77-1.24 2-1.09 3.18 1.15.09 2.32-.58 3.04-1.45z" />
    </svg>
);

// Twitter / X. Named XSocial so it never collides with lucide's `X` (close).
export const XSocial = (props: BrandIconProps) => (
    <svg {...base(props)} fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
);

export const Reddit = (props: BrandIconProps) => (
    <svg {...base(props)} fill="currentColor">
        <path d="M12 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 01-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 01.042.52c0 2.694-3.13 4.87-6.988 4.87-3.836 0-6.967-2.176-6.967-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 014.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 01.14-.197.35.35 0 01.238-.042l2.906.617a1.214 1.214 0 011.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 00-.231.094.33.33 0 000 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 00.029-.463.33.33 0 00-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 00-.232-.095z" />
    </svg>
);

export const Discord = (props: BrandIconProps) => (
    <svg {...base(props)} fill="currentColor">
        <path d="M20.317 4.369a19.79 19.79 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.3 12.3 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.055c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.028zM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
);

export const Vlc = (props: BrandIconProps) => (
    <svg {...base(props)} fill="currentColor">
        <path d="M12.084 0c-.29.007-.542.19-.646.47l-.706 1.925a.635.635 0 0 0 .596.86h1.344a.635.635 0 0 0 .596-.86l-.706-1.925A.687.687 0 0 0 12.084 0zM9.94 5.05a.635.635 0 0 0-.596.415l-.94 2.56a.635.635 0 0 0 .596.856h5.998a.635.635 0 0 0 .596-.856l-.94-2.56a.635.635 0 0 0-.596-.415H9.94zm-2.16 5.598a.635.635 0 0 0-.596.415l-2.19 5.965a.635.635 0 0 0 .596.856h12.82a.635.635 0 0 0 .596-.856l-2.19-5.965a.635.635 0 0 0-.596-.415H7.78zM2.49 20.2a.49.49 0 0 0-.49.49v2.82c0 .27.22.49.49.49h19.02a.49.49 0 0 0 .49-.49v-2.82a.49.49 0 0 0-.49-.49H2.49z" />
    </svg>
);

// Trakt: interlocking rings mark, single-color.
export const Trakt = (props: BrandIconProps) => (
    <svg {...base(props)} fill="currentColor">
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 1.5A10.5 10.5 0 0 1 22.5 12 10.5 10.5 0 0 1 12 22.5 10.5 10.5 0 0 1 1.5 12 10.5 10.5 0 0 1 12 1.5zM6.9 6.53a.6.6 0 0 0-.42 1.024l4.658 4.658-4.658 4.658a.6.6 0 1 0 .848.848l5.082-5.082a.6.6 0 0 0 0-.848L7.328 6.706a.6.6 0 0 0-.428-.176zm4.2 0a.6.6 0 0 0-.42 1.024l4.658 4.658-4.658 4.658a.6.6 0 1 0 .848.848l5.082-5.082a.6.6 0 0 0 0-.848l-5.082-5.082a.6.6 0 0 0-.428-.176z" />
    </svg>
);

// IMDb badge: a filled gold chip (currentColor, driven by text-[--color-imdb] at
// the call site) with the dark "IMDb" wordmark, matching the real mark. Wide 2:1
// viewBox so the wordmark reads cleanly; size it via a 2:1 className (e.g. h-8 w-16).
export const Imdb = (props: BrandIconProps) => (
    <svg {...base(props)} viewBox="0 0 64 32" fill="none">
        <rect x="0" y="0" width="64" height="32" rx="6" fill="currentColor" />
        <text
            x="32"
            y="23"
            textAnchor="middle"
            fontFamily="Arial, Helvetica, sans-serif"
            fontSize="19"
            fontWeight={900}
            letterSpacing="-0.5"
            fill="#0A0A0A"
        >IMDb</text>
    </svg>
);

// HDR badge (lucide has no HDR glyph). Outlined + currentColor for theme parity.
export const Hdr = (props: BrandIconProps) => (
    <svg {...base(props)}>
        <rect x="2" y="6" width="20" height="12" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <text x="12" y="15.4" textAnchor="middle" fontSize="7.5" fontWeight={800} fill="currentColor" fontFamily="Arial, Helvetica, sans-serif" letterSpacing="0.4">HDR</text>
    </svg>
);
