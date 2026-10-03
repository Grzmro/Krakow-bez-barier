// `POST /routes` and `GET /transit/departures` need no database, so even the example-data mode sends them to the
// real endpoints: openrouteservice with ORS_API_KEY on the server, the recorded Dworzec Główny → Rynek answers
// without it; the ZTP feed as `TRANSIT_FEED` says (the e2e servers use the recording).

type Fetch = (input: Request) => Promise<Response>;

const REAL = new Set(["POST /routes", "GET /transit/departures"]);

export const withRealRoutes =
  (mock: Fetch, real: Fetch = (input) => fetch(input)): Fetch =>
  (input) => {
    const path = new URL(input.url, "http://mock.local").pathname.replace(/^.*\/api\/v1/, "");
    return REAL.has(`${input.method} ${path}`) ? real(input) : mock(input);
  };
