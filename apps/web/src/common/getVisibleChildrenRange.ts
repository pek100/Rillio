// Copyright (C) 2017-2023 Smart code 203358507

type VisibleChildrenRange = {
    start: number;
    end: number;
};

const isChildVisible = (container: HTMLElement, element: HTMLElement): boolean => {
    const elementTop = element.offsetTop;
    const elementBottom = element.offsetTop + element.clientHeight;
    const containerTop = container.scrollTop;
    const containerBottom = container.scrollTop + container.clientHeight;
    return (elementTop >= containerTop && elementBottom <= containerBottom) ||
        (elementTop < containerTop && containerTop < elementBottom) ||
        (elementTop < containerBottom && containerBottom < elementBottom);
};

const getVisibleChildrenRange = (container: HTMLElement): VisibleChildrenRange | null => {
    return Array.from(container.children as HTMLCollectionOf<HTMLElement>).reduce<VisibleChildrenRange | null>((result, child, index) => {
        if (isChildVisible(container, child)) {
            if (result === null) {
                result = {
                    start: index,
                    end: index
                };
            } else {
                result.end = index;
            }
        }

        return result;
    }, null);
};

export = getVisibleChildrenRange;
