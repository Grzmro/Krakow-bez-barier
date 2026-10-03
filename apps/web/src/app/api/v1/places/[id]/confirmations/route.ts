import { clientKey, createRateLimiter, defineRoute, HttpError, respond } from "@/server/http";
import { createConfirmation, reportsStore } from "@/server/reports";

const limiter = createRateLimiter({ limit: 30, windowMs: 10 * 60_000 });
// Confirmations count only when independent: one per fact per client a day.
const perFact = createRateLimiter({ limit: 1, windowMs: 24 * 60 * 60_000 });

export const POST = defineRoute(
  "createConfirmation",
  async ({ request, path, body }) => {
    const key = `${clientKey(request)}|${body.factId}`;
    const repeat = perFact.peek(key);
    if (!repeat.allowed) {
      throw new HttpError(429, {
        detail: "This fact was already confirmed from this device today.",
        headers: { "retry-after": String(repeat.retryAfterSeconds) },
      });
    }
    const confirmation = await createConfirmation(reportsStore(), path.id, body);
    perFact.check(key);
    return respond(201, confirmation);
  },
  { rateLimit: limiter },
);
