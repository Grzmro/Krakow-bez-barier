# Prototype B — UI reference (shadcn/ui)

Clickable prototype the team chose as the visual and interaction reference for `apps/web`.
It is **not** part of the npm workspaces and not production code: sample data, a stylised
SVG map instead of MapLibre, no API. Port components and patterns from it; don't import it.

```bash
cd design/prototype-b
npm install
npm run dev      # http://localhost:5173
```

Published build: https://claude.ai/artifact/Gzu1Twtkxxq8eJLwjYWPXN

| What | Where |
|---|---|
| "Fiolet" tokens (light + dark) as shadcn CSS variables | `src/index.css` |
| Status/verdict badges, fact rows, reliability tags | `src/components/kbb/status.tsx`, `bits.tsx` |
| Non-modal bottom panel for map screens | `src/components/kbb/bottom-panel.tsx` |
| Vaul drawer (modal sheets, e.g. report form) | `src/components/ui/vaul-drawer.tsx` |
| Screens | `src/screens/*.tsx` |
| All Polish UI strings | `src/i18n/pl.ts` |
| Sample data and verdict logic (illustrative only) | `src/lib/data.ts` |

Screen spec and rationale: [`../concept.md`](../concept.md). Requirements win over the concept
where they differ: [`../../docs/requirements.md`](../../docs/requirements.md).
