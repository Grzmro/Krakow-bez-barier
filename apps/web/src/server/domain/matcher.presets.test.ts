import { describe, expect, it } from "vitest";
import { responseExamples, type AccessibilityAttribute, type Place, type ResolvedAttribute } from "@krakow-bez-barier/contracts";
import { matchProfile } from "./matcher";
import { PROFILE_PRESETS } from "./profiles";

type Option = "none" | "yes" | "no" | "conflict";
const OPTIONS: Option[] = ["none", "yes", "no", "conflict"];

function attribute(name: AccessibilityAttribute, option: Option): ResolvedAttribute[] {
  if (option === "none") return [];
  if (option === "conflict") return [{ attribute: name, state: "conflict", status: "conflict", value: null, facts: [] }];
  const value =
    name === "surface"
      ? { kind: "text" as const, text: option === "yes" ? "asphalt" : "sett" }
      : { kind: "boolean" as const, boolean: option === "yes" };
  return [{ attribute: name, state: "known", status: "confirmed", value, facts: [] }];
}

const entrance: ResolvedAttribute[] = [
  { attribute: "step_count", state: "known", status: "confirmed", value: { kind: "number", number: 0 }, facts: [] },
  { attribute: "threshold_cm", state: "known", status: "unverified", value: { kind: "number", number: 1 }, facts: [] },
  { attribute: "door_width_cm", state: "known", status: "confirmed", value: { kind: "number", number: 95 }, facts: [] },
];

const OPTIONAL: AccessibilityAttribute[] = ["lift", "toilet_accessible", "surface", "changing_table", "bench"];

/** Every combination of the optional facility attributes on top of a passing entrance. */
function combinations(): [string, Pick<Place, "attributes">][] {
  let cases: [string, ResolvedAttribute[]][] = [["", entrance]];
  for (const name of OPTIONAL) {
    cases = cases.flatMap(([key, attributes]) =>
      OPTIONS.map((option): [string, ResolvedAttribute[]] => [`${key}${name}=${option} `, [...attributes, ...attribute(name, option)]]),
    );
  }
  return cases.map(([key, attributes]) => [key.trim(), { attributes }]);
}

const examples = Object.values(responseExamples.getPlace[200]).map((place): [string, Pick<Place, "attributes">] => [place.id, place]);

describe("profile presets", () => {
  it("keep their verdicts over every facility-data combination", () => {
    // GIVEN the spec's example places and every combination of facility data
    const places = [...examples, ...combinations()];
    // WHEN each is matched against the wheelchair and stroller presets
    const verdicts = Object.fromEntries(
      places.flatMap(([key, place]) =>
        (["wheelchair", "stroller"] as const).map((profile) => {
          const { state, unconfirmed, reasons, blockers, unknowns, needs } = matchProfile(place, PROFILE_PRESETS[profile], "pl");
          const perNeed = needs?.map((n) => `${n.need}:${n.attribute}:${n.state}${n.unconfirmed ? "?" : ""}`).join(",");
          return [`${profile} ${key}`, `${state}${unconfirmed ? "?" : ""} | ${reasons.join(";")} | ${blockers?.join(",")} | ${unknowns?.join(",")} | ${perNeed}`];
        }),
      ),
    );
    // THEN they match the verdicts recorded before the refactor
    expect(verdicts).toMatchSnapshot();
  });
});
