# server/http — how to add an endpoint

Every route handler goes through `defineRoute(operationId, handler, options)`. It validates the
request against `packages/contracts/openapi.yaml` (Ajv, JSON Schema 2020-12), turns errors into
RFC 9457 `Problem` responses and, outside production, checks your response against the spec too.

Reference: [`app/api/v1/health/route.ts`](../../app/api/v1/health/route.ts) and its test.

## Steps

1. **Spec first.** Add or change the operation in `openapi.yaml` (operationId, summary, `400`/`429`/`500`
   responses), then `npm run contracts:generate`.
2. **Service.** Put the logic in `src/server/<area>.ts` (Server Components call it directly). Read the DB
   with `getDb()` from `src/server/db.ts`; map rows to contract types explicitly.
3. **Route** at `src/app/api/v1/<spec path>/route.ts` (`{id}` → `[id]`):

   ```ts
   import { createRateLimiter, defineRoute, HttpError, respond } from "@/server/http";

   const limiter = createRateLimiter({ limit: 60, windowMs: 60_000 }); // optional, needs a 429 in the spec

   export const GET = defineRoute(
     "getPlace",
     async ({ path, query }) => {
       const place = await findPlace(path.id, query.profile);
       if (!place) throw new HttpError(404, { detail: `Place "${path.id}" does not exist.` });
       return respond(200, place);
     },
     { rateLimit: limiter },
   );
   ```

   - `path`, `query`, `body` are typed from the spec and already validated; query values are coerced
     (numbers, booleans, comma-separated or repeated arrays) and spec defaults are applied, so a
     defaulted param like `limit` is always set at runtime even though its type says optional — don't
     repeat the default in code. JSON bodies are not coerced: `"2"` for a number is a `400`.
   - Return with `respond(status, body, headers?)`: the compiler checks the body's type against that
     status. Extra properties slip through the type check (e.g. a DB row), so type your service's return
     value as the contract type; response validation in dev/tests catches the rest.
   - Throw `HttpError(status, { detail, errors?, headers? })` for documented errors. Anything else
     becomes a generic `500` (details only in the server log).
4. **Test** next to the route (`route.test.ts`): build a `Request`, call the exported `GET`/`POST`,
   assert status and body, and assert `validateResponse(operationId, status, body)` is `[]`.
   Structure it `// GIVEN` / `// WHEN` / `// THEN`. Tests must not need a database: inject a fake into the
   service or stub `DATABASE_URL` like the health test.

## Notes

- Rate limits are in-memory, per server instance, keyed by `clientKey` — `x-vercel-forwarded-for`, else
  the last `x-forwarded-for` hop (the one the nearest proxy appended); nothing is stored (R7). They stop bursts, not a
  global quota. This trusts the hosting proxy (Vercel); without one the headers are client-controlled. Locally and in e2e every request shares one bucket
  (`127.0.0.1`): keep limits generous enough for a parallel Playwright run.
- Only `application/json` request bodies up to 64 KB are supported; extend `openapi.ts` before adding
  another media type. Header and cookie parameters are not validated yet.
- Wrong content type, oversized or malformed JSON and spec mismatches are all `400` (the spec documents
  no `413`/`415`).
- Outside production, a thrown `HttpError` with a status the operation doesn't document becomes a `500`
  too — add the response to the spec instead.
