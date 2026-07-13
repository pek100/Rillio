// Copyright (C) 2017-2024 Smart code 203358507

/**
 * CredentialsTextInput - the Intro/PasswordReset email + password field.
 *
 * A thin wrapper over the foundation-kit Input that layers the app's spatial
 * navigation back on top: arrow keys drive window.navigate('up'|'down') for
 * TV/remote/gamepad users, guarded by the same navigationPrevented /
 * spatialNavigationPrevented nativeEvent flags as before. The kit Input keeps the
 * onSubmit-on-Enter ergonomics and forwards its ref to the native <input>, so
 * `.value` / `.validity` / `.focus()` on the ref still work at the call sites.
 */

import React, { forwardRef, useCallback, type KeyboardEvent, type InputHTMLAttributes } from 'react';
import { Input } from 'rillio/components/ui';

type Props = InputHTMLAttributes<HTMLInputElement> & {
    onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
    onSubmit?: (event: KeyboardEvent<HTMLInputElement>) => void;
};

const CredentialsTextInput = forwardRef<HTMLInputElement, Props>(function CredentialsTextInput(props, ref) {
    const onKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
        if (typeof props.onKeyDown === 'function') {
            props.onKeyDown(event);
        }

        const nativeEvent = event.nativeEvent as Event & {
            navigationPrevented?: boolean;
            spatialNavigationPrevented?: boolean;
        };

        if (!nativeEvent.navigationPrevented) {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
                nativeEvent.spatialNavigationPrevented = true;
            }

            if (!event.shiftKey) {
                if (event.key === 'ArrowDown') {
                    (window as unknown as { navigate: (dir: string) => void }).navigate('down');
                } else if (event.key === 'ArrowUp') {
                    (window as unknown as { navigate: (dir: string) => void }).navigate('up');
                }
            }
        }
    }, [props.onKeyDown]);

    return (
        <Input {...props} ref={ref} onKeyDown={onKeyDown} />
    );
});

export default CredentialsTextInput;
