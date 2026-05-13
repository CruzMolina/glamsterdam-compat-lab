import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { describe, expect, it } from "vitest";
import {
  checkClientMatrix,
  loadClientMatrix,
  loadEipRegistry,
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
  readiness: z.literal("readiness.json"),
  csvExports: z.object({
    reports: z.literal("reports.csv"),
    findings: z.literal("findings.csv"),
    summary: z.literal("summary.csv"),
    readinessClients: z.literal("readiness-clients.csv"),
    readinessDevnets: z.literal("readiness-devnets.csv"),
    readinessEips: z.literal("readiness-eips.csv"),
    readinessSources: z.literal("readiness-sources.csv")
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

const freshnessBandSchema = z.enum(["fresh", "watch", "stale"]);

const readinessFreshnessPolicySchema = z.object({
  name: z.literal("readiness-source-freshness-v1"),
  asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  generatedAgeBasis: z.literal("readiness.lastUpdated"),
  liveAuditCommand: z.literal("pnpm readiness:freshness"),
  freshMaxDays: z.number().int().positive(),
  watchMaxDays: z.number().int().positive(),
  bands: z.array(z.object({
    band: freshnessBandSchema,
    minDays: z.number().int().nonnegative(),
    maxDays: z.number().int().nonnegative().optional(),
    meaning: z.string().min(1)
  })).length(3)
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

const readinessSourceSchema = z.object({
  area: z.enum(["eip-registry", "client-matrix"]),
  label: z.string().min(1),
  type: z.string().min(1),
  url: z.string().url(),
  sourceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  retrievedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  retrievedDaysAgo: z.number().int().nonnegative(),
  sourceAgeDays: z.number().int().nonnegative().optional(),
  freshnessAsOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  freshnessBand: freshnessBandSchema,
  freshnessReview: z.string().min(1),
  claim: z.string().min(1),
  notes: z.string().optional()
});

const publicSeedReadinessSchema = z.object({
  schemaVersion: z.literal(1),
  name: z.literal("public-seed-readiness"),
  lastUpdated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toolVersion: z.string().min(1),
  fork: z.literal("glamsterdam"),
  sourceFreshnessPolicy: readinessFreshnessPolicySchema,
  sourceReviewNotes: z.array(z.string().min(1)).min(1),
  eipRegistry: z.object({
    lastUpdated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    sourceCount: z.number().int().nonnegative(),
    countsByFreshness: z.array(datasetSummaryCountSchema),
    countsByStatus: z.array(datasetSummaryCountSchema),
    sources: z.array(readinessSourceSchema).min(1),
    eips: z.array(z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      status: z.enum(["scheduled", "considered", "proposed", "declined", "superseded", "unknown"]),
      domain: z.array(z.string().min(1)).min(1),
      detectors: z.array(z.string()),
      notes: z.string().optional()
    })).min(1)
  }),
  clientMatrix: z.object({
    lastUpdated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    sourceCount: z.number().int().nonnegative(),
    countsByFreshness: z.array(datasetSummaryCountSchema),
    countsByStatus: z.array(datasetSummaryCountSchema),
    countsByRole: z.array(datasetSummaryCountSchema),
    check: z.object({
      ok: z.literal(true),
      warnings: z.array(z.string())
    }),
    sources: z.array(readinessSourceSchema).min(1),
    clients: z.array(z.object({
      role: z.string().min(1),
      name: z.string().min(1),
      version: z.string().min(1),
      status: z.enum(["compatible", "incompatible", "partial", "unknown"]),
      sourceType: z.string().min(1),
      sourceUrl: z.string().url(),
      retrievedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      retrievedDaysAgo: z.number().int().nonnegative(),
      freshnessBand: freshnessBandSchema,
      notes: z.string().optional()
    })).min(1),
    devnets: z.array(z.object({
      name: z.string().min(1),
      status: z.string().min(1),
      sourceUrl: z.string().url(),
      retrievedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      participants: z.array(z.object({
        devnet: z.string().min(1),
        devnetStatus: z.string().min(1),
        role: z.string().min(1),
        name: z.string().min(1),
        image: z.string().min(1).optional(),
        status: z.string().min(1),
        notes: z.string().optional()
      })),
      specVersions: z.array(z.object({
        devnet: z.string().min(1),
        name: z.string().min(1),
        version: z.string().min(1),
        sourceUrl: z.string().url().optional(),
        retrievedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
      })),
      notes: z.string().optional()
    })).min(1)
  }),
  limitations: z.array(z.string().min(1)).min(1)
});

const datasetManifest = publicSeedManifestSchema.parse(
  JSON.parse(readFileSync(resolve(rootDir, "datasets/public-seed/manifest.json"), "utf8"))
);
const datasetSummary = publicSeedSummarySchema.parse(
  JSON.parse(readFileSync(resolve(rootDir, "datasets/public-seed/summary.json"), "utf8"))
);
const datasetReadiness = publicSeedReadinessSchema.parse(
  JSON.parse(readFileSync(resolve(rootDir, "datasets/public-seed/readiness.json"), "utf8"))
);
const fixtureManifest = loadFixtureProvenance(resolve(rootDir, "fixtures/provenance.json"));
const eipRegistry = loadEipRegistry(resolve(rootDir, "data/eips/glamsterdam.json"));
const clientMatrix = loadClientMatrix(resolve(rootDir, "data/client-compat/clients.example.json"));
const reportCsvRows = parseCsvFile(resolve(rootDir, "datasets/public-seed", datasetManifest.csvExports.reports));
const findingCsvRows = parseCsvFile(resolve(rootDir, "datasets/public-seed", datasetManifest.csvExports.findings));
const summaryCsvRows = parseCsvFile(resolve(rootDir, "datasets/public-seed", datasetManifest.csvExports.summary));
const readinessClientCsvRows = parseCsvFile(
  resolve(rootDir, "datasets/public-seed", datasetManifest.csvExports.readinessClients)
);
const readinessDevnetCsvRows = parseCsvFile(
  resolve(rootDir, "datasets/public-seed", datasetManifest.csvExports.readinessDevnets)
);
const readinessEipCsvRows = parseCsvFile(
  resolve(rootDir, "datasets/public-seed", datasetManifest.csvExports.readinessEips)
);
const readinessSourceCsvRows = parseCsvFile(
  resolve(rootDir, "datasets/public-seed", datasetManifest.csvExports.readinessSources)
);

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

  it("exports sourced readiness JSON aligned with the registry and client matrix", () => {
    const matrixCheck = checkClientMatrix(clientMatrix);
    const expectedClients = clientMatrix.clients.flatMap((client) =>
      client.versions.map((version) => ({
        role: client.role,
        name: client.name,
        version: version.version,
        status: version.status,
        sourceType: version.source.type,
        sourceUrl: version.source.url,
        retrievedAt: version.source.retrievedAt,
        retrievedDaysAgo: daysBetween(datasetReadiness.lastUpdated, version.source.retrievedAt),
        freshnessBand: freshnessBandForAge(daysBetween(datasetReadiness.lastUpdated, version.source.retrievedAt)),
        ...(version.notes ? { notes: version.notes } : {})
      }))
    ).sort((left, right) =>
      left.role.localeCompare(right.role)
        || left.name.localeCompare(right.name)
        || left.version.localeCompare(right.version)
    );

    expect(existsSync(resolve(rootDir, "datasets/public-seed", datasetManifest.readiness))).toBe(true);
    expect(datasetReadiness.eipRegistry.lastUpdated).toBe(eipRegistry.lastUpdated);
    expect(datasetReadiness.sourceFreshnessPolicy.asOf).toBe(datasetReadiness.lastUpdated);
    expect(datasetReadiness.sourceFreshnessPolicy.freshMaxDays).toBe(30);
    expect(datasetReadiness.sourceFreshnessPolicy.watchMaxDays).toBe(90);
    expect(datasetReadiness.sourceReviewNotes).toContainEqual(
      expect.stringContaining("stale freshness bands")
    );
    expect(datasetReadiness.eipRegistry.sourceCount).toBe(eipRegistry.sources.length);
    expect(datasetReadiness.eipRegistry.countsByFreshness).toEqual([{ key: "fresh", count: eipRegistry.sources.length }]);
    expect(datasetReadiness.eipRegistry.countsByStatus).toEqual(countBy(eipRegistry.eips.map((entry) => entry.status)));
    expect(datasetReadiness.eipRegistry.eips).toEqual(
      eipRegistry.eips.map((entry) => ({
        id: entry.id,
        name: entry.name,
        status: entry.status,
        domain: entry.domain,
        detectors: entry.detectors,
        notes: entry.notes
      }))
    );
    expect(datasetReadiness.eipRegistry.eips.some((entry) => entry.status === "proposed")).toBe(true);
    expect(datasetReadiness.clientMatrix.check).toEqual({ ok: matrixCheck.ok, warnings: matrixCheck.warnings });
    expect(datasetReadiness.clientMatrix.clients).toEqual(expectedClients);
    expect(datasetReadiness.clientMatrix.countsByFreshness).toEqual(
      countBy([...datasetReadiness.clientMatrix.sources].map((source) => source.freshnessBand))
    );
    expect(datasetReadiness.clientMatrix.countsByStatus).toEqual(
      countBy(expectedClients.map((entry) => entry.status))
    );
    expect(datasetReadiness.clientMatrix.countsByRole).toEqual(
      countBy(expectedClients.map((entry) => entry.role))
    );
    expect(datasetReadiness.clientMatrix.clients.every((entry) =>
      !(entry.status === "compatible" && entry.sourceType.startsWith("public-"))
    )).toBe(true);
  });

  it("exports readiness CSV rows aligned with readiness JSON", () => {
    expect(readinessClientCsvRows).toEqual(
      datasetReadiness.clientMatrix.clients.map((client) => ({
        role: client.role,
        name: client.name,
        version: client.version,
        status: client.status,
        sourceType: client.sourceType,
        sourceUrl: client.sourceUrl,
        retrievedAt: client.retrievedAt,
        retrievedDaysAgo: String(client.retrievedDaysAgo),
        freshnessBand: client.freshnessBand,
        notes: client.notes ?? ""
      }))
    );
    expect(readinessEipCsvRows).toEqual(
      datasetReadiness.eipRegistry.eips.map((entry) => ({
        id: entry.id,
        name: entry.name,
        status: entry.status,
        domain: entry.domain.join("|"),
        detectors: entry.detectors.join("|"),
        notes: entry.notes ?? ""
      }))
    );
    expect(readinessSourceCsvRows).toEqual(
      [...datasetReadiness.eipRegistry.sources, ...datasetReadiness.clientMatrix.sources].map((source) => ({
        area: source.area,
        label: source.label,
        type: source.type,
        url: source.url,
        sourceDate: source.sourceDate ?? "",
        retrievedAt: source.retrievedAt,
        retrievedDaysAgo: String(source.retrievedDaysAgo),
        sourceAgeDays: source.sourceAgeDays === undefined ? "" : String(source.sourceAgeDays),
        freshnessAsOf: source.freshnessAsOf,
        freshnessBand: source.freshnessBand,
        freshnessReview: source.freshnessReview,
        claim: source.claim,
        notes: source.notes ?? ""
      }))
    );
    expect(readinessDevnetCsvRows.some((row) =>
      row.devnet === "glamsterdam-devnet-2" && row.image === "ethpandaops/geth:bal-devnet-6"
    )).toBe(true);
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

function daysBetween(latest: string, earlier: string): number {
  const end = Date.parse(`${latest}T00:00:00Z`);
  const start = Date.parse(`${earlier}T00:00:00Z`);
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

function freshnessBandForAge(ageDays: number): "fresh" | "watch" | "stale" {
  if (ageDays <= 30) {
    return "fresh";
  }
  if (ageDays <= 90) {
    return "watch";
  }
  return "stale";
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
