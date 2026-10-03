import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText } from "./copy-text";

function stubDocument(execResult: boolean | Error) {
  const area = {
    value: "",
    style: {} as Record<string, string>,
    setAttribute: vi.fn(),
    focus: vi.fn(),
    select: vi.fn(),
    setSelectionRange: vi.fn(),
    remove: vi.fn(),
  };
  const execCommand = vi.fn(() => {
    if (execResult instanceof Error) throw execResult;
    return execResult;
  });
  vi.stubGlobal("document", {
    activeElement: null,
    body: { appendChild: vi.fn() },
    createElement: vi.fn(() => area),
    execCommand,
  });
  return { area, execCommand };
}

afterEach(() => vi.unstubAllGlobals());

describe("copyText", () => {
  it("uses the Clipboard API when it is available", async () => {
    // GIVEN a secure context
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    // WHEN copying
    const ok = await copyText("<iframe>");
    // THEN the API was used
    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith("<iframe>");
  });

  it("falls back to a selection when navigator.clipboard is missing (plain HTTP)", async () => {
    // GIVEN an insecure context without the Clipboard API
    vi.stubGlobal("navigator", {});
    const { area, execCommand } = stubDocument(true);
    // WHEN copying
    const ok = await copyText("<iframe>");
    // THEN the text was selected and copied through execCommand, and the helper cleaned up
    expect(ok).toBe(true);
    expect(area.value).toBe("<iframe>");
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(area.remove).toHaveBeenCalled();
  });

  it("falls back when the Clipboard API rejects", async () => {
    // GIVEN a Clipboard API that is denied
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    stubDocument(true);
    // WHEN copying
    // THEN the fallback succeeds
    expect(await copyText("x")).toBe(true);
  });

  it("reports failure when both paths fail", async () => {
    // GIVEN no Clipboard API and a refusing execCommand
    vi.stubGlobal("navigator", {});
    stubDocument(new Error("blocked"));
    // WHEN copying
    // THEN it resolves to false instead of throwing
    expect(await copyText("x")).toBe(false);
  });
});
