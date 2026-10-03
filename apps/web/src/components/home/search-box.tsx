"use client";

import { useState } from "react";
import { MagnifyingGlass, MapPin, X } from "@phosphor-icons/react";
import { Autocomplete } from "@base-ui/react/autocomplete";
import { cn } from "@krakow-bez-barier/ui";
import { useMessages } from "@/i18n/client";
import { useSpeechInput } from "@/lib/use-speech-input";
import { VoiceButton } from "./voice-button";

export const SEARCH_INPUT_ID = "place-search";

export interface SearchBoxProps {
  value: string;
  onValueChange: (value: string) => void;
  /** Place names matching the current query, shown as suggestions. */
  suggestions: string[];
  /**
   * Offered the dictated text and the text typed when Enter is pressed; returns true when it was a command
   * ("najbliższa toaleta") and handled it, so the field is not filled with the command.
   */
  onCommand?: (text: string) => boolean;
}

/** Search field (combobox) with place-name suggestions; the list below updates as you type. */
export function SearchBox({ value, onValueChange, suggestions, onCommand }: SearchBoxProps) {
  const t = useMessages().home.search;
  const [open, setOpen] = useState(false);
  // An open popup hides the rest of the page from assistive tech, so keep it closed when it
  // has nothing to add (no matches, or the field already holds the only match).
  const useful = suggestions.some((name) => name !== value);
  const speech = useSpeechInput((text, final) => {
    if (final && onCommand?.(text)) onValueChange("");
    else onValueChange(text);
  });
  return (
    <Autocomplete.Root
      items={suggestions}
      value={value}
      onValueChange={(next) => onValueChange(next)}
      open={open && useful}
      onOpenChange={setOpen}
      filter={null}
    >
      <div role="search" className="relative flex h-[52px] min-w-0 flex-1 items-center rounded-full bg-card shadow-float">
        <MagnifyingGlass className="pointer-events-none absolute left-5 size-[22px] text-foreground" aria-hidden />
        <label htmlFor={SEARCH_INPUT_ID} className="sr-only">
          {t.label}
        </label>
        <Autocomplete.Input
          id={SEARCH_INPUT_ID}
          onKeyDown={(event) => {
            if (event.key === "Enter" && onCommand?.(value)) {
              event.preventDefault();
              onValueChange("");
            }
          }}
          placeholder={speech.active ? t.voice[speech.state === "processing" ? "processing" : "listening"] : t.placeholder}
          className={cn(
            "size-full rounded-full bg-transparent pl-13 text-body outline-none placeholder:text-muted-foreground focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring",
            speech.supported && value ? "pr-24" : "pr-14",
          )}
        />
        <div className="absolute right-1.5 flex items-center gap-1">
          {speech.supported ? <VoiceButton speech={speech} /> : null}
          {value ? (
            <button
              type="button"
              aria-label={t.clear}
              onClick={() => onValueChange("")}
              className="grid size-10 place-items-center rounded-full hover:bg-muted"
            >
              <X weight="bold" className="size-5" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
      <Autocomplete.Portal>
        <Autocomplete.Positioner sideOffset={8} className="z-50 outline-none">
          <Autocomplete.Popup
            aria-label={t.suggestions}
            className="w-(--anchor-width) max-w-(--available-width) overflow-hidden rounded-3xl bg-card py-2 text-card-foreground shadow-float ring-1 ring-border data-empty:hidden"
          >
            <Autocomplete.List className="max-h-[min(20rem,var(--available-height))] overflow-y-auto">
              {(name: string) => (
                <Autocomplete.Item
                  key={name}
                  value={name}
                  className="flex min-h-12 cursor-default items-center gap-3 px-4 text-body outline-none select-none data-highlighted:bg-primary-container"
                >
                  <MapPin weight="duotone" className="size-5 shrink-0 text-primary" aria-hidden />
                  {name}
                </Autocomplete.Item>
              )}
            </Autocomplete.List>
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </Autocomplete.Root>
  );
}
