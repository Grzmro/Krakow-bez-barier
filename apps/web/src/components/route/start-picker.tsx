"use client";

import { useState } from "react";
import { CaretDown, Check, Crosshair, MapPin, Train, type IconProps } from "@phosphor-icons/react";
import { Combobox } from "@base-ui/react/combobox";
import { SampleTag } from "@/components/kbb";
import { useMessages } from "@/i18n/client";
import { usePlaces } from "@/lib/places";
import type { RouteStart } from "@/lib/route-start";
import { useDebounced } from "@/lib/use-debounced";

/** What picking an option asks for: a start, or `locate` = find the device position first. */
export type StartPick = RouteStart | { kind: "locate" };

/** `sample`: a place from the example data, labelled PRZYKŁAD like everywhere else. */
export type StartOption = { value: string; label: string; pick: StartPick; hint?: string; sample?: boolean };

const SEARCH_MIN = 2;
const SEARCH_LIMIT = 6;

function StartIcon({ pick, ...props }: { pick: StartPick } & IconProps) {
  if (pick.kind === "locate" || pick.kind === "me") return <Crosshair {...props} />;
  return pick.kind === "station" ? <Train {...props} /> : <MapPin {...props} />;
}

/**
 * The route's start as a combobox: "Moja lokalizacja", Dworzec Główny, or a place from our database found by name
 * (`GET /places?q=`, the home screen's search). Typing searches; Escape or leaving the field restores the current start.
 */
export function StartPicker({
  id,
  label,
  current,
  onPick,
}: {
  id: string;
  label: string;
  current: StartOption;
  onPick: (pick: StartPick) => void;
}) {
  const t = useMessages().route;
  const [input, setInput] = useState(current.label);
  const [shown, setShown] = useState(current.label);
  // The current start can change from outside (a place name loads, locating fails): the field follows it.
  if (shown !== current.label) {
    setShown(current.label);
    setInput(current.label);
  }

  const typed = input.trim();
  const q = useDebounced(typed);
  const searching = q.length >= SEARCH_MIN && q !== current.label;
  const places = usePlaces({ q, limit: SEARCH_LIMIT }, { enabled: searching });
  const found: StartOption[] = searching
    ? (places.data?.items ?? []).map((place) => ({
        value: `place:${place.id}`,
        label: place.name,
        hint: place.address?.street ?? undefined,
        sample: place.isSample,
        pick: { kind: "place", id: place.id, name: place.name, position: place.location.coordinates as [number, number] },
      }))
    : [];
  const items: StartOption[] = [
    { value: "me", label: t.start.me, hint: t.start.meHint, pick: { kind: "locate" } },
    { value: "station", label: t.places.dworzec, pick: { kind: "station" } },
    ...found,
  ];
  const nothingFound = searching && places.isSuccess && !places.isPlaceholderData && found.length === 0;

  return (
    <Combobox.Root<StartOption>
      items={items}
      filter={null}
      value={current}
      onValueChange={(option) => {
        if (!option) return;
        setInput(option.label);
        onPick(option.pick);
      }}
      isItemEqualToValue={(a, b) => a.value === b.value}
      itemToStringLabel={(option) => option.label}
      inputValue={input}
      onInputValueChange={setInput}
      onOpenChange={(open) => {
        if (!open) setInput(current.label);
      }}
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink text-ink-foreground">
        <StartIcon pick={current.pick} weight="bold" className="size-4" aria-hidden />
      </span>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Combobox.Input
        id={id}
        placeholder={t.start.placeholder}
        onFocus={(event) => event.currentTarget.select()}
        className="h-10 min-w-0 flex-1 truncate rounded-xl bg-transparent px-1 text-body font-semibold outline-none placeholder:font-normal placeholder:text-muted-foreground focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
      />
      <CaretDown weight="bold" className="pointer-events-none -ml-2 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={8} className="z-50 outline-none">
          <Combobox.Popup
            aria-label={t.start.options}
            className="w-(--anchor-width) min-w-72 max-w-(--available-width) overflow-hidden rounded-3xl bg-card py-2 text-card-foreground shadow-float ring-1 ring-border"
          >
            <Combobox.List className="max-h-[min(22rem,var(--available-height))] overflow-y-auto">
              {(option: StartOption) => (
                <Combobox.Item
                  key={option.value}
                  value={option}
                  className="flex min-h-12 cursor-default items-center gap-3 px-4 py-2 text-body outline-none select-none data-highlighted:bg-primary-container"
                >
                  <StartIcon pick={option.pick} weight="duotone" className="size-5 shrink-0 text-primary" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{option.label}</span>
                    {option.hint ? <span className="block text-caption text-muted-foreground">{option.hint}</span> : null}
                  </span>
                  {option.sample ? <SampleTag /> : null}
                  <Combobox.ItemIndicator>
                    <Check weight="bold" className="size-4 text-primary" aria-hidden />
                  </Combobox.ItemIndicator>
                </Combobox.Item>
              )}
            </Combobox.List>
            {nothingFound ? <p className="px-4 pt-2 pb-1 text-body-sm text-muted-foreground">{t.start.empty}</p> : null}
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
