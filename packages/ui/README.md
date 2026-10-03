# @krakow-bez-barier/ui

Shared UI for **Kraków bez barier**: the "Fiolet" design tokens, shared shadcn/ui components and the
app providers (React Query). Visual reference: [`design/prototype-b`](../../design/prototype-b).

Consumed as TypeScript source (no build step) — `apps/web` lists it in `transpilePackages`.

```css
/* apps/web/src/app/globals.css */
@import "tailwindcss";
@import "@krakow-bez-barier/ui/styles.css";
```

```tsx
import { Providers, cn } from "@krakow-bez-barier/ui";
```

## What's inside

| Export | Purpose |
|---|---|
| `Button`, `Badge` (status variants), `VaulDrawer*`, `Toaster` / `toast` | shadcn primitives restyled with "Fiolet" (Phosphor icons, no `next-themes`) |
| `StatusBadge`, `VerdictBlock`, `StatusIcon` | verdict `met / barrier / conflict / unknown` — icon + shape + text + colour |
| `ReliabilityBadge` | `confirmed / unverified / outdated / conflict / unknown` |
| `FactRow` | attribute, value with unit, verdict, reliability, expandable sources with dates |
| `BottomPanel` | non-modal sheet for map screens, two heights, toggled by a button |
| `SampleBanner`, `SampleTag` | "PRZYKŁAD" labelling |
| `LiveRegionProvider`, `useAnnounce` | the app's single polite `aria-live` region |

Components carry no copy: every text comes in as a prop. In `apps/web` use the wrappers from
`@/components/kbb`, which bind the Polish strings from `src/i18n/pl/common.ts`.
`src/contrast.test.ts` checks every token pair the components use against WCAG AA in both themes.
