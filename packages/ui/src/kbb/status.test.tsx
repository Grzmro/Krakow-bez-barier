import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RELIABILITIES, STATUSES } from "../types";
import { FactRow } from "./fact-row";
import { ReliabilityBadge, SampleTag, StatusBadge } from "./status";

const LABELS = { source: "Źródło", acquired: "Pozyskano", noValue: "Brak danych", noSources: "Nikt nie sprawdził." };

describe("StatusBadge", () => {
  it.each(STATUSES)("shows %s as icon + text, not colour alone", (status) => {
    // GIVEN a status with its word
    // WHEN rendered
    const html = renderToStaticMarkup(<StatusBadge status={status} label={`word-${status}`} reason="3 stopnie" />);

    // THEN the word, the reason and a decorative icon are all present
    expect(html).toContain(`word-${status}`);
    expect(html).toContain("3 stopnie");
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/);
    expect(html).toContain(`data-status="${status}"`);
  });

  it("draws unknown with a dashed border so it never looks like a pass", () => {
    // GIVEN the unknown status
    // WHEN rendered
    const html = renderToStaticMarkup(<StatusBadge status="unknown" label="Brak danych" />);

    // THEN it is neutral and dashed, never green
    expect(html).toContain("border-dashed");
    expect(html).not.toContain("status-met");
  });
});

describe("ReliabilityBadge", () => {
  it.each(RELIABILITIES)("shows %s with a visible label", (value) => {
    // GIVEN a reliability value
    // WHEN rendered
    const html = renderToStaticMarkup(<ReliabilityBadge value={value} label={`rel-${value}`} />);

    // THEN its text label is visible next to the icon
    expect(html).toContain(`rel-${value}`);
    expect(html).toContain("<svg");
  });
});

describe("SampleTag", () => {
  it("has a spoken label for screen readers", () => {
    // GIVEN the PRZYKŁAD tag
    // WHEN rendered
    const html = renderToStaticMarkup(<SampleTag label="Przykład" ariaLabel="Dane przykładowe" />);

    // THEN both the visible and the spoken text are in the markup
    expect(html).toContain("Przykład");
    expect(html).toContain('class="sr-only">Dane przykładowe');
  });
});

describe("FactRow", () => {
  it("shows the value with its unit and keeps sources collapsed by default", () => {
    // GIVEN a known fact with one source
    // WHEN rendered closed
    const html = renderToStaticMarkup(
      <FactRow
        label="Drzwi"
        value="80"
        unit="cm"
        reliability={{ value: "confirmed", label: "Potwierdzone" }}
        sources={[{ name: "OpenStreetMap", date: "2026-09-12" }]}
        labels={LABELS}
      />,
    );

    // THEN the value is visible, the toggle is collapsed and the provenance panel hidden
    expect(html).toContain("80 cm");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toMatch(/<div id="[^"]+" hidden=""/);
    expect(html).toContain("OpenStreetMap");
  });

  it("says 'no data' instead of an empty value", () => {
    // GIVEN a fact nobody has checked
    // WHEN rendered open
    const html = renderToStaticMarkup(
      <FactRow
        label="Toaleta"
        reliability={{ value: "unknown", label: "Brak danych" }}
        sources={[]}
        labels={LABELS}
        defaultOpen
      />,
    );

    // THEN the no-value and no-sources texts are shown
    expect(html).toContain("Brak danych");
    expect(html).toContain("Nikt nie sprawdził.");
    expect(html).toContain('aria-expanded="true"');
  });
});
