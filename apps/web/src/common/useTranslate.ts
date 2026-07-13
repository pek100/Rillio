// Copyright (C) 2017-2023 Smart code 203358507

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

// Whether `name` already ends with `type` as a whole word, so that appending the
// type would only repeat it: "Public Domain Movies" + "Movies".
const endsWithType = (name: string, type: string): boolean => {
    if (type.length === 0 || name.length < type.length) {
        return false;
    }

    const suffixStart = name.length - type.length;
    if (name.slice(suffixStart).toLowerCase() !== type.toLowerCase()) {
        return false;
    }

    // charAt() past the start of the string yields '', which is not a word character.
    return !/[\p{L}\p{N}]/u.test(name.charAt(suffixStart - 1));
};

type CatalogArg = {
    addon?: { manifest: { id: string } };
    id?: string;
    name?: string;
    type?: string;
};

const useTranslate = () => {
    const { t } = useTranslation();

    const string = useCallback((key: string) => t(key), [t]);

    const stringWithPrefix = useCallback((value: string, prefix: string, fallback: string | null = null) => {
        const key = `${prefix}${value}`;
        const defaultValue = fallback ?? value.charAt(0).toUpperCase() + value.slice(1);

        return t(key, {
            defaultValue,
        });
    }, [t]);

    const catalogTitle = useCallback(({ addon, id, name, type }: CatalogArg = {}, withType = true) => {
        if (addon && id && name) {
            const partialKey = `${addon.manifest.id.split('.').join('_')}_${id}`;
            const translatedName = stringWithPrefix(partialKey, 'CATALOG_', name);

            if (type && withType) {
                // "Popular Movies", not "Popular - Movie": the plural reads as a
                // phrase, so no dash. Falls back to the singular if a locale is
                // missing the _PL key.
                const translatedType = stringWithPrefix(`${type}_PL`, 'TYPE_', stringWithPrefix(type, 'TYPE_'));
                return endsWithType(translatedName, translatedType) ?
                    translatedName
                    :
                    `${translatedName} ${translatedType}`;
            }

            return translatedName;
        }

        return null;
    }, [stringWithPrefix]);

    return {
        string,
        stringWithPrefix,
        catalogTitle,
    };
};

export = useTranslate;
