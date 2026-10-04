"use client";

import { useRef, useState } from "react";
import { MagnifyingGlass, MapPin } from "@phosphor-icons/react";
import { Autocomplete } from "@base-ui/react/autocomplete";
import { cn, ComboboxPopup, InputClearButton, InputGroup, inputControlClass, optionClass } from "@krakow-bez-barier/ui";
import { useMessages } from "@/i18n/client";
import { categoryIcon } from "@/lib/categories";
import { useSpeechInput } from "@/lib/use-speech-input";
import { VoiceButton } from "./voice-button";

export const SEARCH_INPUT_ID = "place-search";

/** A category the typed text names, or a place name matching it. */
export type SearchSuggestion =
  | { kind: "category"; id: string; label: string; icon?: string }
  | { kind: "place"; name: string };

const suggestionKey = (item: SearchSuggestion) => (item.kind === "category" ? `category:${item.id}` : `place:${item.name}`);
// Choosing a category must not leave its name in the field: the chip shows it.
const suggestionText = (item: SearchSuggestion) => (item.kind === "category" ? "" : item.name);

export interface SearchBoxProps {
  value: string;
  onValueChange: (value: string) => void;
  /** Categories the text names first, then place names matching it. */
  suggestions: SearchSuggestion[];
  /** A category suggestion was chosen (click, or Enter on the highlighted one). */
  onPickCategory: (id: string) => void;
  /** A place name suggestion was chosen (click, or Enter on the highlighted one): search for it now. */
  onPickPlace?: (name: string) => void;
  /** Enter was pressed (or dictation ended) and it was not a command: run the search for that text. */
  onSubmit?: (text: string) => void;
  /** The clear button was pressed: the text is gone, and so is the search for it. */
  onClear?: () => void;
  /**
   * Offered the dictated text and the text typed when Enter is pressed; returns true when it was a command
   * ("najbliższa toaleta") and handled it, so the field is not filled with the command.
   */
  onCommand?: (text: string) => boolean;
}

/** Search field (combobox) with place-name suggestions; typing only suggests, Enter or a suggestion searches. */
export function SearchBox({ value, onValueChange, suggestions, onPickCategory, onPickPlace, onSubmit, onClear, onCommand }: SearchBoxProps) {
  const t = useMessages().home.search;
  const [open, setOpen] = useState(false);
  // An open popup hides the rest of the page from assistive tech, so keep it closed when it
  // has nothing to add (no matches, or the field already holds the only match).
  const useful = suggestions.some((item) => item.kind === "category" || item.name !== value);
  const highlighted = useRef(false);
  const speech = useSpeechInput((text, final) => {
    if (final && onCommand?.(text)) onValueChange("");
    else {
      onValueChange(text);
      if (final) onSubmit?.(text);
    }
  });
  return (
    <Autocomplete.Root
      items={suggestions}
      itemToStringValue={suggestionText}
      onItemHighlighted={(item) => {
        highlighted.current = Boolean(item);
      }}
      value={value}
      onValueChange={(next, details) => {
        onValueChange(next);
        if (details.reason === "item-press" && next) onPickPlace?.(next);
      }}
      open={open && useful}
      onOpenChange={setOpen}
      filter={null}
    >
      {/* The group is the popup's anchor, so the suggestions are as wide as the whole pill. */}
      <Autocomplete.InputGroup role="search" className="flex min-w-0 flex-1">
        <label htmlFor={SEARCH_INPUT_ID} className="sr-only">
          {t.label}
        </label>
        <InputGroup
          variant="floating"
          size="floating"
          startIcon={<MagnifyingGlass className="size-[22px]" />}
          end={
            speech.supported || value ? (
              <>
                {speech.supported ? <VoiceButton speech={speech} /> : null}
                {value ? (
                  <InputClearButton
                    label={t.clear}
                    onClick={() => {
                      onValueChange("");
                      onClear?.();
                    }}
                  />
                ) : null}
              </>
            ) : null
          }
        >
          <Autocomplete.Input
            id={SEARCH_INPUT_ID}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || highlighted.current) return;
              if (onCommand?.(value)) {
                event.preventDefault();
                onValueChange("");
              } else onSubmit?.(value);
            }}
            placeholder={speech.active ? t.voice[speech.state === "processing" ? "processing" : "listening"] : t.placeholder}
            className={cn(inputControlClass, !speech.supported && !value && "pr-5")}
          />
        </InputGroup>
      </Autocomplete.InputGroup>
      <ComboboxPopup label={t.suggestions}>
        {(item: SearchSuggestion) => {
          const Icon = item.kind === "category" ? categoryIcon(item.icon) : MapPin;
          return (
            <Autocomplete.Item
              key={suggestionKey(item)}
              value={item}
              onClick={item.kind === "category" ? () => onPickCategory(item.id) : undefined}
              className={optionClass}
            >
              <Icon weight="duotone" className="size-5 shrink-0 text-primary" aria-hidden />
              {item.kind === "category" ? <span className="font-semibold">{t.categorySuggestion(item.label)}</span> : item.name}
            </Autocomplete.Item>
          );
        }}
      </ComboboxPopup>
    </Autocomplete.Root>
  );
}
