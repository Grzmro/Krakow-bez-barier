"use client";

import { useEffect, useRef, type ComponentProps } from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { cn } from "../cn";
import { keyboardOpen, revealFocusedField, sheetStyle, useSheetFit } from "./keyboard-inset";

// For modal sheets (menu, report form, threshold editor). The base-nova `drawer.tsx` is Base UI's
// Drawer, not Vaul. Never use snap points here — the map/list sheet is the non-modal BottomPanel.

// Vaul defaults autoFocus to false, which leaves focus on the trigger: Tab then walks the
// aria-hidden page behind the open modal before it reaches the sheet.
// Vaul's repositionInputs takes every visualViewport resize for the keyboard, so a pinch-zoom with a
// text field focused squashes the sheet and lifts it off the bottom; VaulDrawerContent handles the keyboard.
function VaulDrawer({
  autoFocus = true,
  repositionInputs = false,
  ...props
}: ComponentProps<typeof DrawerPrimitive.Root>) {
  return <DrawerPrimitive.Root data-slot="drawer" autoFocus={autoFocus} repositionInputs={repositionInputs} {...props} />;
}

// Most sheets open from state, not a Trigger, so Radix has nothing to return focus to on close:
// remember whatever was focused when the sheet opened and refocus it.
function VaulDrawerContent({
  className,
  children,
  onOpenAutoFocus,
  onCloseAutoFocus,
  style,
  ...props
}: ComponentProps<typeof DrawerPrimitive.Content>) {
  const opener = useRef<HTMLElement | null>(null);
  const fit = useSheetFit();
  const keyboardBottom = keyboardOpen(fit) ? fit!.bottom : 0;
  const keyboardHeight = keyboardBottom ? fit!.visibleHeight : 0;
  useEffect(() => {
    if (keyboardBottom) revealFocusedField();
  }, [keyboardBottom, keyboardHeight]);
  return (
    <DrawerPrimitive.Portal>
      {/* Black, not the ink token: ink is near-white in dark mode. */}
      <DrawerPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" />
      <DrawerPrimitive.Content
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-(--radius-sheet) bg-card pb-[env(safe-area-inset-bottom)] text-card-foreground shadow-sheet outline-none",
          className,
        )}
        style={{ ...sheetStyle(fit), ...style }}
        onOpenAutoFocus={(e) => {
          opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          onOpenAutoFocus?.(e);
        }}
        onCloseAutoFocus={(e) => {
          onCloseAutoFocus?.(e);
          if (e.defaultPrevented || !opener.current?.isConnected) return;
          e.preventDefault();
          opener.current.focus();
        }}
        {...props}
      >
        <div aria-hidden className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-border-strong/70" />
        {children}
      </DrawerPrimitive.Content>
    </DrawerPrimitive.Portal>
  );
}

const VaulDrawerTrigger = DrawerPrimitive.Trigger;
const VaulDrawerTitle = DrawerPrimitive.Title;
const VaulDrawerDescription = DrawerPrimitive.Description;
const VaulDrawerClose = DrawerPrimitive.Close;

export { VaulDrawer, VaulDrawerContent, VaulDrawerTrigger, VaulDrawerTitle, VaulDrawerDescription, VaulDrawerClose };
