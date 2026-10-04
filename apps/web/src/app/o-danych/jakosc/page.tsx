import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { categories as categoryConfig, type DataQualityReport } from "@krakow-bez-barier/contracts";
import { SampleTag } from "@/components/kbb";
import { InfoPage, InfoSection } from "@/components/layout/info-page";
import { percent } from "@/domain/data-quality";
import { getLocale } from "@/i18n/server";
import { messagesFor } from "@/i18n/messages";
import { isMockApi } from "@/lib/api";
import { routes } from "@/lib/routes";

// Computed from the database on every request: the page states when its numbers were computed.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const m = messagesFor(await getLocale());
  return { title: `${m.quality.title} · ${m.common.app.name}` };
}

async function loadReport(): Promise<DataQualityReport | null> {
  try {
    if (isMockApi) {
      // Example-data mode (no database): the same aggregation over the spec's example places.
      const [{ dataQuality }, { CITY_EXCLUDED_CATEGORIES }, { EXAMPLE_PLACES }] = await Promise.all([
        import("@/domain/data-quality"),
        import("@/domain/city-stats"),
        import("@/lib/mocks/mock-api"),
      ]);
      return dataQuality(
        EXAMPLE_PLACES.filter((p) => !CITY_EXCLUDED_CATEGORIES.includes(p.category)),
        { isSample: true },
      );
    }
    const { getDataQuality } = await import("@/server/data-quality/service");
    return await getDataQuality();
  } catch (error) {
    console.error("data quality report failed", error);
    return null;
  }
}

const th = "border-b border-border px-3 py-2 text-left font-semibold text-muted-foreground";
const td = "border-b border-border px-3 py-2 align-top tabular-nums";
const rowTh = "border-b border-border px-3 py-2 text-left align-top font-semibold";

function DataTable({ caption, head, children }: { caption: string; head: string[]; children: ReactNode }) {
  return (
    <div
      role="region"
      aria-label={caption}
      tabIndex={0}
      className="overflow-x-auto rounded-[20px] bg-surface-raised ring-1 ring-border/70 focus-visible:outline-3 focus-visible:outline-offset-2"
    >
      <table className="w-full min-w-[32rem] border-collapse text-body-sm">
        <caption className="px-3 pt-3 pb-1 text-left text-caption text-muted-foreground">{caption}</caption>
        <thead>
          <tr>
            {head.map((label) => (
              <th key={label} scope="col" className={th}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export default async function DataQualityPage() {
  const locale = await getLocale();
  const m = messagesFor(locale);
  const t = m.quality;
  const report = await loadReport();
  const number = new Intl.NumberFormat(locale);
  const n = (value: number) => number.format(value);
  const date = (iso: string) =>
    new Intl.DateTimeFormat(t.dateLocale, { dateStyle: "medium", timeStyle: "short", timeZone: t.timeZone }).format(new Date(iso));
  const categoryNames = m.place.categoryNames as Record<string, { label: string } | undefined>;
  const categoryLabel = (id: string) => categoryNames[id]?.label ?? categoryConfig.find((c) => c.id === id)?.label ?? id;
  const attributeLabels = m.common.attribute as Record<string, string>;
  const age = (days: number | null) => (days === null ? t.none : t.summary.days(days));

  if (!report) {
    return (
      <InfoPage title={t.title} backLabel={m.pages.back} width="wide">
        <p role="alert" className="mt-2 rounded-[20px] bg-status-barrier-bg p-4 text-body-sm text-status-barrier">
          {t.unavailable}
        </p>
      </InfoPage>
    );
  }

  const { places, facts } = report;
  const gaps = report.categories.filter((c) => c.withoutData > 0).slice(0, 5);
  const tiles: { label: string; value: string; sub?: string }[] = [
    { label: t.summary.places, value: n(places.total) },
    { label: t.summary.withData, value: n(places.withData), sub: t.summary.share(percent(places.withData, places.total)) },
    { label: t.summary.withoutData, value: n(places.withoutData), sub: t.summary.share(percent(places.withoutData, places.total)) },
    { label: t.summary.facts, value: n(facts.total) },
    { label: t.summary.medianAge, value: age(facts.medianAgeDays) },
    { label: t.summary.conflicts, value: n(report.conflicts.places) },
    { label: t.summary.stale, value: n(report.staleData.places) },
  ];

  return (
    <InfoPage title={t.title} backLabel={m.pages.back} width="wide" aside={report.isSample ? <SampleTag className="shrink-0" /> : undefined}>
      <p className="max-w-3xl text-body text-foreground/85">{t.lead}</p>
      <p className="mt-2 text-caption text-muted-foreground">
        <time dateTime={report.generatedAt}>{t.computedAt(date(report.generatedAt))}</time>
        {" · "}
        {report.isSample ? t.sampleNote : t.realOnly}
      </p>
      <p className="mt-2">
        <Link href={routes.aboutData} className="inline-flex min-h-6 items-center font-semibold text-primary underline underline-offset-2">
          {t.backToAbout}
        </Link>
      </p>

      <InfoSection title={t.summary.heading}>
        <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {tiles.map((tile) => (
            <div key={tile.label} className="flex flex-col rounded-[20px] bg-surface-raised p-4 ring-1 ring-border/70">
              <dt className="text-caption text-muted-foreground">{tile.label}</dt>
              <dd className="mt-1 font-display text-h2 font-bold tabular-nums">{tile.value}</dd>
              {tile.sub ? <dd className="text-caption text-muted-foreground">{tile.sub}</dd> : null}
            </div>
          ))}
        </dl>
      </InfoSection>

      <InfoSection title={t.coverage.heading}>
        {report.categories.length === 0 ? (
          <p className="text-body-sm text-foreground/85">{t.coverage.empty}</p>
        ) : (
          <DataTable
            caption={t.coverage.caption}
            head={[
              t.coverage.category,
              t.coverage.places,
              t.coverage.withData,
              t.coverage.share,
              t.coverage.withoutData,
              t.coverage.conflicts,
              t.coverage.stale,
              t.coverage.medianAge,
            ]}
          >
            {report.categories.map((c) => (
              <tr key={c.category}>
                <th scope="row" className={rowTh}>
                  {categoryLabel(c.category)}
                </th>
                <td className={td}>{n(c.places)}</td>
                <td className={td}>{n(c.withData)}</td>
                <td className={td}>{percent(c.withData, c.places)}%</td>
                <td className={td}>{n(c.withoutData)}</td>
                <td className={td}>{n(c.conflictAttributes)}</td>
                <td className={td}>{n(c.staleAttributes)}</td>
                <td className={td}>{age(c.medianAgeDays)}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </InfoSection>

      <InfoSection title={t.gaps.heading}>
        <p className="text-body-sm text-foreground/85">{t.gaps.lead}</p>
        {gaps.length === 0 ? (
          <p className="mt-2 text-body-sm text-foreground/85">{t.gaps.none}</p>
        ) : (
          <ol className="mt-2 list-decimal space-y-1 pl-6 text-body-sm">
            {gaps.map((c) => (
              <li key={c.category}>{t.gaps.item(categoryLabel(c.category), c.withoutData, c.places, percent(c.withoutData, c.places))}</li>
            ))}
          </ol>
        )}
        <ul className="mt-3 list-disc space-y-1 pl-6 text-body-sm text-foreground/85">
          <li>{t.gaps.residents}</li>
          <li>{t.gaps.city}</li>
        </ul>
      </InfoSection>

      <InfoSection title={t.attributes.heading}>
        <DataTable caption={t.attributes.caption} head={[t.attributes.attribute, t.attributes.places, t.attributes.share]}>
          {report.attributes.map((a) => (
            <tr key={a.attribute}>
              <th scope="row" className={rowTh}>
                {attributeLabels[a.attribute] ?? a.attribute}
              </th>
              <td className={td}>{n(a.places)}</td>
              <td className={td}>{percent(a.places, places.total)}%</td>
            </tr>
          ))}
        </DataTable>
      </InfoSection>

      <InfoSection title={t.age.heading}>
        <DataTable caption={t.age.caption} head={[t.age.bucket, t.age.facts, t.age.share]}>
          {facts.age.map((row) => (
            <tr key={row.bucket}>
              <th scope="row" className={rowTh}>
                {t.age.buckets[row.bucket]}
              </th>
              <td className={td}>{n(row.facts)}</td>
              <td className={td}>{percent(row.facts, facts.total)}%</td>
            </tr>
          ))}
        </DataTable>
      </InfoSection>

      <InfoSection title={t.reliability.heading}>
        <DataTable caption={t.reliability.caption} head={[t.reliability.level, t.reliability.facts, t.reliability.share]}>
          {report.reliability.map((row) => (
            <tr key={row.reliability}>
              <th scope="row" className={rowTh}>
                {t.reliability.levels[row.reliability]}
              </th>
              <td className={td}>{n(row.facts)}</td>
              <td className={td}>{percent(row.facts, facts.total)}%</td>
            </tr>
          ))}
        </DataTable>
      </InfoSection>

      <InfoSection title={t.conflicts.heading}>
        <p className="text-body-sm text-foreground/85">
          {report.conflicts.attributes > 0 ? t.conflicts.body(report.conflicts.places, report.conflicts.attributes) : t.conflicts.none}
        </p>
      </InfoSection>

      <InfoSection title={t.sources.heading}>
        <DataTable caption={t.sources.caption} head={[t.sources.source, t.sources.kind, t.sources.facts, t.sources.newest]}>
          {report.sources.map((s) => (
            <tr key={s.sourceId}>
              <th scope="row" className={rowTh}>
                {s.name}
              </th>
              <td className={td}>{t.sources.kinds[s.kind]}</td>
              <td className={td}>{n(s.facts)}</td>
              <td className={td}>{date(s.newestFetchedAt)}</td>
            </tr>
          ))}
        </DataTable>
        <p className="mt-2">
          <Link href={routes.aboutData} className="inline-flex min-h-6 items-center font-semibold text-primary underline underline-offset-2">
            {t.sources.aboutLink}
          </Link>
        </p>
      </InfoSection>

      <InfoSection title={t.method.heading}>
        <ul className="list-disc space-y-1 pl-6 text-body-sm text-foreground/85">
          {t.method.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </InfoSection>
    </InfoPage>
  );
}
