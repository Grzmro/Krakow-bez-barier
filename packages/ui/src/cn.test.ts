import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("lets the later Tailwind class win on conflicts", () => {
    // GIVEN two padding classes and a falsy entry
    const classes = ["px-2", false, "px-4", "text-sm"];

    // WHEN merged
    const result = cn(...classes);

    // THEN only the last padding stays and falsy entries are dropped
    expect(result).toBe("px-4 text-sm");
  });

  it("treats the type-scale tokens as font sizes, not colours", () => {
    // GIVEN a type-scale size next to a text colour, and two sizes
    // WHEN merged
    // THEN the size and the colour both stay, and of two sizes the later wins
    expect(cn("text-body", "text-foreground")).toBe("text-body text-foreground");
    expect(cn("text-body", "text-[22px]")).toBe("text-[22px]");
  });
});
