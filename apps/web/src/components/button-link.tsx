"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { buttonVariants } from "@krakow-bez-barier/ui";

type Variant = NonNullable<Parameters<typeof buttonVariants>[0]>["variant"];

// buttonVariants lives in a client module, so Server Components render button-styled links through this.
export function ButtonLink({ className, variant, ...props }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={buttonVariants({ variant, className })} {...props} />;
}
