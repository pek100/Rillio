// Copyright (C) 2017-2026 Smart code 203358507

/**
 * SearchSuggestions - the shared cmdk list machinery behind BOTH search consumers: the
 * nav SearchBar dropdown and the SearchModal palette. It renders the History +
 * Suggestions groups (headings, rows, clear-history control, optional empty node) with
 * one set of row/heading classes, so the two consumers read as one system instead of
 * each hand-rolling the same list.
 *
 * It is the inner list only (CommandList + groups + items). Each consumer owns its own
 * cmdk `Command` root and input, because the shapes differ (the nav is an inline pill
 * with a dropdown panel; the modal is a portalled dialog). cmdk keeps DOM focus in the
 * input via the ARIA combobox pattern and moves a virtual highlight, so rows are keyboard-
 * navigable in both. Enter behaviour (free-text vs row select) is owned by each consumer's
 * input handler.
 *
 * Rows dispatch through `onSelect(href)` (closure-captured, ignoring cmdk's value arg) so
 * both click and keyboard-select route identically; the consumer strips the leading '#'
 * and navigates.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { cn } from 'rillio/components/ui/cn';
import { CommandList, CommandGroup, CommandItem } from 'rillio/components/ui/command';

export type SearchSuggestionItem = {
    query: string;
    deepLinks: { search: string };
};

// Shared heading + cmdk row styling (data-[selected] is cmdk's keyboard highlight).
const HEADING = 'text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-fg-subtle';
const ROW = 'flex cursor-pointer items-center gap-2.5 rounded-card px-3 py-2.5 text-sm text-fg-muted data-[selected=true]:bg-surface-hover data-[selected=true]:text-fg';

type Props = {
    historyItems: SearchSuggestionItem[];
    suggestions: SearchSuggestionItem[];
    onClearHistory: () => void;
    onSelect: (href: string) => void;
    onRowActivate?: () => void;
    listClassName?: string;
    empty?: React.ReactNode;
};

const SearchSuggestions = ({ historyItems, suggestions, onClearHistory, onSelect, onRowActivate, listClassName, empty }: Props) => {
    const { t } = useTranslation();

    const activate = React.useCallback((href: string) => {
        onSelect(href);
        onRowActivate?.();
    }, [onSelect, onRowActivate]);

    return (
        <CommandList className={listClassName}>
            {empty}

            {
                historyItems.length > 0 ?
                    <CommandGroup
                        className="p-0"
                        heading={
                            <div className="flex items-center justify-between px-3 py-1.5">
                                <span className={HEADING}>{t('STREMIO_TV_SEARCH_HISTORY_TITLE')}</span>
                                <button
                                    type="button"
                                    className="text-xs text-fg-subtle transition-colors duration-150 hover:text-fg"
                                    onClick={onClearHistory}
                                >
                                    {t('CLEAR_HISTORY')}
                                </button>
                            </div>
                        }
                    >
                        {historyItems.slice(0, 8).map(({ query, deepLinks }, index) => (
                            <CommandItem key={`history-${index}`} value={`history-${index}`} onSelect={() => activate(deepLinks.search)} className={ROW}>
                                <Search className="size-4 shrink-0 text-fg-subtle" />
                                <span className="truncate">{query}</span>
                            </CommandItem>
                        ))}
                    </CommandGroup>
                    :
                    null
            }

            {
                suggestions.length > 0 ?
                    <CommandGroup
                        className="p-0"
                        heading={<span className={cn(HEADING, 'block px-3 py-1.5')}>{t('SEARCH_SUGGESTIONS')}</span>}
                    >
                        {suggestions.map(({ query, deepLinks }, index) => (
                            <CommandItem key={`suggestion-${index}`} value={`suggestion-${index}`} onSelect={() => activate(deepLinks.search)} className={ROW}>
                                <Search className="size-4 shrink-0 text-fg-subtle" />
                                <span className="truncate">{query}</span>
                            </CommandItem>
                        ))}
                    </CommandGroup>
                    :
                    null
            }
        </CommandList>
    );
};

export default SearchSuggestions;
