import type { OutageVote } from "@krakow-bez-barier/contracts";
import { clientKey, createRateLimiter } from "@/server/http";

/** Outage reports and votes per client, held in memory only (nothing about the client is stored). */
export const outageRequests = createRateLimiter({ limit: 20, windowMs: 10 * 60_000 });

// Votes count only when independent: one of each kind per outage per client a day. Shared by both routes, so a
// report that opens or confirms an outage also uses up that client's "still broken" vote on it.
const perOutage = createRateLimiter({ limit: 1, windowMs: 24 * 60 * 60_000 });

const key = (request: Request, outageId: string, vote: OutageVote) => `${clientKey(request)}|${outageId}|${vote}`;

export const outageVotes = {
  peek: (request: Request, outageId: string, vote: OutageVote) => perOutage.peek(key(request, outageId, vote)),
  record: (request: Request, outageId: string, vote: OutageVote) => perOutage.check(key(request, outageId, vote)),
};
