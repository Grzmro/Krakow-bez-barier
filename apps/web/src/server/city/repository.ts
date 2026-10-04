import type { ReportStatus } from "@krakow-bez-barier/contracts";
import { reports, type Db } from "@krakow-bez-barier/db";
import { isNull } from "drizzle-orm";
import { getDb } from "@/server/db";

/** A report reduced to what the statistics count: no value, comment or photo. */
export type CityReportRecord = { placeId: string; status: ReportStatus };

export const dbCityReports =
  (db: Db = getDb()) =>
  (): Promise<CityReportRecord[]> =>
    db.select({ placeId: reports.placeId, status: reports.status }).from(reports).where(isNull(reports.withdrawnAt));
