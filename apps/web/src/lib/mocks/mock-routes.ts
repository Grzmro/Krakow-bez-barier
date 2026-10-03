// TODO(KBB-46): delete with the rest of the mock layer once the front runs on the real API by default.
// `POST /routes` needs no database, so even the example-data mode sends it to the real endpoint: openrouteservice
// with ORS_API_KEY on the server, the recorded Dworzec Główny → Rynek Główny answers without it.

type Fetch = (input: Request) => Promise<Response>;

export const withRealRoutes =
  (mock: Fetch, real: Fetch = (input) => fetch(input)): Fetch =>
  (input) => {
    const path = new URL(input.url, "http://mock.local").pathname.replace(/^.*\/api\/v1/, "");
    return input.method === "POST" && path === "/routes" ? real(input) : mock(input);
  };
