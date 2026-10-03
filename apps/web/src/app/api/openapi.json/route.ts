import { openapiDocument } from "@krakow-bez-barier/contracts/openapi";

export const dynamic = "force-static";

/** The contract itself, for API clients and the Scalar reference at /api/docs. */
export function GET() {
  return Response.json(openapiDocument, {
    headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" },
  });
}
