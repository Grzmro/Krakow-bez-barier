function copyWithSelection(text: string): boolean {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.setAttribute("aria-hidden", "true");
  area.style.cssText = "position:fixed;top:0;left:0;opacity:0;font-size:16px";
  const active = document.activeElement as HTMLElement | null;
  document.body.appendChild(area);
  try {
    area.focus({ preventScroll: true });
    area.select();
    area.setSelectionRange(0, text.length);
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
    active?.focus?.({ preventScroll: true });
  }
}

/** Copies text to the clipboard; `navigator.clipboard` exists only in secure contexts (HTTPS/localhost), so plain HTTP falls back to a selection + `execCommand`. Resolves to whether it worked. */
export async function copyText(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // permission denied or no user activation: try the selection fallback
    }
  }
  return typeof document !== "undefined" && copyWithSelection(text);
}
