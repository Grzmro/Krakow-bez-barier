import * as React from "react"
import { Drawer as DrawerPrimitive } from "vaul"
import { cn } from "@/lib/utils"

// The base-nova `drawer.tsx` is built on Base UI's Drawer, not Vaul. This is the classic
// shadcn Vaul drawer, restyled with our tokens. Pass `container` to keep it inside the phone frame.

function VaulDrawer(props: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  return <DrawerPrimitive.Root data-slot="drawer" {...props} />
}

function VaulDrawerContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Content>) {
  return (
    <DrawerPrimitive.Portal>
      <DrawerPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <DrawerPrimitive.Content
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex max-h-[92%] flex-col rounded-t-(--radius-sheet) bg-card text-card-foreground shadow-sheet outline-none",
          className,
        )}
        {...props}
      >
        <div aria-hidden className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-border-strong/70" />
        {children}
      </DrawerPrimitive.Content>
    </DrawerPrimitive.Portal>
  )
}

const VaulDrawerTitle = DrawerPrimitive.Title
const VaulDrawerDescription = DrawerPrimitive.Description
const VaulDrawerClose = DrawerPrimitive.Close

export { VaulDrawer, VaulDrawerContent, VaulDrawerTitle, VaulDrawerDescription, VaulDrawerClose }
