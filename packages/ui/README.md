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
