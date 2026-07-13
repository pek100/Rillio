// Copyright (C) 2017-2024 Smart code 203358507

/**
 * Foundation kit barrel (Phase 2).
 *
 * Re-exports every primitive so Phase 3 route rewrites can `import { ... } from
 * 'rillio/components/ui'`. The kit is DORMANT until then - nothing here is wired into
 * the running app yet.
 *
 * `__uiKitManifest` references one value from every module so that a single import of
 * this barrel pulls the whole kit into webpack's graph (ts-loader then compiles each
 * primitive). It is intentionally unused at runtime; see dev/ui-kit-compile-check.ts.
 */

export * from './cn';
export * from './motion';
export * from './button';
export * from './dialog';
export * from './dropdown-menu';
export * from './popover';
export * from './context-menu';
export * from './tooltip';
export * from './select';
export * from './switch';
export * from './checkbox';
export * from './radio-group';
export * from './input';
export * from './toggle-group';
export * from './number-stepper';
export * from './sonner';
export * from './use-toast';
export * from './drawer';
export * from './sheet';
export * from './carousel';
export * from './command';

import { cn } from './cn';
import { LazyMotionProvider, fade } from './motion';
import { Button, IconButton } from './button';
import { Dialog, ModalRoute } from './dialog';
import { DropdownMenu } from './dropdown-menu';
import { Popover } from './popover';
import { ContextMenu } from './context-menu';
import { Tooltip, TooltipProvider } from './tooltip';
import { Select, SelectCascade } from './select';
import { Switch } from './switch';
import { Checkbox } from './checkbox';
import { RadioGroup } from './radio-group';
import { Input } from './input';
import { ToggleGroup } from './toggle-group';
import { NumberStepper } from './number-stepper';
import { Toaster } from './sonner';
import { useToast, ToastProvider } from './use-toast';
import { Drawer } from './drawer';
import { Sheet } from './sheet';
import { Carousel } from './carousel';
import { Command } from './command';

/**
 * Every primitive, referenced once, so importing this barrel retains and compiles the
 * whole kit. Not for runtime use.
 */
export const __uiKitManifest = [
    cn, LazyMotionProvider, fade,
    Button, IconButton,
    Dialog, ModalRoute,
    DropdownMenu, Popover, ContextMenu,
    Tooltip, TooltipProvider,
    Select, SelectCascade,
    Switch, Checkbox, RadioGroup, Input, ToggleGroup, NumberStepper,
    Toaster, useToast, ToastProvider,
    Drawer, Sheet, Carousel, Command,
] as const;
