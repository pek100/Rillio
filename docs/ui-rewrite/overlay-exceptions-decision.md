# Custom-overlay exceptions: synthesis decision

Four hand-rolled overlays were kept during the UI rewrite, each with a documented
justification. I read every component, both ContextMenu call sites, the Player
closePrevented wiring, `docs/ui-rewrite/decisions.md`, and verified the one
load-bearing library claim (Radix `Popover.Anchor` `virtualRef`) directly in
installed source. Verdicts below.

Headline: **all four cases resolve with ZERO new dependencies.** Two are
replaceable using primitives already in the bundle (Radix Popover, cmdk); two are
genuine platform/design limits that should stay custom with rewritten
justifications. No case needs Base UI, Floating UI, Ariakit, or Downshift. That is
the most important result for the docs (see Dependency plan).

---

## Case 1 â€” context-menu â†’ ADOPT (Radix Popover + virtualRef, 0 new deps)

**Verdict: REPLACEABLE. Delete the ~130-line custom component; rebuild on a thin
app-owned hook driving a controlled `Popover` with a virtual anchor.**

Both documented limits dissolve cleanly and the evidence is strong:

- **Multi-ref trigger** was only a problem because Radix `ContextMenuTrigger`
  wraps one child. `Popover` never wraps the trigger. `Popover.Anchor` accepts a
  `virtualRef` (a `{getBoundingClientRect}` Measurable). The app's hook attaches
  `contextmenu` to N refs (the same `on.forEach(addEventListener)` loop that
  exists today) and feeds one virtual anchor. **Verified in installed source**
  (`node_modules/.pnpm/@radix-ui+react-popper@1.3.../react-popper/dist/index.js`,
  lines 82-112): when `virtualRef` is supplied, `PopperAnchor` renders `null` and
  positions Popper against `virtualRef.current`. This is the exact mechanism
  Radix's own ContextMenu uses, so it will not be removed.
- **Lock-to-edge** maps 1:1: point the same virtualRef at the row's real rect and
  set `side="bottom"`. Popper's flip/shift collision logic replaces the hand-rolled
  PADDING clamp. `lock` -> `side` ('bottom'->bottom, etc).

**Why this is low risk on the axis that matters (event propagation).** The
custom ContextMenu **already portals to `document.body` today** (`createPortal`,
line 136). The Player's closePrevented protocol (OptionsMenu's `onMouseDown` sets
`optionsMenuClosePrevented`, read by `onContainerMouseDown` at Player.tsx:405-406)
**already crosses that existing portal** via React synthetic bubbling through the
component tree. Swapping `createPortal` for `Popover.Portal` keeps the identical
React-tree relationship, so the protocol is preserved with no edits to OptionsMenu.
This is the crucial distinction from Case 2 (player menus, which are NOT portalled).

Ownership requirements are met: `Popover.Root open/onOpenChange` = app owns open;
`modal={false}` (the default) = no focus trap, no scroll lock, no aria-hiding (the
non-modal content path sets `trapFocus:false`, `disableOutsidePointerEvents:false`);
`onOpenAutoFocus={e=>e.preventDefault()}` = app owns focus. DismissableLayer
(Escape + outside-pointerdown) replaces the custom full-screen overlay + document
keydown listener. a11y is parity, not regression: Popover.Content is role=dialog,
and today's custom component is also just a div of Buttons with no menu semantics.

Winner over Floating-UI-direct / Base UI / Ariakit purely on bundle: `radix-ui`
is already a dependency and `react-popover`+`react-popper` are already shipped (the
kit's context-menu.tsx and DropdownMenu pull them in). This adds ~0 new bytes.

**Refinements to fold into migration** (from my source read, beyond the
investigation): the `virtualRef` effect (lines 99-108) reads `virtualRef.current`
inside `useEffect` and re-runs when the anchor object identity changes or via the
`setOpen(true)` re-render. First open works. But a *second* right-click while the
menu is already open won't change `open` state (already true), so the anchor may
not reposition. Mitigate by setting `open` false->true on each contextmenu event
(or swapping the virtualRef object identity each event so the effect refires).

## Case 2 â€” player-menus â†’ KEEP (rewrite justification; optional 0-dep a11y add)

**Verdict: KEEP-JUSTIFIED. The justification survives research and is stronger
than the current comment states.**

The five files (Subtitles/Audio/Speed/Options/Statistics) are plain styled `<div>`
panels. They contain **no positioning, no open-state, no focus logic** â€” only a
one-line `onMouseDown` that sets a per-menu closePrevented flag. All orchestration
lives in Player.tsx (state via `useBinaryState`; close via `onContainerMouseDown`
reading the shared nativeEvent flags at 405-418; reactive-effect closes). There is
almost nothing for a primitive to "replace" â€” a primitive would ADD machinery that
then has to be disabled.

Two hard constraints defeat every trigger-menu primitive:

1. **Native DOM bubbling.** Unlike the ContextMenu, these panels are **DOM children
   of `player-container`** and rely on native mousedown bubbling to
   `onContainerMouseDown`, which is also the immersion driver. Any primitive that
   portals to body severs that native bubble and breaks the immersion + closePrevented
   coupling. (This is exactly why Case 1 is safe and Case 2 is not: Case 1 already
   portals; Case 2 must not.)
2. **Self-owned dismiss must not exist.** Radix DismissableLayer and Base UI's
   outside-press both fire their own close, racing the Player's `menusOpen`-gated
   close. The Player must be the sole close arbiter.

Verified per-library: Radix menu/popover content always portals and always carries
a non-removable DismissableLayer (rejected). Base UI has no prop to disable
outside-press dismissal (rejected). Ariakit is the only one reducible all the way
(`portal={false}`, `modal={false}`, `autoFocusOnShow/Hide={false}`,
`hideOnInteractOutside={false}`, controlled store) â€” but at that point it provides
only `role="menu"` and adds a dependency while leaving closePrevented + immersion +
positioning entirely in place. Strictly worse. Floating UI's one value (anchored
positioning) is unused (panels are fixed bottom-right, never anchored to the
ControlBar button that opens them).

**Action: rewrite the header justifications** to cite (a) fixed-position not
trigger-anchored, (b) native-bubble-dependent close protocol that portals would
sever, (c) Player-owned single-arbiter dismissal. Do NOT adopt a primitive.

**Optional additive enhancement (0 new deps), only if a11y is in scope:** the
panels currently expose no role=menu / aria-checked / arrow-key nav. Layer Radix
`RovingFocus` (exported from `radix-ui/internal`, already a dependency) onto the
existing item lists for Up/Down/Home/End roving + ARIA roles, **without any popover
wrapper**. It does not portal, trap page focus, add a dismiss layer, or touch open
state, so closePrevented and immersion keep working verbatim. This is additive, not
a replacement. Note `radix-ui/internal` is an internal subpath â€” pin the version.

## Case 3 â€” search-dropdown â†’ ADOPT (cmdk, already installed at ^1.1.1, 0 new deps)

**Verdict: REPLACEABLE. The documented justification (focus-in-input + free-text
Enter) is fully researched away. ~10 lines of trivial absolute-positioning +
click-outside glue remain, which is not a "custom overlay mechanism."**

Component under review is `components/NavBar/HorizontalNavBar/SearchBar/SearchBar.tsx`
(the history-dropdown one, confirmed via grep â€” not the simple pill in
`components/SearchBar`). Both stated limits are solved by cmdk, which is **already
installed and already proven in `SearchModal.tsx`**:

- **Focus stays in the input:** cmdk implements the ARIA combobox pattern â€” DOM
  focus never leaves the input; a virtual highlight moves via aria-activedescendant.
  This is the invariant the component hand-rolls today. cmdk is not a popover and
  needs no focus trap, so the "Radix Popover steals focus" concern is irrelevant.
- **Enter submits free text, not a row:** SearchModal.tsx already ships the exact
  pattern â€” `shouldFilter={false}` + an `onKeyDown` that on Enter calls
  `preventDefault()`+`stopPropagation()` (stopping cmdk's root keydown from selecting
  the highlight) then navigates. This is cmdk-maintainer-sanctioned.

The app keeps full ownership of open-state (the existing `useBinaryState` +
document-mousedown click-outside stay verbatim) â€” cmdk is inline list+keyboard
machinery only, no portal, so bubbling is unchanged. Net is a strict upgrade: the
current panel is a non-navigable list; cmdk adds keyboard nav the panel lacks.
Single file, ~40 min, no call-site or hook changes.

Two migration notes: (1) use `CommandPrimitive.Input` directly, not the kit
`CommandInput` wrapper, which forces a leading search icon that clashes with the
pill's trailing X/Search layout; (2) the field moves uncontrolled->controlled
(`value`/`onValueChange`), so any `searchInputRef.current.value` read becomes a
state read â€” the paste-to-play handler reads `clipboardData` so it is unaffected.

This adoption also **unifies both search consumers on one primitive** (SearchModal
already uses cmdk), which is the point. Optional follow-up: extract a shared
headless `<SearchCombobox>` both render; skip is fine (keeps existing drift).

## Case 4 â€” blur-backdrop â†’ KEEP (rewrite justification; optional CSS-only enhancement)

**Verdict: KEEP-JUSTIFIED. The justification is confirmed and stronger than the
comment states. There is no custom overlay mechanism here â€” the component is
`createPortal` + a static div, and the design choice is the ABSENCE of animation.**

In 2026 Chromium/WebView2 there is still no cheap way to animate a live
full-viewport backdrop-filter, and the two obvious approaches are structurally
broken, not merely janky:

1. Animating blur **radius** re-runs a full-viewport GPU convolution every frame;
   compositor acceleration offloads the property mutation, not the raster, so the
   frame budget still blows out.
2. Fading the layer's **opacity** is worse: per MDN, opacity < 1 turns the element
   into a "backdrop root," so during the fade backdrop-filter can no longer reach
   the page behind it â€” the exact mechanism of the still-open Chromium flicker bug
   (1194050 / 40175472).

No library is involved either way (bundle cost zero). Focus/state/propagation are
N/A to this case (plain div, `onClick={close}`, no portal-bubbling protocol).

**Action: keep the static appear; rewrite the comment** to cite the backdrop-root
mechanism, not just re-rasterization. **Optional CSS-only enhancement** (no
library, no behavior change) if Michael wants a premium entrance: never animate the
blur; split into (blur layer, plain-color tint, panel) and animate only the cheap
parts â€” the blur pops in at constant radius (never a backdrop root), a separate
plain tint opacity-fades, and the panel does the visible scale/translate motion so
the blur pop-in is imperceptible. Keyframes live outside `@theme` per tailwind.css
rules. Watch: give the tint `pointer-events-none` so `onClick={close}` still fires,
and keep the blur layer free of opacity/filter/will-change so it never becomes a
backdrop root.

---

## Dependency plan

**Net new dependencies across all four cases: ZERO.**

| Case | Verdict | Primitive | New bytes |
|------|---------|-----------|-----------|
| context-menu | ADOPT | Radix `Popover` + `virtualRef` (already bundled) | ~0 |
| search-dropdown | ADOPT | cmdk ^1.1.1 (already installed, already used) | 0 |
| player-menus | KEEP | none; optional `radix-ui/internal` RovingFocus | 0 |
| blur-backdrop | KEEP | none; CSS-only | 0 |

**Impact on the Radix-lock decision (`docs/ui-rewrite/decisions.md` #1):
reinforced, not challenged.** Every case resolves inside the primitives already in
the tree (radix-ui + cmdk). None requires Base UI, Floating UI, Ariakit, or
Downshift. The "one-extra-primitive-lib" soft budget stays entirely unspent â€” keep
it in reserve for a future case that genuinely needs anchored positioning (the one
capability none of the current four use). Recommend adding a line to decisions.md
recording that the four overlay exceptions were re-reviewed and two were absorbed
into Radix/cmdk with no new deps, confirming the lock was the right call.

Docs to update alongside the code:
- ContextMenu header comment: delete (component is being replaced).
- SubtitleVariant header comment: drop the "Radix cannot express cleanly" line.
- Player menu headers (x5): rewrite to the fixed-position / native-bubble /
  single-arbiter justification above.
- Blur backdrop comment: rewrite to cite the backdrop-root mechanism.
- decisions.md: add the re-review note.

## Sequenced migration plan (safest first; player is the riskiest surface)

1. **search-dropdown (ADOPT) â€” do first.** Single file, off the player surface,
   pattern already proven in SearchModal, net feature gain. This is the low-blast-
   radius pilot that validates the "adopt an installed primitive" approach.
2. **blur-backdrop (KEEP) â€” trivial.** Rewrite the comment now. If Michael wants
   the entrance, land the CSS-only panel-animation split. No behavior risk.
3. **context-menu (ADOPT) â€” staged, SubtitleVariant sub-case first.** Build the
   `useContextAnchor` hook + `Popover` wrapper preserving the `on`/`autoClose`/`lock`
   public API so both call sites stay drop-in. Land and verify the **SubtitleVariant
   (lock='bottom')** path first â€” it is off the immersion/closePrevented protocol.
   Then cut over the **Player right-click** path (on=[containerRef, bufferingRef,
   errorRef] wrapping OptionsMenu). Verify in the real Tauri WebView2 frame that
   OptionsMenu's closePrevented still reaches onContainerMouseDown and that a
   subtitle row near the viewport bottom flips correctly. Bake
   `onOpenAutoFocus preventDefault` into the wrapper (easy to forget, disturbs
   immersion if missed) and handle the second-right-click reposition refinement.
4. **player-menus (KEEP) â€” last, and only the a11y add if approved.** Rewrite the
   five justifications (no risk). The optional RovingFocus enhancement touches the
   riskiest surface but is purely additive (no portal, no open-state change); gate
   it on Michael confirming a11y is in scope.

Per the project's stale-WebView2-cache gotcha, clear the three EBWebView cache dirs
before each relaunch when verifying the player-touching changes.