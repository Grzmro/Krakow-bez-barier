"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { buttonVariants } from "@krakow-bez-barier/ui";

// buttonVariants lives in a client module, so Server Components render button-styled links through this.
export function ButtonLink({ className, ...props }: ComponentProps<typeof Link>) {
  return <Link className={buttonVariants({ className })} {...props} />;
}
