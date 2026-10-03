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
     (numbers, booleans, comma-separated or repeated arrays) and spec defaults are applied.
   - Return with `respond(status, body, headers?)`: the compiler checks the body against that status.
   - Throw `HttpError(status, { detail, errors?, headers? })` for documented errors. Anything else
     becomes a generic `500` (details only in the server log).
4. **Test** next to the route (`route.test.ts`): build a `Request`, call the exported `GET`/`POST`,
   assert status and body, and assert `validateResponse(operationId, status, body)` is `[]`.
   Structure it `// GIVEN` / `// WHEN` / `// THEN`. Tests must not need a database: inject a fake into the
   service or stub `DATABASE_URL` like the health test.

## Notes

- Rate limits are in-memory, per server instance, keyed by the first `x-forwarded-for` hop; nothing is
  stored (R7). They stop bursts, not a global quota.
- Only `application/json` request bodies are supported; extend `openapi.ts` before adding another
  media type. Header and cookie parameters are not validated yet.
- Wrong content type, malformed JSON and spec mismatches are all `400` (the spec documents no `415`).
