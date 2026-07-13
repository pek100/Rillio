// Copyright (C) 2017-2024 Smart code 203358507

/**
 * Carousel (foundation kit) - the one carousel engine, Embla via the official shadcn
 * wrapper. HeroMedia uses it directly (+ embla-carousel-autoplay, gated to image
 * slides at the call site); HeroCarousel can drive its bespoke 3D coverflow from the
 * same headless api for wrap / keyboard / swipe. `setApi` exposes the EmblaCarouselType
 * for index / dots / autoplay control.
 */

import React, {
    createContext,
    forwardRef,
    useCallback,
    useContext,
    useEffect,
    useState,
    type ComponentProps,
    type HTMLAttributes,
    type KeyboardEvent,
} from 'react';
import useEmblaCarousel, { type UseEmblaCarouselType } from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from './cn';
import { IconButton } from './button';

type CarouselApi = UseEmblaCarouselType[1];
type UseCarouselParameters = Parameters<typeof useEmblaCarousel>;
type CarouselOptions = UseCarouselParameters[0];
type CarouselPlugin = UseCarouselParameters[1];

type CarouselProps = {
    opts?: CarouselOptions;
    plugins?: CarouselPlugin;
    orientation?: 'horizontal' | 'vertical';
    setApi?: (api: CarouselApi) => void;
};

type CarouselContextProps = {
    carouselRef: ReturnType<typeof useEmblaCarousel>[0];
    api: CarouselApi;
    scrollPrev: () => void;
    scrollNext: () => void;
    canScrollPrev: boolean;
    canScrollNext: boolean;
    orientation: 'horizontal' | 'vertical';
} & CarouselProps;

const CarouselContext = createContext<CarouselContextProps | null>(null);

export function useCarousel(): CarouselContextProps {
    const context = useContext(CarouselContext);
    if (!context) throw new Error('useCarousel must be used within a <Carousel />');
    return context;
}

export const Carousel = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & CarouselProps>(
    function Carousel({ orientation = 'horizontal', opts, setApi, plugins, className, children, ...props }, ref) {
        const [carouselRef, api] = useEmblaCarousel(
            { ...opts, axis: orientation === 'horizontal' ? 'x' : 'y' },
            plugins,
        );
        const [canScrollPrev, setCanScrollPrev] = useState(false);
        const [canScrollNext, setCanScrollNext] = useState(false);

        const onSelect = useCallback((emblaApi: CarouselApi) => {
            if (!emblaApi) return;
            setCanScrollPrev(emblaApi.canScrollPrev());
            setCanScrollNext(emblaApi.canScrollNext());
        }, []);

        const scrollPrev = useCallback(() => api?.scrollPrev(), [api]);
        const scrollNext = useCallback(() => api?.scrollNext(), [api]);

        const onKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                scrollPrev();
            } else if (event.key === 'ArrowRight') {
                event.preventDefault();
                scrollNext();
            }
        }, [scrollPrev, scrollNext]);

        useEffect(() => {
            if (api && setApi) setApi(api);
        }, [api, setApi]);

        useEffect(() => {
            if (!api) return;
            onSelect(api);
            api.on('reInit', onSelect);
            api.on('select', onSelect);
            return () => {
                api?.off('select', onSelect);
            };
        }, [api, onSelect]);

        return (
            <CarouselContext.Provider
                value={{ carouselRef, api, opts, orientation, scrollPrev, scrollNext, canScrollPrev, canScrollNext }}
            >
                <div
                    ref={ref}
                    onKeyDownCapture={onKeyDown}
                    className={cn('relative', className)}
                    role="region"
                    aria-roledescription="carousel"
                    {...props}
                >
                    {children}
                </div>
            </CarouselContext.Provider>
        );
    },
);

export const CarouselContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
    function CarouselContent({ className, ...props }, ref) {
        const { carouselRef, orientation } = useCarousel();
        return (
            <div ref={carouselRef} className="overflow-hidden">
                <div
                    ref={ref}
                    className={cn('flex', orientation === 'horizontal' ? '-ml-4' : '-mt-4 flex-col', className)}
                    {...props}
                />
            </div>
        );
    },
);

export const CarouselItem = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
    function CarouselItem({ className, ...props }, ref) {
        const { orientation } = useCarousel();
        return (
            <div
                ref={ref}
                role="group"
                aria-roledescription="slide"
                className={cn('min-w-0 shrink-0 grow-0 basis-full', orientation === 'horizontal' ? 'pl-4' : 'pt-4', className)}
                {...props}
            />
        );
    },
);

export function CarouselPrevious({ className, ...props }: ComponentProps<typeof IconButton>) {
    const { orientation, scrollPrev, canScrollPrev } = useCarousel();
    return (
        <IconButton
            variant="outline"
            className={cn(
                'absolute size-8 bg-card/80',
                orientation === 'horizontal' ? '-left-3 top-1/2 -translate-y-1/2' : '-top-3 left-1/2 -translate-x-1/2 rotate-90',
                className,
            )}
            disabled={!canScrollPrev}
            onClick={scrollPrev}
            aria-label="Previous slide"
            {...props}
        >
            <ChevronLeft className="size-4" />
        </IconButton>
    );
}

export function CarouselNext({ className, ...props }: ComponentProps<typeof IconButton>) {
    const { orientation, scrollNext, canScrollNext } = useCarousel();
    return (
        <IconButton
            variant="outline"
            className={cn(
                'absolute size-8 bg-card/80',
                orientation === 'horizontal' ? '-right-3 top-1/2 -translate-y-1/2' : '-bottom-3 left-1/2 -translate-x-1/2 rotate-90',
                className,
            )}
            disabled={!canScrollNext}
            onClick={scrollNext}
            aria-label="Next slide"
            {...props}
        >
            <ChevronRight className="size-4" />
        </IconButton>
    );
}

export type { CarouselApi };
export default Carousel;
