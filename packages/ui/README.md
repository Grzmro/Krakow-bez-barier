# @krakow-bez-barier/ui

Front-end UI library for **Kraków bez barier**. It bundles the shared Material UI
theme and the root application providers (MUI App Router cache, theme, CSS
baseline and React Query) so every front-end surface stays consistent.

## Contents

- `theme` — the default Material UI theme.
- `Providers` — a client component that wires up MUI + React Query.

## Install

```bash
npm install @krakow-bez-barier/ui
```

The package expects the following peer dependencies to be installed in the host
app: `react`, `react-dom`, `@mui/material`, `@mui/material-nextjs`,
`@emotion/react`, `@emotion/styled` and `@tanstack/react-query`.

## Usage

Wrap your application with `Providers` (for example in a Next.js App Router
`layout.tsx`):

```tsx
import { Providers } from "@krakow-bez-barier/ui";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

Use the shared theme directly when you need it:

```tsx
import { theme } from "@krakow-bez-barier/ui";
```

## Development

```bash
npm install
npm run dev        # rebuild on change
npm run typecheck  # type-check without emitting
```
