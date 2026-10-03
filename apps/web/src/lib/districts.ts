/**
 * Kraków's 18 districts (dzielnice) in their official order, each with an approximate central point.
 * "W mojej okolicy" offers them when the device position is unavailable; the point is only a search
 * centre, so a few hundred metres off the geometric centroid doesn't matter.
 */
export const KRAKOW_DISTRICTS = [
  { id: "stare-miasto", name: "Stare Miasto", latitude: 50.0614, longitude: 19.9373 },
  { id: "grzegorzki", name: "Grzegórzki", latitude: 50.0598, longitude: 19.9615 },
  { id: "pradnik-czerwony", name: "Prądnik Czerwony", latitude: 50.0875, longitude: 19.9705 },
  { id: "pradnik-bialy", name: "Prądnik Biały", latitude: 50.0915, longitude: 19.9265 },
  { id: "krowodrza", name: "Krowodrza", latitude: 50.0745, longitude: 19.9205 },
  { id: "bronowice", name: "Bronowice", latitude: 50.0815, longitude: 19.8835 },
  { id: "zwierzyniec", name: "Zwierzyniec", latitude: 50.0555, longitude: 19.8775 },
  { id: "debniki", name: "Dębniki", latitude: 50.0365, longitude: 19.9045 },
  { id: "lagiewniki-borek-falecki", name: "Łagiewniki-Borek Fałęcki", latitude: 50.0225, longitude: 19.9345 },
  { id: "swoszowice", name: "Swoszowice", latitude: 49.9965, longitude: 19.9465 },
  { id: "podgorze-duchackie", name: "Podgórze Duchackie", latitude: 50.0185, longitude: 19.9625 },
  { id: "biezanow-prokocim", name: "Bieżanów-Prokocim", latitude: 50.0195, longitude: 20.0095 },
  { id: "podgorze", name: "Podgórze", latitude: 50.0435, longitude: 19.9575 },
  { id: "czyzyny", name: "Czyżyny", latitude: 50.0705, longitude: 20.0085 },
  { id: "mistrzejowice", name: "Mistrzejowice", latitude: 50.0975, longitude: 20.0055 },
  { id: "bienczyce", name: "Bieńczyce", latitude: 50.0855, longitude: 20.0245 },
  { id: "wzgorza-krzeslawickie", name: "Wzgórza Krzesławickie", latitude: 50.0955, longitude: 20.0595 },
  { id: "nowa-huta", name: "Nowa Huta", latitude: 50.0722, longitude: 20.0377 },
] as const;

export type District = (typeof KRAKOW_DISTRICTS)[number];
