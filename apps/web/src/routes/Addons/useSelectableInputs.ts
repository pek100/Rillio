// Copyright (C) 2017-2023 Smart code 203358507

import React from 'react';
import { useTranslate } from 'rillio/common';

// The installed/remote addon selectable shapes are the dynamic core model state;
// typing them exhaustively here buys little, so the mapper stays `any`-based and
// the consumer annotates the returned selectable inputs.
// `onSelect` receives the chosen deepLinks.addons value (a #/addons/... path); the
// consumer parses it into modal-local filter state instead of navigating.
const mapSelectableInputs = (installedAddons: any, remoteAddons: any, t: any, onSelect: (value: string) => void): any[] => {
    const selectedCatalog = remoteAddons.selectable.catalogs.concat(installedAddons.selectable.catalogs).find(({ selected }: any) => selected);
    const catalogSelect = {
        options: remoteAddons.selectable.catalogs
            .concat(installedAddons.selectable.catalogs)
            .map(({ name, deepLinks }: any) => ({
                value: deepLinks.addons,
                label: t.stringWithPrefix(name.toUpperCase(), 'ADDON_'),
                title: t.stringWithPrefix(name.toUpperCase(), 'ADDON_'),
            })),
        value: selectedCatalog ? selectedCatalog.deepLinks.addons : undefined,
        title: remoteAddons.selected !== null ?
            () => {
                const selectableCatalog = remoteAddons.selectable.catalogs
                    .find(({ id }: any) => id === remoteAddons.selected.request.path.id);
                return selectableCatalog ? t.stringWithPrefix(selectableCatalog.name.toUpperCase(), 'ADDON_') : remoteAddons.selected.request.path.id;
            }
            :
            null,
        onSelect: (value: string) => {
            onSelect(value);
        }
    };
    const selectedType = installedAddons.selected !== null
        ? installedAddons.selectable.types.find(({ selected }: any) => selected)
        : remoteAddons.selectable.types.find(({ selected }: any) => selected);
    const typeSelect = {
        options: installedAddons.selected !== null ?
            installedAddons.selectable.types.map(({ type, deepLinks }: any) => ({
                value: deepLinks.addons,
                label: type !== null ? t.stringWithPrefix(type, 'TYPE_') : t.string('TYPE_ALL')
            }))
            :
            remoteAddons.selectable.types.map(({ type, deepLinks }: any) => ({
                value: deepLinks.addons,
                label: t.stringWithPrefix(type, 'TYPE_')
            })),
        value: selectedType ? selectedType.deepLinks.addons : undefined,
        title: () => {
            return installedAddons.selected !== null ?
                installedAddons.selected.request.type === null ?
                    t.string('TYPE_ALL')
                    :
                    t.stringWithPrefix(installedAddons.selected.request.type, 'TYPE_')
                :
                remoteAddons.selected !== null ?
                    t.stringWithPrefix(remoteAddons.selected.request.path.type, 'TYPE_')
                    :
                    t.string('SELECT_TYPE');
        },
        onSelect: (value: string) => {
            onSelect(value);
        }
    };
    return [catalogSelect, typeSelect];
};

const useSelectableInputs = (installedAddons: InstalledAddons, remoteAddons: RemoteAddons, onSelect: (value: string) => void): any[] => {
    const t = useTranslate();
    const selectableInputs = React.useMemo(() => {
        return mapSelectableInputs(installedAddons, remoteAddons, t, onSelect);
    }, [installedAddons, remoteAddons, onSelect]);
    return selectableInputs;
};

export default useSelectableInputs;
