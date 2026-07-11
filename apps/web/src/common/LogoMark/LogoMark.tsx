import React from 'react';
import Logo from 'rillio/common/Logo/Logo';

type Props = {
    className?: string;
    // Element whose hover triggers the pour (e.g. the whole brand link, so
    // hovering the "Rillio" text animates the mark too). Defaults to the mark.
    hoverRef?: React.RefObject<HTMLElement>;
};

// The header mark. Renders the exact fluid-fill animation from the loading screen
// (window.__rillioFluidLogo), holding fully filled at rest and pouring the fill
// while hovered. Falls back to the static logo if WebGL/reduced-motion blocks it.
const LogoMark = ({ className, hoverRef }: Props) => {
    const wrapRef = React.useRef<HTMLSpanElement>(null);
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const [fellBack, setFellBack] = React.useState(false);

    React.useEffect(() => {
        const run = (globalThis as any).__rillioFluidLogo;
        if (typeof run !== 'function') { setFellBack(true); return undefined; }
        let cancelled = false;
        // Defer the heavy geodesic bake until the main thread is idle so it never
        // competes with app-mount work (which could trip the safety fallback).
        const start = () => {
            if (cancelled) return;
            const canvas = canvasRef.current;
            const wrap = (hoverRef && hoverRef.current) || wrapRef.current;
            if (canvas && wrap) run(canvas, { hover: wrap, safety: 8000, fallback: () => setFellBack(true) });
            else setFellBack(true);
        };
        const ric = (globalThis as any).requestIdleCallback;
        const id = typeof ric === 'function' ? ric(start, { timeout: 2000 }) : window.setTimeout(start, 1200);
        return () => { cancelled = true; };
    }, []);

    return (
        <span ref={wrapRef} className={className}>
            {fellBack
                ? <Logo className="h-full w-auto" />
                : <canvas ref={canvasRef} width={220} height={226} className="block h-full w-auto" />}
        </span>
    );
};

export default LogoMark;
