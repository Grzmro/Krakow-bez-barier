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
});
