"use client";

import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../cn";

const toggleVariants = cva(
  "press inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full font-semibold whitespace-nowrap outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        chip: "bg-card text-foreground ring-1 ring-input hover:bg-muted aria-pressed:bg-primary-container aria-pressed:ring-2 aria-pressed:ring-primary aria-pressed:hover:bg-primary-container",
        ghost: "hover:bg-muted aria-pressed:bg-muted",
      },
      size: {
        default: "h-10 px-4 text-sm",
        sm: "h-8 px-3 text-[13px]",
      },
    },
    defaultVariants: { variant: "chip", size: "default" },
  },
);

/** Pressable chip (`aria-pressed`), e.g. a feature filter. */
function Toggle({ className, variant, size, ...props }: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  return <TogglePrimitive data-slot="toggle" className={cn(toggleVariants({ variant, size }), className)} {...props} />;
}

/** Group of toggles with roving focus (arrow keys move between items). */
function ToggleGroup({ className, ...props }: ToggleGroupPrimitive.Props) {
  return <ToggleGroupPrimitive data-slot="toggle-group" className={cn("flex items-center gap-2", className)} {...props} />;
}

export { Toggle, ToggleGroup, toggleVariants };
