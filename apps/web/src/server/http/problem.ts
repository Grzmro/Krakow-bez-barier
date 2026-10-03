import type { Problem } from "@krakow-bez-barier/contracts";

// Problem `type` URIs are identifiers (RFC 9457 §3.1.1), not endpoints; this base matches the spec's examples.
const PROBLEM_TYPE_BASE = "https://krakow-bez-barier.example/problems/";

const TITLES: Record<number, { slug: string; title: string }> = {
  400: { slug: "bad-request", title: "Bad request" },
  401: { slug: "unauthorized", title: "Unauthorized" },
  403: { slug: "forbidden", title: "Forbidden" },
  404: { slug: "not-found", title: "Not found" },
  422: { slug: "unprocessable", title: "Unprocessable" },
  429: { slug: "rate-limited", title: "Too many requests" },
  500: { slug: "internal", title: "Internal server error" },
  502: { slug: "upstream-unavailable", title: "Upstream unavailable" },
};

export type ProblemInit = Partial<Omit<Problem, "status">> & { headers?: HeadersInit };

/** Throw from a handler to answer with an RFC 9457 problem; `defineRoute` turns it into the response. */
export class HttpError extends Error {
  readonly problem: Problem;
  readonly headers: HeadersInit | undefined;

  constructor(status: number, init: ProblemInit = {}) {
    const { headers, ...fields } = init;
    const known = TITLES[status] ?? TITLES[status >= 500 ? 500 : 400];
    const problem: Problem = {
      type: fields.type ?? `${PROBLEM_TYPE_BASE}${known.slug}`,
      title: fields.title ?? known.title,
      status,
      ...(fields.detail !== undefined && { detail: fields.detail }),
      ...(fields.instance !== undefined && { instance: fields.instance }),
      ...(fields.errors !== undefined && { errors: fields.errors }),
    };
    super(problem.detail ?? problem.title);
    this.name = "HttpError";
    this.problem = problem;
    this.headers = headers;
  }
}

export function problemResponse(problem: Problem, headers?: HeadersInit): Response {
  const res = Response.json(problem, { status: problem.status, headers });
  res.headers.set("content-type", "application/problem+json");
  return res;
}
