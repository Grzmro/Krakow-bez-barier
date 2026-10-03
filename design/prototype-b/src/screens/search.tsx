import { CaretLeft, MapPin, Toilet, Train, type Icon } from "@phosphor-icons/react"
import { Command as CommandPrimitive } from "cmdk"
import { Button } from "@/components/ui/button"
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command"
import { pl } from "@/i18n/pl"

export type SearchPick = "rynek" | "dworzec" | "toilet"

const ITEMS: { id: SearchPick; label: string; sub: string; icon: Icon }[] = [
  { id: "rynek", label: pl.search.rynek[0], sub: pl.search.rynek[1], icon: MapPin },
  { id: "dworzec", label: pl.search.dworzec[0], sub: pl.search.dworzec[1], icon: Train },
  { id: "toilet", label: pl.search.toilet[0], sub: pl.search.toilet[1], icon: Toilet },
]

export function SearchScreen({ onClose, onPick }: { onClose: () => void; onPick: (p: SearchPick) => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={pl.search.dialog}
      className="screen-in absolute inset-0 z-40 bg-background"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <Command label={pl.search.label} className="rounded-none! bg-transparent p-0">
        <div className="flex items-center gap-2 px-4 pt-3">
          <Button variant="outline" size="icon" aria-label={pl.search.close} onClick={onClose} className="shrink-0 border-0 shadow-soft">
            <CaretLeft weight="bold" />
          </Button>
          <CommandPrimitive.Input
            autoFocus
            placeholder={pl.home.search}
            className="h-[52px] w-full rounded-full bg-card px-5 text-body shadow-float outline-none placeholder:text-muted-foreground focus-visible:outline-3 focus-visible:outline-ring"
          />
        </div>
        <CommandList className="mt-4 max-h-none px-2">
          <CommandGroup heading={pl.search.suggestions} className="**:[[cmdk-group-heading]]:px-3 **:[[cmdk-group-heading]]:text-caption">
            {ITEMS.map((it) => {
              const I = it.icon
              return (
                <CommandItem
                  key={it.id}
                  value={it.label}
                  onSelect={() => onPick(it.id)}
                  className="h-16 gap-3.5 rounded-2xl! px-3 text-body data-selected:bg-primary-container [&>svg:last-child]:hidden"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-card text-primary shadow-soft">
                    <I weight="duotone" className="size-[22px]!" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold">{it.label}</span>
                    <span className="block text-caption text-muted-foreground">{it.sub}</span>
                  </span>
                </CommandItem>
              )
            })}
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  )
}
