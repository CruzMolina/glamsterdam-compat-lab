import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { describe, expect, it } from "vitest";
import {
  loadFixtureProvenance,
  validateCompatibilityReport,
  validateComparisonReport
} from "../src/index.js";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const datasetReportEntrySchema = z.object({
  sourceFixture: z.string().min(1),
  fixtureKind: z.enum(["bytecode", "trace", "indexer", "validator"]),
  thresholdProfile: z.enum(["default", "research"]),
  report: z.string().min(1),
  risk: z.enum(["low", "medium", "high", "unknown"]),
  findingCount: z.number().int().nonnegative(),
  findingIds: z.array(z.string().min(1))
});

const datasetComparisonEntrySchema = z.object({
  sourceFixture: z.string().min(1),
  baselineReport: z.string().min(1),
  candidateReport: z.string().min(1),
  comparison: z.string().min(1),
  riskChange: z.string().min(1),
  addedCount: z.number().int().nonnegative(),
  removedCount: z.number().int().nonnegative(),
  changedCount: z.number().int().nonnegative(),
  unchangedCount: z.number().int().nonnegative()
});

const publicSeedManifestSchema = z.object({
  schemaVersion: z.literal(1),
  name: z.literal("public-seed"),
  lastUpdated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().min(1),
  toolVersion: z.string().min(1),
  sourceManifest: z.literal("fixtures/provenance.json"),
  summary: z.literal("summary.json"),
  csvExports: z.object({
    reports: z.literal("reports.csv"),
    findings: z.literal("findings.csv"),
    summary: z.literal("summary.csv")
  }),
  thresholdProfiles: z.array(z.object({
    name: z.enum(["default", "research"]),
    path: z.string().min(1)
  })),
  reports: z.array(datasetReportEntrySchema).min(1),
  comparisons: z.array(datasetComparisonEntrySchema).min(1),
  limitations: z.array(z.string().min(1)).min(1)
});

const datasetSummaryCountSchema = z.object({
  key: z.string().min(1),
  count: z.number().int().nonnegative()
});

const publicSeedSummarySchema = z.object({
  schemaVersion: z.literal(1),
  name: z.literal("public-seed-summary"),
  lastUpdated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toolVersion: z.string().min(1),
  sourceManifest: z.literal("fixtures/provenance.json"),
  fixtureCount: z.number().int().nonnegative(),
  reportCount: z.number().int().nonnegative(),
  comparisonCount: z.number().int().nonnegative(),
  counts: z.object({
    fixturesByKind: z.array(datasetSummaryCountSchema),
    fixturesBySourceType: z.array(datasetSummaryCountSchema),
    reportsByRisk: z.array(datasetSummaryCountSchema),
    reportsByFixtureKind: z.array(datasetSummaryCountSchema),
    reportsByThresholdProfile: z.array(datasetSummaryCountSchema),
    findingsById: z.array(datasetSummaryCountSchema)
  })
});

const datasetManifest = publicSeedManifestSchema.parse(
  JSON.parse(readFileSync(resolve(rootDir, "datasets/public-seed/manifest.json"), "utf8"))
);
const datasetSummary = publicSeedSummarySchema.parse(
  JSON.parse(readFileSync(resolve(rootDir, "datasets/public-seed/summary.json"), "utf8"))
);
const fixtureManifest = loadFixtureProvenance(resolve(rootDir, "fixtures/provenance.json"));
const reportCsvRows = parseCsvFile(resolve(rootDir, "datasets/public-seed", datasetManifest.csvExports.reports));
const findingCsvRows = parseCsvFile(resolve(rootDir, "datasets/public-seed", datasetManifest.csvExports.findings));
const summaryCsvRows = parseCsvFile(resolve(rootDir, "datasets/public-seed", datasetManifest.csvExports.summary));

describe("public seed dataset", () => {
  it("has default reports for every scannable fixture", () => {
    const expectedDefaultFixtures = fixtureManifest.fixtures
      .filter((fixture) => fixture.kind !== "report")
      .map((fixture) => fixture.path)
      .sort();
    const actualDefaultFixtures = datasetManifest.reports
      .filter((report) => report.thresholdProfile === "default")
      .map((report) => report.sourceFixture)
      .sort();

    expect(actualDefaultFixtures).toEqual(expectedDefaultFixtures);
  });

  it("has research comparisons for bytecode and trace fixtures", () => {
    const expectedComparisonFixtures = fixtureManifest.fixtures
      .filter((fixture) => fixture.kind === "bytecode" || fixture.kind === "trace")
      .map((fixture) => fixture.path)
      .sort();
    const actualComparisonFixtures = datasetManifest.comparisons
      .map((comparison) => comparison.sourceFixture)
      .sort();

    expect(actualComparisonFixtures).toEqual(expectedComparisonFixtures);
  });

  it("keeps report manifests aligned with report files", () => {
    for (const entry of datasetManifest.reports) {
      const reportPath = resolve(rootDir, "datasets/public-seed", entry.report);
      expect(existsSync(reportPath)).toBe(true);

      const report = validateCompatibilityReport(JSON.parse(readFileSync(reportPath, "utf8")));
      expect(report.summary.risk).toBe(entry.risk);
      expect(report.summary.findingCount).toBe(entry.findingCount);
      expect(report.findings.map((finding) => finding.id)).toEqual(entry.findingIds);
    }
  });

  it("keeps comparison manifests aligned with comparison files", () => {
    for (const entry of datasetManifest.comparisons) {
      expect(existsSync(resolve(rootDir, "datasets/public-seed", entry.baselineReport))).toBe(true);
      expect(existsSync(resolve(rootDir, "datasets/public-seed", entry.candidateReport))).toBe(true);

      const comparisonPath = resolve(rootDir, "datasets/public-seed", entry.comparison);
      expect(existsSync(comparisonPath)).toBe(true);

      const comparison = validateComparisonReport(JSON.parse(readFileSync(comparisonPath, "utf8")));
      expect(comparison.summary.addedCount).toBe(entry.addedCount);
      expect(comparison.summary.removedCount).toBe(entry.removedCount);
      expect(comparison.summary.changedCount).toBe(entry.changedCount);
      expect(comparison.summary.unchangedCount).toBe(entry.unchangedCount);
    }
  });

  it("keeps summary counts aligned with the manifest and reports", () => {
    const scannableFixtures = fixtureManifest.fixtures.filter((fixture) => fixture.kind !== "report");

    expect(existsSync(resolve(rootDir, "datasets/public-seed", datasetManifest.summary))).toBe(true);
    expect(datasetSummary.fixtureCount).toBe(scannableFixtures.length);
    expect(datasetSummary.reportCount).toBe(datasetManifest.reports.length);
    expect(datasetSummary.comparisonCount).toBe(datasetManifest.comparisons.length);
    expect(datasetSummary.counts.fixturesByKind).toEqual(countBy(scannableFixtures.map((fixture) => fixture.kind)));
    expect(datasetSummary.counts.fixturesBySourceType).toEqual(
      countBy(scannableFixtures.map((fixture) => fixture.source.type))
    );
    expect(datasetSummary.counts.reportsByRisk).toEqual(countBy(datasetManifest.reports.map((report) => report.risk)));
    expect(datasetSummary.counts.reportsByFixtureKind).toEqual(
      countBy(datasetManifest.reports.map((report) => report.fixtureKind))
    );
    expect(datasetSummary.counts.reportsByThresholdProfile).toEqual(
      countBy(datasetManifest.reports.map((report) => report.thresholdProfile))
    );
    expect(datasetSummary.counts.findingsById).toEqual(
      countBy(datasetManifest.reports.flatMap((report) => report.findingIds))
    );
  });

  it("exports report CSV rows aligned with the manifest", () => {
    expect(reportCsvRows).toEqual(
      datasetManifest.reports.map((entry) => ({
        sourceFixture: entry.sourceFixture,
        fixtureKind: entry.fixtureKind,
        thresholdProfile: entry.thresholdProfile,
        report: entry.report,
        risk: entry.risk,
        findingCount: String(entry.findingCount),
        findingIds: entry.findingIds.join("|")
      }))
    );
  });

  it("exports finding CSV rows aligned with JSON report findings", () => {
    const expectedRows = datasetManifest.reports.flatMap((entry) => {
      const reportPath = resolve(rootDir, "datasets/public-seed", entry.report);
      const report = validateCompatibilityReport(JSON.parse(readFileSync(reportPath, "utf8")));

      return report.findings.map((finding, index) => ({
        sourceFixture: entry.sourceFixture,
        fixtureKind: entry.fixtureKind,
        thresholdProfile: entry.thresholdProfile,
        report: entry.report,
        findingIndex: String(index + 1),
        findingId: finding.id,
        title: finding.title,
        severity: finding.severity,
        confidence: finding.confidence,
        domains: finding.domain.join("|"),
        relatedEips: finding.relatedEips.join("|")
      }));
    });

    expect(findingCsvRows).toEqual(expectedRows);
  });

  it("exports summary CSV rows aligned with the JSON summary", () => {
    expect(summaryCsvRows).toEqual([
      { category: "totals", key: "fixtureCount", count: String(datasetSummary.fixtureCount) },
      { category: "totals", key: "reportCount", count: String(datasetSummary.reportCount) },
      { category: "totals", key: "comparisonCount", count: String(datasetSummary.comparisonCount) },
      ...summaryCountRows("fixturesByKind", datasetSummary.counts.fixturesByKind),
      ...summaryCountRows("fixturesBySourceType", datasetSummary.counts.fixturesBySourceType),
      ...summaryCountRows("reportsByRisk", datasetSummary.counts.reportsByRisk),
      ...summaryCountRows("reportsByFixtureKind", datasetSummary.counts.reportsByFixtureKind),
      ...summaryCountRows("reportsByThresholdProfile", datasetSummary.counts.reportsByThresholdProfile),
      ...summaryCountRows("findingsById", datasetSummary.counts.findingsById)
    ]);
  });
});

function countBy(values: string[]): Array<{ key: string; count: number }> {
  const counts = values.reduce<Record<string, number>>((totals, value) => {
    totals[value] = (totals[value] ?? 0) + 1;
    return totals;
  }, {});

  return Object.entries(counts)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, count]) => ({ key, count }));
}

function summaryCountRows(
  category: string,
  counts: Array<{ key: string; count: number }>
): Array<{ category: string; key: string; count: string }> {
  return counts.map((count) => ({
    category,
    key: count.key,
    count: String(count.count)
  }));
}

function parseCsvFile(path: string): Array<Record<string, string>> {
  if (!existsSync(path)) {
    throw new Error(`Missing CSV export: ${path}`);
  }
  const rows = parseCsv(readFileSync(path, "utf8"));
  const [headers, ...dataRows] = rows;

  return dataRows.map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]))
  );
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (quoted) {
      if (char === "\"" && text[index + 1] === "\"") {
        field += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === "\"") {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}
