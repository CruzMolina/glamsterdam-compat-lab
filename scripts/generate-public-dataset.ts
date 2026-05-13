import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  compareCompatibilityReports,
  clientMatrixSourceRefs,
  checkClientMatrix,
  daysBetweenIsoDates,
  loadClientMatrix,
  loadEipRegistry,
  loadFixtureProvenance,
  renderJsonComparisonReport,
  renderJsonReport,
  scanBytecode,
  scanIndexer,
  scanTraceFile,
  scanValidatorConfig,
  type CompatibilityFinding,
  type CompatibilityReport,
  type ClientMatrixSource,
  type ClientVersion,
  type EipEntry,
  type EipRegistrySource,
  type FixtureProvenanceEntry,
  type FixtureProvenanceManifest,
  SOURCE_FRESHNESS_POLICY,
  sourceFreshness,
  type SourceFreshnessBand
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

interface DatasetFindingEntry {
  sourceFixture: string;
  fixtureKind: FixtureProvenanceEntry["kind"];
  thresholdProfile: DatasetReportEntry["thresholdProfile"];
  report: string;
  findingIndex: number;
  findingId: string;
  title: string;
  severity: CompatibilityFinding["severity"];
  confidence: CompatibilityFinding["confidence"];
  domains: string[];
  relatedEips: string[];
}

interface DatasetSummaryCount {
  key: string;
  count: number;
}

interface DatasetSummary {
  schemaVersion: 1;
  name: "public-seed-summary";
  lastUpdated: string;
  toolVersion: string;
  sourceManifest: "fixtures/provenance.json";
  fixtureCount: number;
  reportCount: number;
  comparisonCount: number;
  counts: {
    fixturesByKind: DatasetSummaryCount[];
    fixturesBySourceType: DatasetSummaryCount[];
    reportsByRisk: DatasetSummaryCount[];
    reportsByFixtureKind: DatasetSummaryCount[];
    reportsByThresholdProfile: DatasetSummaryCount[];
    findingsById: DatasetSummaryCount[];
  };
}

interface DatasetReadinessFreshnessPolicy {
  name: string;
  asOf: string;
  generatedAgeBasis: "readiness.lastUpdated";
  liveAuditCommand: "pnpm readiness:freshness";
  freshMaxDays: number;
  watchMaxDays: number;
  bands: Array<{
    band: SourceFreshnessBand;
    minDays: number;
    maxDays?: number;
    meaning: string;
  }>;
}

interface DatasetReadinessSource {
  area: "eip-registry" | "client-matrix";
  label: string;
  type: string;
  url: string;
  sourceDate?: string;
  retrievedAt: string;
  retrievedDaysAgo: number;
  sourceAgeDays?: number;
  freshnessAsOf: string;
  freshnessBand: SourceFreshnessBand;
  freshnessReview: string;
  claim: string;
  notes?: string;
}

interface DatasetReadinessEip {
  id: string;
  name: string;
  status: EipEntry["status"];
  domain: string[];
  detectors: string[];
  notes?: string;
}

interface DatasetReadinessClient {
  role: string;
  name: string;
  version: string;
  status: ClientVersion["status"];
  sourceType: ClientMatrixSource["type"];
  sourceUrl: string;
  retrievedAt: string;
  retrievedDaysAgo: number;
  freshnessBand: SourceFreshnessBand;
  notes?: string;
}

interface DatasetReadinessDevnetParticipant {
  devnet: string;
  devnetStatus: string;
  role: string;
  name: string;
  image?: string;
  status: string;
  notes?: string;
}

interface DatasetReadinessSpecVersion {
  devnet: string;
  name: string;
  version: string;
  sourceUrl?: string;
  retrievedAt?: string;
}

interface DatasetReadiness {
  schemaVersion: 1;
  name: "public-seed-readiness";
  lastUpdated: string;
  toolVersion: string;
  fork: string;
  sourceFreshnessPolicy: DatasetReadinessFreshnessPolicy;
  sourceReviewNotes: string[];
  eipRegistry: {
    lastUpdated: string;
    sourceCount: number;
    countsByFreshness: DatasetSummaryCount[];
    countsBySourceType: DatasetSummaryCount[];
    countsByStatus: DatasetSummaryCount[];
    sources: DatasetReadinessSource[];
    eips: DatasetReadinessEip[];
  };
  clientMatrix: {
    lastUpdated: string;
    sourceCount: number;
    countsByFreshness: DatasetSummaryCount[];
    countsBySourceType: DatasetSummaryCount[];
    countsByStatus: DatasetSummaryCount[];
    countsByRole: DatasetSummaryCount[];
    check: {
      ok: boolean;
      warnings: string[];
    };
    sources: DatasetReadinessSource[];
    clients: DatasetReadinessClient[];
    devnets: Array<{
      name: string;
      status: string;
      sourceUrl: string;
      retrievedAt: string;
      participants: DatasetReadinessDevnetParticipant[];
      specVersions: DatasetReadinessSpecVersion[];
      notes?: string;
    }>;
  };
  limitations: string[];
}

type CsvValue = string | number;

export interface GeneratePublicDatasetOptions {
  outputDir?: string;
  quiet?: boolean;
}

export interface GeneratePublicDatasetResult {
  outputDir: string;
  reportCount: number;
  comparisonCount: number;
}

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultDatasetDir = resolve(rootDir, "datasets/public-seed");
const defaultThresholdsPath = resolve(rootDir, "data/detectors/thresholds.json");
const researchThresholdsPath = resolve(rootDir, "data/detectors/thresholds.research.json");
const datasetLastUpdated = "2026-05-13";
const csvExports = {
  reports: "reports.csv",
  findings: "findings.csv",
  summary: "summary.csv",
  readinessClients: "readiness-clients.csv",
  readinessDevnets: "readiness-devnets.csv",
  readinessEips: "readiness-eips.csv",
  readinessSources: "readiness-sources.csv"
} as const;

let datasetDir = defaultDatasetDir;
let reportsDir = resolve(datasetDir, "reports");
let comparisonsDir = resolve(datasetDir, "comparisons");
let manifest: FixtureProvenanceManifest;
let scannableFixtures: FixtureProvenanceEntry[] = [];
let reportEntries: DatasetReportEntry[] = [];
let comparisonEntries: DatasetComparisonEntry[] = [];
let findingEntries: DatasetFindingEntry[] = [];
let readiness: DatasetReadiness;

export function generatePublicDataset(options: GeneratePublicDatasetOptions = {}): GeneratePublicDatasetResult {
  datasetDir = options.outputDir ? resolve(options.outputDir) : defaultDatasetDir;
  reportsDir = resolve(datasetDir, "reports");
  comparisonsDir = resolve(datasetDir, "comparisons");
  manifest = loadFixtureProvenance(resolve(rootDir, "fixtures/provenance.json"));
  scannableFixtures = manifest.fixtures
    .filter((fixture) => fixture.kind !== "report")
    .sort((a, b) => a.path.localeCompare(b.path));
  reportEntries = [];
  comparisonEntries = [];
  findingEntries = [];

  rmSync(datasetDir, { recursive: true, force: true });
  mkdirSync(reportsDir, { recursive: true });
  mkdirSync(comparisonsDir, { recursive: true });

  for (const fixture of scannableFixtures) {
    const defaultReport = scanFixture(fixture, defaultThresholdsPath);
    const defaultReportPath = writeReport(fixture, "default", defaultReport);
    reportEntries.push(reportEntry(fixture, "default", defaultReportPath, defaultReport));
    findingEntries.push(...findingEntriesForReport(fixture, "default", defaultReportPath, defaultReport));

    if (fixture.kind === "bytecode" || fixture.kind === "trace") {
      const researchReport = scanFixture(fixture, researchThresholdsPath);
      const researchReportPath = writeReport(fixture, "research", researchReport);
      reportEntries.push(reportEntry(fixture, "research", researchReportPath, researchReport));
      findingEntries.push(...findingEntriesForReport(fixture, "research", researchReportPath, researchReport));

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

  const summary = buildSummary();
  readiness = buildReadiness();

  writeJson(resolve(datasetDir, "manifest.json"), {
    schemaVersion: 1,
    name: "public-seed",
    lastUpdated: datasetLastUpdated,
    description:
      "Deterministic seed dataset generated from safe-to-publish fixture inputs and threshold-profile comparisons.",
    toolVersion: TOOL_VERSION,
    sourceManifest: "fixtures/provenance.json",
    summary: "summary.json",
    readiness: "readiness.json",
    csvExports,
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
      "Threshold-profile comparisons are structural report differences, not final fork gas deltas.",
      "Client and devnet readiness entries are source records only; devnet participation is not production compatibility."
    ]
  });
  writeJson(resolve(datasetDir, "summary.json"), summary);
  writeJson(resolve(datasetDir, "readiness.json"), readiness);
  writeCsv(resolve(datasetDir, csvExports.reports), reportCsvRows());
  writeCsv(resolve(datasetDir, csvExports.findings), findingCsvRows());
  writeCsv(resolve(datasetDir, csvExports.summary), summaryCsvRows(summary));
  writeCsv(resolve(datasetDir, csvExports.readinessClients), readinessClientCsvRows(readiness));
  writeCsv(resolve(datasetDir, csvExports.readinessDevnets), readinessDevnetCsvRows(readiness));
  writeCsv(resolve(datasetDir, csvExports.readinessEips), readinessEipCsvRows(readiness));
  writeCsv(resolve(datasetDir, csvExports.readinessSources), readinessSourceCsvRows(readiness));
  writeReadme();

  if (!options.quiet) {
    process.stdout.write(`Generated public seed dataset with ${reportEntries.length} reports and ${comparisonEntries.length} comparisons.\n`);
  }

  return {
    outputDir: datasetDir,
    reportCount: reportEntries.length,
    comparisonCount: comparisonEntries.length
  };
}

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

function findingEntriesForReport(
  fixture: FixtureProvenanceEntry,
  thresholdProfile: DatasetReportEntry["thresholdProfile"],
  reportPath: string,
  report: CompatibilityReport
): DatasetFindingEntry[] {
  return report.findings.map((finding, index) => ({
    sourceFixture: fixture.path,
    fixtureKind: fixture.kind,
    thresholdProfile,
    report: reportPath,
    findingIndex: index + 1,
    findingId: finding.id,
    title: finding.title,
    severity: finding.severity,
    confidence: finding.confidence,
    domains: finding.domain,
    relatedEips: finding.relatedEips
  }));
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

function writeCsv(path: string, rows: Array<Record<string, CsvValue>>): void {
  if (rows.length === 0) {
    throw new Error(`Cannot write empty CSV: ${path}`);
  }

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => formatCsvValue(row[header] ?? "")).join(","))
  ];
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${lines.join("\n")}\n`);
}

function formatCsvValue(value: CsvValue): string {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

function reportCsvRows(): Array<Record<string, CsvValue>> {
  return reportEntries.map((entry) => ({
    sourceFixture: entry.sourceFixture,
    fixtureKind: entry.fixtureKind,
    thresholdProfile: entry.thresholdProfile,
    report: entry.report,
    risk: entry.risk,
    findingCount: entry.findingCount,
    findingIds: entry.findingIds.join("|")
  }));
}

function findingCsvRows(): Array<Record<string, CsvValue>> {
  return findingEntries.map((entry) => ({
    sourceFixture: entry.sourceFixture,
    fixtureKind: entry.fixtureKind,
    thresholdProfile: entry.thresholdProfile,
    report: entry.report,
    findingIndex: entry.findingIndex,
    findingId: entry.findingId,
    title: entry.title,
    severity: entry.severity,
    confidence: entry.confidence,
    domains: entry.domains.join("|"),
    relatedEips: entry.relatedEips.join("|")
  }));
}

function summaryCsvRows(summary: DatasetSummary): Array<Record<string, CsvValue>> {
  return [
    { category: "totals", key: "fixtureCount", count: summary.fixtureCount },
    { category: "totals", key: "reportCount", count: summary.reportCount },
    { category: "totals", key: "comparisonCount", count: summary.comparisonCount },
    ...summary.counts.fixturesByKind.map((count) => summaryCsvRow("fixturesByKind", count)),
    ...summary.counts.fixturesBySourceType.map((count) => summaryCsvRow("fixturesBySourceType", count)),
    ...summary.counts.reportsByRisk.map((count) => summaryCsvRow("reportsByRisk", count)),
    ...summary.counts.reportsByFixtureKind.map((count) => summaryCsvRow("reportsByFixtureKind", count)),
    ...summary.counts.reportsByThresholdProfile.map((count) => summaryCsvRow("reportsByThresholdProfile", count)),
    ...summary.counts.findingsById.map((count) => summaryCsvRow("findingsById", count))
  ];
}

function summaryCsvRow(category: string, count: DatasetSummaryCount): Record<string, CsvValue> {
  return {
    category,
    key: count.key,
    count: count.count
  };
}

function readinessClientCsvRows(readiness: DatasetReadiness): Array<Record<string, CsvValue>> {
  return readiness.clientMatrix.clients.map((client) => ({
    role: client.role,
    name: client.name,
    version: client.version,
    status: client.status,
    sourceType: client.sourceType,
    sourceUrl: client.sourceUrl,
    retrievedAt: client.retrievedAt,
    retrievedDaysAgo: client.retrievedDaysAgo,
    freshnessBand: client.freshnessBand,
    notes: client.notes ?? ""
  }));
}

function readinessDevnetCsvRows(readiness: DatasetReadiness): Array<Record<string, CsvValue>> {
  return readiness.clientMatrix.devnets.flatMap((devnet) => {
    if (devnet.participants.length === 0) {
      return [{
        devnet: devnet.name,
        devnetStatus: devnet.status,
        role: "",
        name: "",
        image: "",
        status: "",
        sourceUrl: devnet.sourceUrl,
        retrievedAt: devnet.retrievedAt,
        notes: devnet.notes ?? ""
      }];
    }

    return devnet.participants.map((participant) => ({
      devnet: participant.devnet,
      devnetStatus: participant.devnetStatus,
      role: participant.role,
      name: participant.name,
      image: participant.image ?? "",
      status: participant.status,
      sourceUrl: devnet.sourceUrl,
      retrievedAt: devnet.retrievedAt,
      notes: participant.notes ?? ""
    }));
  });
}

function readinessEipCsvRows(readiness: DatasetReadiness): Array<Record<string, CsvValue>> {
  return readiness.eipRegistry.eips.map((entry) => ({
    id: entry.id,
    name: entry.name,
    status: entry.status,
    domain: entry.domain.join("|"),
    detectors: entry.detectors.join("|"),
    notes: entry.notes ?? ""
  }));
}

function readinessSourceCsvRows(readiness: DatasetReadiness): Array<Record<string, CsvValue>> {
  return [...readiness.eipRegistry.sources, ...readiness.clientMatrix.sources].map((source) => ({
    area: source.area,
    label: source.label,
    type: source.type,
    url: source.url,
    sourceDate: source.sourceDate ?? "",
    retrievedAt: source.retrievedAt,
    retrievedDaysAgo: source.retrievedDaysAgo,
    sourceAgeDays: source.sourceAgeDays ?? "",
    freshnessAsOf: source.freshnessAsOf,
    freshnessBand: source.freshnessBand,
    freshnessReview: source.freshnessReview,
    claim: source.claim,
    notes: source.notes ?? ""
  }));
}

function buildSummary(): DatasetSummary {
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

function buildReadiness(): DatasetReadiness {
  const eipRegistry = loadEipRegistry();
  const clientMatrix = loadClientMatrix();
  const matrixCheck = checkClientMatrix(clientMatrix);
  const clientMatrixSources = clientMatrixSourceRefs(clientMatrix);

  if (!matrixCheck.ok) {
    throw new Error(`Client compatibility matrix is not exportable: ${matrixCheck.errors.join("; ")}`);
  }

  for (const source of eipRegistry.sources) {
    assertSourceDate("eip registry source", eipRegistry.lastUpdated, source);
  }

  const clients = clientMatrix.clients
    .flatMap((client) =>
      client.versions.map((version) => ({
        role: client.role,
        name: client.name,
        version: version.version,
        status: version.status,
        sourceType: version.source.type,
        sourceUrl: version.source.url,
        retrievedAt: version.source.retrievedAt,
        retrievedDaysAgo: ageInDays(version.source.retrievedAt),
        freshnessBand: sourceFreshness(version.source.retrievedAt, datasetLastUpdated).band,
        notes: version.notes
      }))
    )
    .sort((left, right) =>
      left.role.localeCompare(right.role)
        || left.name.localeCompare(right.name)
        || left.version.localeCompare(right.version)
    );
  const devnets = clientMatrix.devnets
    .map((devnet) => ({
      name: devnet.name,
      status: devnet.status,
      sourceUrl: devnet.source.url,
      retrievedAt: devnet.source.retrievedAt,
      participants: devnet.participants.map((participant) => ({
        devnet: devnet.name,
        devnetStatus: devnet.status,
        role: participant.role,
        name: participant.name,
        image: participant.image,
        status: participant.status,
        notes: participant.notes
      })),
      specVersions: devnet.specVersions.map((specVersion) => ({
        devnet: devnet.name,
        name: specVersion.name,
        version: specVersion.version,
        sourceUrl: specVersion.source?.url,
        retrievedAt: specVersion.source?.retrievedAt
      })),
      notes: devnet.notes
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  return {
    schemaVersion: 1,
    name: "public-seed-readiness",
    lastUpdated: datasetLastUpdated,
    toolVersion: TOOL_VERSION,
    fork: eipRegistry.fork,
    sourceFreshnessPolicy: {
      name: SOURCE_FRESHNESS_POLICY.name,
      asOf: datasetLastUpdated,
      generatedAgeBasis: "readiness.lastUpdated",
      liveAuditCommand: "pnpm readiness:freshness",
      freshMaxDays: SOURCE_FRESHNESS_POLICY.freshMaxDays,
      watchMaxDays: SOURCE_FRESHNESS_POLICY.watchMaxDays,
      bands: SOURCE_FRESHNESS_POLICY.bands
    },
    sourceReviewNotes: [
      "Generated source age fields are calculated against readiness.lastUpdated so committed artifacts stay deterministic.",
      "Run pnpm readiness:freshness for a live audit against the current date.",
      "Watch and stale freshness bands mean the source should be rechecked; they do not mean a client is incompatible.",
      "Do not infer production compatibility from devnet participation, prerelease specs, client family, or related implementation code."
    ],
    eipRegistry: {
      lastUpdated: eipRegistry.lastUpdated,
      sourceCount: eipRegistry.sources.length,
      countsByFreshness: countBy(eipRegistry.sources, (source) =>
        sourceFreshness(source.retrievedAt, datasetLastUpdated).band
      ),
      countsBySourceType: countBy(eipRegistry.sources, (source) => source.type),
      countsByStatus: countBy(eipRegistry.eips, (entry) => entry.status),
      sources: eipRegistry.sources.map((source, index) =>
        readinessSource("eip-registry", `sources[${index}]`, source)
      ),
      eips: eipRegistry.eips.map((entry) => ({
        id: entry.id,
        name: entry.name,
        status: entry.status,
        domain: entry.domain,
        detectors: entry.detectors,
        notes: entry.notes
      }))
    },
    clientMatrix: {
      lastUpdated: clientMatrix.lastUpdated,
      sourceCount: clientMatrixSources.length,
      countsByFreshness: countBy(clientMatrixSources, ({ source }) =>
        sourceFreshness(source.retrievedAt, datasetLastUpdated).band
      ),
      countsBySourceType: countBy(clientMatrixSources, ({ source }) => source.type),
      countsByStatus: countBy(clients, (entry) => entry.status),
      countsByRole: countBy(clients, (entry) => entry.role),
      check: {
        ok: matrixCheck.ok,
        warnings: matrixCheck.warnings
      },
      sources: clientMatrixSources.map(({ label, source }) =>
        readinessSource("client-matrix", label, source)
      ),
      clients,
      devnets
    },
    limitations: [
      "Readiness exports are sourced status records, not aggregate mainnet readiness measurements.",
      "Devnet and interop sources remain partial or unknown unless a client release or operator-maintained source explicitly claims production compatibility.",
      "EIP status groupings follow the local registry and must be refreshed when EIP-7773, Forkcast, or primary client/spec sources change."
    ]
  };
}

function readinessSource(
  area: DatasetReadinessSource["area"],
  label: string,
  source: ClientMatrixSource | EipRegistrySource
): DatasetReadinessSource {
  const freshness = sourceFreshness(source.retrievedAt, datasetLastUpdated);

  return {
    area,
    label,
    type: source.type,
    url: source.url,
    sourceDate: source.sourceDate,
    retrievedAt: source.retrievedAt,
    retrievedDaysAgo: freshness.retrievedDaysAgo,
    sourceAgeDays: source.sourceDate ? ageInDays(source.sourceDate) : undefined,
    freshnessAsOf: freshness.asOf,
    freshnessBand: freshness.band,
    freshnessReview: freshness.review,
    claim: source.claim,
    notes: source.notes
  };
}

function assertSourceDate(label: string, lastUpdated: string, source: ClientMatrixSource | EipRegistrySource): void {
  if (source.sourceDate && source.retrievedAt < source.sourceDate) {
    throw new Error(`${label} has retrievedAt ${source.retrievedAt} before sourceDate ${source.sourceDate}.`);
  }
  if (lastUpdated < source.retrievedAt) {
    throw new Error(`${label} has retrievedAt ${source.retrievedAt} after lastUpdated ${lastUpdated}.`);
  }
  if (source.sourceDate && lastUpdated < source.sourceDate) {
    throw new Error(`${label} has sourceDate ${source.sourceDate} after lastUpdated ${lastUpdated}.`);
  }
}

function ageInDays(date: string): number {
  return daysBetweenIsoDates(datasetLastUpdated, date);
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
- \`readiness.json\`: sourced EIP status, client matrix, devnet, and source-freshness visibility derived from \`data/eips/glamsterdam.json\` and \`data/client-compat/clients.example.json\`.
- \`reports.csv\`: flat index of generated reports for spreadsheet and warehouse import.
- \`findings.csv\`: one row per generated report finding, including severity, confidence, domains, and related EIPs.
- \`summary.csv\`: flattened aggregate totals and counts from \`summary.json\`.
- \`readiness-*.csv\`: flattened client, devnet, EIP, and source rows from \`readiness.json\`.
- \`reports/\`: JSON compatibility reports generated from source fixtures.
- \`comparisons/\`: JSON comparison reports for default-vs-research threshold profiles on bytecode and trace fixtures.

## Regenerate

\`\`\`sh
pnpm dataset:generate
\`\`\`

Check committed artifacts are fresh with:

\`\`\`sh
pnpm dataset:check
\`\`\`

Run a live readiness source audit with:

\`\`\`sh
pnpm readiness:freshness
\`\`\`

Then run:

\`\`\`sh
pnpm test
pnpm build
\`\`\`

Review generated changes before publishing. Dataset comparisons are structural report differences only; they do not infer final Glamsterdam gas deltas or client behavior. Readiness freshness bands are source-review prompts; stale sources do not imply incompatibility.
`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  generatePublicDataset();
}
