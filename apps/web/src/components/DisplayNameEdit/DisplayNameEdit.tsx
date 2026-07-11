// Inline display-name editor: a label with a pencil that swaps to an input.
// Owns the edit state machine (autofocus + select-all, Enter commits, Escape
// cancels, blur commits) and re-reads `value` from props only while not
// editing. Click/key events stop propagating so hosting menus stay open.
// Empty-input handling belongs to the owner (setDisplayName reverts an empty
// name to a fresh random handle). Sizing is tuned per call site through the
// --display-name-* custom properties on the wrapper class passed as className.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import classnames from 'classnames';
import { useTranslation } from 'react-i18next';
import Icon from '@stremio/stremio-icons/react';
import { Button } from 'rillio/components';
import styles from './DisplayNameEdit.less';

type Props = {
    className?: string,
    value: string,
    maxLength?: number,
    onCommit: (value: string) => void,
};

const DisplayNameEdit = ({ className, value, maxLength = 40, onCommit }: Props) => {
    const { t } = useTranslation();
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const startEdit = useCallback((event: React.MouseEvent) => {
        event.stopPropagation();
        setDraft(value);
        setEditing(true);
    }, [value]);
    const commit = useCallback(() => {
        onCommit(draft);
        setEditing(false);
    }, [draft, onCommit]);
    const onKeyDown = useCallback((event: React.KeyboardEvent) => {
        event.stopPropagation();
        if (event.key === 'Enter') { event.preventDefault(); commit(); }
        else if (event.key === 'Escape') { event.preventDefault(); setEditing(false); }
    }, [commit]);
    useEffect(() => {
        if (editing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editing]);

    return (
        <div className={classnames(className, styles['display-name-edit'])}>
            {
                editing ?
                    <input
                        ref={inputRef}
                        className={styles['name-input']}
                        value={draft}
                        maxLength={maxLength}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={onKeyDown}
                        onBlur={commit}
                        onClick={(event) => event.stopPropagation()}
                    />
                    :
                    <React.Fragment>
                        <div className={styles['name-label']} title={value}>{value}</div>
                        <Button className={styles['edit-button']} title={t('EDIT') || 'Edit name'} onClick={startEdit}>
                            <Icon className={styles['edit-icon']} name={'edit'} />
                        </Button>
                    </React.Fragment>
            }
        </div>
    );
};

export default DisplayNameEdit;
