import { clientKey, createRateLimiter, defineRoute, HttpError, respond } from "@/server/http";
import { reportsStore, submitConfirmation } from "@/server/reports";

const limiter = createRateLimiter({ limit: 30, windowMs: 10 * 60_000 });
// Confirmations count only when independent: one per fact per client a day.
const perFact = createRateLimiter({ limit: 1, windowMs: 24 * 60 * 60_000 });

export const POST = defineRoute(
  "createConfirmation",
  async ({ request, path, header, body }) => {
    const key = `${clientKey(request)}|${body.factId}`;
    const { confirmation, created } = await submitConfirmation(reportsStore(), path.id, body, {
      contributorToken: header["X-Contributor-Token"],
      admit: () => {
        const repeat = perFact.peek(key);
        if (!repeat.allowed) {
          throw new HttpError(429, {
            detail: "This fact was already confirmed from this device today.",
            headers: { "retry-after": String(repeat.retryAfterSeconds) },
          });
        }
      },
    });
    if (!created) return respond(200, confirmation);
    perFact.check(key);
    return respond(201, confirmation);
  },
  { rateLimit: limiter },
);
