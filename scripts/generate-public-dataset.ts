import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  compareCompatibilityReports,
  loadFixtureProvenance,
  renderJsonComparisonReport,
  renderJsonReport,
  scanBytecode,
  scanIndexer,
  scanTraceFile,
  scanValidatorConfig,
  type CompatibilityReport,
  type FixtureProvenanceEntry
} from "../src/index.js";
import { TOOL_VERSION } from "../src/reports/reportTypes.js";

interface DatasetReportEntry {
  sourceFixture: string;
  fixtureKind: FixtureProvenanceEntry["kind"];
  thresholdProfile: "default" | "research";
  report: string;
  risk: CompatibilityReport["summary"]["risk"];
  findingCount: number;
  findingIds: string[];
}

interface DatasetComparisonEntry {
  sourceFixture: string;
  baselineReport: string;
  candidateReport: string;
  comparison: string;
  riskChange: string;
  addedCount: number;
  removedCount: number;
  changedCount: number;
  unchangedCount: number;
}

interface DatasetSummaryCount {
  key: string;
  count: number;
}

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const datasetDir = resolve(rootDir, "datasets/public-seed");
const reportsDir = resolve(datasetDir, "reports");
const comparisonsDir = resolve(datasetDir, "comparisons");
const defaultThresholdsPath = resolve(rootDir, "data/detectors/thresholds.json");
const researchThresholdsPath = resolve(rootDir, "data/detectors/thresholds.research.json");
const datasetLastUpdated = "2026-05-12";

const manifest = loadFixtureProvenance(resolve(rootDir, "fixtures/provenance.json"));
const scannableFixtures = manifest.fixtures
  .filter((fixture) => fixture.kind !== "report")
  .sort((a, b) => a.path.localeCompare(b.path));

const reportEntries: DatasetReportEntry[] = [];
const comparisonEntries: DatasetComparisonEntry[] = [];

rmSync(datasetDir, { recursive: true, force: true });
mkdirSync(reportsDir, { recursive: true });
mkdirSync(comparisonsDir, { recursive: true });

for (const fixture of scannableFixtures) {
  const defaultReport = scanFixture(fixture, defaultThresholdsPath);
  const defaultReportPath = writeReport(fixture, "default", defaultReport);
  reportEntries.push(reportEntry(fixture, "default", defaultReportPath, defaultReport));

  if (fixture.kind === "bytecode" || fixture.kind === "trace") {
    const researchReport = scanFixture(fixture, researchThresholdsPath);
    const researchReportPath = writeReport(fixture, "research", researchReport);
    reportEntries.push(reportEntry(fixture, "research", researchReportPath, researchReport));

    const comparison = compareCompatibilityReports(defaultReport, researchReport);
    const comparisonPath = `comparisons/${slugFixturePath(fixture.path)}--default-vs-research.json`;
    writeJson(resolve(datasetDir, comparisonPath), JSON.parse(renderJsonComparisonReport(comparison)));
    comparisonEntries.push({
      sourceFixture: fixture.path,
      baselineReport: defaultReportPath,
      candidateReport: researchReportPath,
      comparison: comparisonPath,
      riskChange: `${comparison.summary.riskChange.from}->${comparison.summary.riskChange.to} (${comparison.summary.riskChange.direction})`,
      addedCount: comparison.summary.addedCount,
      removedCount: comparison.summary.removedCount,
      changedCount: comparison.summary.changedCount,
      unchangedCount: comparison.summary.unchangedCount
    });
  }
}

writeJson(resolve(datasetDir, "manifest.json"), {
  schemaVersion: 1,
  name: "public-seed",
  lastUpdated: datasetLastUpdated,
  description:
    "Deterministic seed dataset generated from safe-to-publish fixture inputs and threshold-profile comparisons.",
  toolVersion: TOOL_VERSION,
  sourceManifest: "fixtures/provenance.json",
  summary: "summary.json",
  thresholdProfiles: [
    {
      name: "default",
      path: "data/detectors/thresholds.json"
    },
    {
      name: "research",
      path: "data/detectors/thresholds.research.json"
    }
  ],
  reports: reportEntries,
  comparisons: comparisonEntries,
  limitations: [
    "This seed dataset is fixture-based and intentionally small; it is not an aggregate measurement of public-chain Glamsterdam readiness.",
    "Synthetic fixtures provide parser and detector coverage but do not prove real client behavior.",
    "Threshold-profile comparisons are structural report differences, not final fork gas deltas."
  ]
});
writeJson(resolve(datasetDir, "summary.json"), buildSummary());
writeReadme();

function scanFixture(fixture: FixtureProvenanceEntry, thresholdsPath: string): CompatibilityReport {
  const absolutePath = resolve(rootDir, fixture.path);
  const options = {
    targetName: fixture.path,
    thresholdsPath
  };

  switch (fixture.kind) {
    case "bytecode":
      return scanBytecode(absolutePath, options);
    case "trace":
      return scanTraceFile(absolutePath, options);
    case "indexer":
      return scanIndexer(absolutePath, options);
    case "validator":
      return scanValidatorConfig(absolutePath, options);
    case "report":
      throw new Error(`Cannot scan generated report fixture as a dataset source: ${fixture.path}`);
  }
}

function writeReport(
  fixture: FixtureProvenanceEntry,
  thresholdProfile: DatasetReportEntry["thresholdProfile"],
  report: CompatibilityReport
): string {
  const outputPath = `reports/${slugFixturePath(fixture.path)}--${thresholdProfile}.json`;
  writeJson(resolve(datasetDir, outputPath), JSON.parse(renderJsonReport(report)));
  return outputPath;
}

function reportEntry(
  fixture: FixtureProvenanceEntry,
  thresholdProfile: DatasetReportEntry["thresholdProfile"],
  reportPath: string,
  report: CompatibilityReport
): DatasetReportEntry {
  return {
    sourceFixture: fixture.path,
    fixtureKind: fixture.kind,
    thresholdProfile,
    report: reportPath,
    risk: report.summary.risk,
    findingCount: report.summary.findingCount,
    findingIds: report.findings.map((finding) => finding.id)
  };
}

function slugFixturePath(path: string): string {
  return path
    .replace(/^fixtures\//, "")
    .replace(/\.[^.]+$/, "")
    .replaceAll("/", "-")
    .replaceAll("_", "-");
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function buildSummary(): unknown {
  return {
    schemaVersion: 1,
    name: "public-seed-summary",
    lastUpdated: datasetLastUpdated,
    toolVersion: TOOL_VERSION,
    sourceManifest: "fixtures/provenance.json",
    fixtureCount: scannableFixtures.length,
    reportCount: reportEntries.length,
    comparisonCount: comparisonEntries.length,
    counts: {
      fixturesByKind: countBy(scannableFixtures, (fixture) => fixture.kind),
      fixturesBySourceType: countBy(scannableFixtures, (fixture) => fixture.source.type),
      reportsByRisk: countBy(reportEntries, (entry) => entry.risk),
      reportsByFixtureKind: countBy(reportEntries, (entry) => entry.fixtureKind),
      reportsByThresholdProfile: countBy(reportEntries, (entry) => entry.thresholdProfile),
      findingsById: countBy(
        reportEntries.flatMap((entry) => entry.findingIds),
        (findingId) => findingId
      )
    }
  };
}

function countBy<T>(items: T[], keyForItem: (item: T) => string): DatasetSummaryCount[] {
  const counts = items.reduce<Record<string, number>>((totals, item) => {
    const key = keyForItem(item);
    totals[key] = (totals[key] ?? 0) + 1;
    return totals;
  }, {});

  return Object.entries(counts)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, count]) => ({ key, count }));
}

function writeReadme(): void {
  writeFileSync(resolve(datasetDir, "README.md"), `# Public Seed Dataset

This directory contains the first deterministic dataset seed for Glamsterdam Compatibility Lab. It is generated from safe-to-publish fixtures documented in \`fixtures/provenance.json\`.

The seed is intentionally small. It is meant to prove the dataset workflow, not to measure aggregate public-chain readiness.

## Contents

- \`manifest.json\`: index of generated reports, comparisons, source fixtures, threshold profiles, and limitations.
- \`summary.json\`: aggregate counts by fixture kind, source type, report risk, threshold profile, and finding ID.
- \`reports/\`: JSON compatibility reports generated from source fixtures.
- \`comparisons/\`: JSON comparison reports for default-vs-research threshold profiles on bytecode and trace fixtures.

## Regenerate

\`\`\`sh
pnpm dataset:generate
\`\`\`

Then run:

\`\`\`sh
pnpm test
pnpm build
\`\`\`

Review generated changes before publishing. Dataset comparisons are structural report differences only; they do not infer final Glamsterdam gas deltas or client behavior.
`);
}

process.stdout.write(`Generated public seed dataset with ${reportEntries.length} reports and ${comparisonEntries.length} comparisons.\n`);
