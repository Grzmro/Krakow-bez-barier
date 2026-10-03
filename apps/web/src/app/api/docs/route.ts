export const dynamic = "force-static";

const SCALAR_VERSION = "1.72.4";
const SCALAR_SRI = "sha384-omTRdD9MbjA1vm12DqRUVvqJlr3VzSixvAdF1Jruu9AJOiJKyTKraIB6DyX+m10M";

const html = `<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Kraków bez barier — API</title>
</head>
<body>
  <script id="api-reference" data-url="/api/openapi.json"></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@${SCALAR_VERSION}/dist/browser/standalone.js" integrity="${SCALAR_SRI}" crossorigin="anonymous"></script>
</body>
</html>
`;

/** Interactive reference (Scalar) rendered from the spec served at /api/openapi.json. */
export function GET() {
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=3600",
    },
  });
}
