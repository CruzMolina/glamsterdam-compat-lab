#!/usr/bin/env tsx

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  loadFixtureProvenance,
  validateCompatibilityReport,
  validateComparisonReport,
  type ComparisonReport,
  type CompatibilityReport,
  type FixtureProvenanceEntry
} from "../src/index.js";

type ThresholdProfile = "default" | "research";
type ReportRisk = CompatibilityReport["summary"]["risk"];

interface DatasetReportEntry {
  sourceFixture: string;
  fixtureKind: Exclude<FixtureProvenanceEntry["kind"], "report">;
  thresholdProfile: ThresholdProfile;
  report: string;
  risk: ReportRisk;
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

interface PublicSeedManifest {
  schemaVersion: 1;
  name: "public-seed";
  lastUpdated: string;
  description: string;
  toolVersion: string;
  sourceManifest: "fixtures/provenance.json";
  summary: "summary.json";
  csvExports: {
    reports: "reports.csv";
    findings: "findings.csv";
    summary: "summary.csv";
  };
  reports: DatasetReportEntry[];
  comparisons: DatasetComparisonEntry[];
  limitations: string[];
}

interface SiteReportRow extends DatasetReportEntry {
  id: string;
  detailPath: string;
  detailUrl: string;
  sourceType: string;
  sourceName: string;
  sourceUrl?: string;
  description: string;
  findingTitles: string[];
  reportJsonUrl: string;
  reportUrl: string;
  fixtureUrl: string;
  provenanceUrl: string;
  comparisonDetailUrl?: string;
  comparisonDatasetPath?: string;
  comparisonUrl?: string;
  compatibilityReport: CompatibilityReport;
  searchText: string;
}

interface SiteComparisonRow extends DatasetComparisonEntry {
  detailPath: string;
  detailUrl: string;
  comparisonUrl: string;
  baselineReportUrl: string;
  candidateReportUrl: string;
  baselineDetailUrl: string;
  candidateDetailUrl: string;
  fixtureUrl: string;
  comparisonReport: ComparisonReport;
}

interface SiteData {
  generatedAt: string;
  manifest: Pick<PublicSeedManifest, "lastUpdated" | "toolVersion" | "limitations">;
  summary: DatasetSummary;
  reports: SiteReportRow[];
  comparisons: SiteComparisonRow[];
}

export interface GeneratePublicSiteOptions {
  outputDir?: string;
  quiet?: boolean;
}

export interface GeneratePublicSiteResult {
  outputDir: string;
  reportCount: number;
  comparisonCount: number;
}

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultDatasetDir = resolve(rootDir, "datasets/public-seed");
const defaultSiteDir = resolve(rootDir, "site/public-seed");
const generatedAt = "2026-05-13";

export function generatePublicSite(options: GeneratePublicSiteOptions = {}): GeneratePublicSiteResult {
  const outputDir = options.outputDir ? resolve(options.outputDir) : defaultSiteDir;
  const manifest = readJsonFile<PublicSeedManifest>(resolve(defaultDatasetDir, "manifest.json"));
  const summary = readJsonFile<DatasetSummary>(resolve(defaultDatasetDir, manifest.summary));
  const fixtureManifest = loadFixtureProvenance(resolve(rootDir, manifest.sourceManifest));
  const fixturesByPath = new Map(fixtureManifest.fixtures.map((fixture) => [fixture.path, fixture]));
  const comparisonsByFixture = new Map(
    manifest.comparisons.map((comparison) => [comparison.sourceFixture, comparison])
  );
  const reportDetailPaths = new Map(
    manifest.reports.map((entry) => [entry.report, htmlPathForDatasetPath(entry.report)])
  );
  const comparisonDetailPaths = new Map(
    manifest.comparisons.map((entry) => [entry.comparison, htmlPathForDatasetPath(entry.comparison)])
  );
  const comparisonDetailPathsByFixture = new Map(
    manifest.comparisons.map((entry) => [entry.sourceFixture, htmlPathForDatasetPath(entry.comparison)])
  );

  const reports = manifest.reports.map((entry) => {
    const fixture = fixturesByPath.get(entry.sourceFixture);
    const report = validateCompatibilityReport(
      readJsonFile<unknown>(resolve(defaultDatasetDir, entry.report))
    );
    const comparison = comparisonsByFixture.get(entry.sourceFixture);
    const detailPath = reportDetailPaths.get(entry.report) ?? htmlPathForDatasetPath(entry.report);
    const comparisonDetailPath = comparison ? comparisonDetailPathsByFixture.get(entry.sourceFixture) : undefined;
    const findingTitles = report.findings.map((finding) => finding.title);
    const sourceType = fixture?.source.type ?? "unknown";
    const sourceName = fixture?.source.name ?? "Unknown fixture source";
    const description = fixture?.description ?? "No fixture description recorded.";
    const row: SiteReportRow = {
      ...entry,
      id: `${entry.sourceFixture} ${entry.thresholdProfile}`,
      detailPath,
      detailUrl: siteUrl(detailPath),
      sourceType,
      sourceName,
      sourceUrl: fixture?.source.url,
      description,
      findingTitles,
      reportJsonUrl: datasetUrl(entry.report),
      reportUrl: siteUrl(detailPath),
      fixtureUrl: repoUrl(entry.sourceFixture),
      provenanceUrl: repoUrl(manifest.sourceManifest),
      comparisonDetailUrl: comparisonDetailPath ? siteUrl(comparisonDetailPath) : undefined,
      comparisonDatasetPath: comparison?.comparison,
      comparisonUrl: comparison ? datasetUrl(comparison.comparison) : undefined,
      compatibilityReport: report,
      searchText: [
        entry.sourceFixture,
        entry.report,
        entry.fixtureKind,
        entry.thresholdProfile,
        entry.risk,
        sourceType,
        sourceName,
        description,
        ...entry.findingIds,
        ...findingTitles
      ].join(" ").toLowerCase()
    };
    return row;
  });

  const reportsByDatasetPath = new Map(reports.map((report) => [report.report, report]));
  const comparisons = manifest.comparisons.map((entry) => {
    const detailPath = comparisonDetailPaths.get(entry.comparison) ?? htmlPathForDatasetPath(entry.comparison);
    const comparisonReport = validateComparisonReport(
      readJsonFile<unknown>(resolve(defaultDatasetDir, entry.comparison))
    );
    const baselineReport = reportsByDatasetPath.get(entry.baselineReport);
    const candidateReport = reportsByDatasetPath.get(entry.candidateReport);

    if (!baselineReport || !candidateReport) {
      throw new Error(`Comparison references missing site report rows: ${entry.comparison}`);
    }

    return {
      ...entry,
      detailPath,
      detailUrl: siteUrl(detailPath),
      comparisonUrl: datasetUrl(entry.comparison),
      baselineReportUrl: datasetUrl(entry.baselineReport),
      candidateReportUrl: datasetUrl(entry.candidateReport),
      baselineDetailUrl: baselineReport.detailUrl,
      candidateDetailUrl: candidateReport.detailUrl,
      fixtureUrl: repoUrl(entry.sourceFixture),
      comparisonReport
    };
  });

  const siteData: SiteData = {
    generatedAt,
    manifest: {
      lastUpdated: manifest.lastUpdated,
      toolVersion: manifest.toolVersion,
      limitations: manifest.limitations
    },
    summary,
    reports,
    comparisons
  };

  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });
  writeSiteFile(outputDir, "index.html", renderSite(siteData));
  for (const report of reports) {
    writeSiteFile(outputDir, report.detailPath, renderReportDetailPage(siteData, report));
  }
  for (const comparison of comparisons) {
    writeSiteFile(outputDir, comparison.detailPath, renderComparisonDetailPage(siteData, comparison));
  }

  if (!options.quiet) {
    process.stdout.write(`Generated public seed site with ${reports.length} reports and ${comparisons.length} comparisons.\n`);
  }

  return {
    outputDir,
    reportCount: reports.length,
    comparisonCount: comparisons.length
  };
}

function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function writeSiteFile(outputDir: string, path: string, content: string): void {
  const filePath = resolve(outputDir, path);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

function datasetUrl(path: string): string {
  return repoUrl(`datasets/public-seed/${path}`);
}

function detailDatasetUrl(path: string): string {
  return repoUrl(`datasets/public-seed/${path}`, "../../..");
}

function detailRepoUrl(path: string): string {
  return repoUrl(path, "../../..");
}

function repoUrl(path: string, rootPrefix = "../.."): string {
  return `${rootPrefix}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

function siteUrl(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

function htmlPathForDatasetPath(path: string): string {
  return path.replace(/\.json$/, ".html");
}

function renderSite(data: SiteData): string {
  const risks = uniqueSorted(data.reports.map((report) => report.risk));
  const fixtureKinds = uniqueSorted(data.reports.map((report) => report.fixtureKind));
  const thresholdProfiles = uniqueSorted(data.reports.map((report) => report.thresholdProfile));
  const topFindings = sortCounts(data.summary.counts.findingsById).slice(0, 10);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Glamsterdam public seed dataset</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f7f5ef;
      --surface: #ffffff;
      --surface-muted: #f0eee7;
      --border: #d8d2c8;
      --text: #242620;
      --muted: #64665f;
      --strong: #11130f;
      --accent: #236f5d;
      --accent-soft: #dbece7;
      --blue: #345995;
      --amber: #a86617;
      --red: #9d3e3e;
      --unknown: #6b6470;
      --shadow: 0 1px 2px rgba(31, 35, 28, 0.08);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-size: 15px;
      line-height: 1.45;
    }

    a {
      color: var(--blue);
      text-decoration-thickness: 1px;
      text-underline-offset: 3px;
    }

    a:hover {
      color: var(--accent);
    }

    .shell {
      width: min(1280px, calc(100% - 32px));
      margin: 0 auto;
      padding: 28px 0 40px;
    }

    header {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 18px;
      align-items: end;
      padding-bottom: 18px;
      border-bottom: 1px solid var(--border);
    }

    h1,
    h2,
    h3,
    p {
      margin: 0;
    }

    h1 {
      color: var(--strong);
      font-size: 28px;
      font-weight: 720;
      letter-spacing: 0;
    }

    h2 {
      color: var(--strong);
      font-size: 18px;
      font-weight: 680;
      letter-spacing: 0;
    }

    h3 {
      color: var(--strong);
      font-size: 15px;
      font-weight: 680;
      letter-spacing: 0;
    }

    .subtle {
      color: var(--muted);
    }

    .meta {
      display: grid;
      gap: 4px;
      color: var(--muted);
      font-size: 13px;
      text-align: right;
    }

    section {
      padding: 22px 0;
      border-bottom: 1px solid var(--border);
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(4, minmax(150px, 1fr));
      gap: 10px;
      margin-top: 14px;
    }

    .stat {
      min-height: 86px;
      padding: 14px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 6px;
      box-shadow: var(--shadow);
    }

    .stat-value {
      display: block;
      color: var(--strong);
      font-size: 26px;
      font-weight: 760;
      line-height: 1.1;
    }

    .stat-label {
      display: block;
      margin-top: 6px;
      color: var(--muted);
      font-size: 13px;
    }

    .link-row,
    .filter-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin-top: 12px;
    }

    .link-row a,
    .chip {
      display: inline-flex;
      align-items: center;
      min-height: 30px;
      padding: 5px 9px;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: var(--surface);
      color: var(--text);
      font-size: 13px;
      text-decoration: none;
      white-space: nowrap;
    }

    .chart-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 12px;
      margin-top: 14px;
    }

    .chart {
      min-width: 0;
      padding: 14px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 6px;
      box-shadow: var(--shadow);
    }

    .chart-wide {
      grid-column: span 2;
    }

    .bar-list {
      display: grid;
      gap: 9px;
      margin-top: 12px;
    }

    .bar-row {
      display: grid;
      grid-template-columns: minmax(96px, 1fr) minmax(96px, 2fr) 42px;
      gap: 8px;
      align-items: center;
      min-height: 24px;
      font-size: 13px;
    }

    .bar-label {
      min-width: 0;
      overflow-wrap: anywhere;
      color: var(--text);
    }

    .bar-track {
      height: 10px;
      background: var(--surface-muted);
      border-radius: 999px;
      overflow: hidden;
    }

    .bar {
      display: block;
      width: var(--bar-width);
      min-width: 3px;
      height: 100%;
      background: var(--accent);
    }

    .bar-count {
      color: var(--muted);
      font-variant-numeric: tabular-nums;
      text-align: right;
    }

    label {
      display: grid;
      gap: 4px;
      color: var(--muted);
      font-size: 12px;
      font-weight: 620;
    }

    select,
    input[type="search"],
    button {
      min-height: 36px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--surface);
      color: var(--text);
      font: inherit;
      font-size: 14px;
    }

    select {
      padding: 0 34px 0 10px;
    }

    input[type="search"] {
      width: min(480px, 100%);
      padding: 0 11px;
    }

    button {
      align-self: end;
      padding: 0 12px;
      cursor: pointer;
    }

    button:hover {
      border-color: var(--accent);
      color: var(--accent);
    }

    .table-wrap {
      margin-top: 12px;
      overflow-x: auto;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 6px;
      box-shadow: var(--shadow);
    }

    table {
      width: 100%;
      min-width: 1050px;
      border-collapse: collapse;
    }

    th,
    td {
      padding: 10px 12px;
      border-bottom: 1px solid var(--border);
      vertical-align: top;
      text-align: left;
    }

    th {
      background: var(--surface-muted);
      color: var(--muted);
      font-size: 12px;
      font-weight: 720;
      text-transform: uppercase;
      letter-spacing: 0;
    }

    tbody tr:last-child td {
      border-bottom: 0;
    }

    tbody tr[hidden] {
      display: none;
    }

    .path,
    .finding-list {
      overflow-wrap: anywhere;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      font-size: 12px;
      line-height: 1.45;
    }

    .finding-list {
      color: var(--muted);
    }

    .badge {
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 720;
      white-space: nowrap;
    }

    .risk-low {
      background: #e1f0df;
      color: #236126;
    }

    .risk-medium {
      background: #fae8c9;
      color: var(--amber);
    }

    .risk-high {
      background: #f3d6d6;
      color: var(--red);
    }

    .risk-unknown {
      background: #e5e0e8;
      color: var(--unknown);
    }

    .cell-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      min-width: 160px;
    }

    .cell-actions a {
      font-size: 13px;
      white-space: nowrap;
    }

    .empty-state {
      display: none;
      margin-top: 12px;
      padding: 14px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--muted);
    }

    .limitations {
      margin: 10px 0 0;
      padding-left: 18px;
      color: var(--muted);
    }

    .limitations li {
      margin: 5px 0;
    }

    @media (max-width: 820px) {
      .shell {
        width: min(100% - 20px, 1280px);
        padding-top: 18px;
      }

      header {
        grid-template-columns: 1fr;
        align-items: start;
      }

      .meta {
        text-align: left;
      }

      .stats {
        grid-template-columns: repeat(2, minmax(130px, 1fr));
      }

      .filter-row {
        align-items: stretch;
      }

      .chart-wide {
        grid-column: auto;
      }

      label,
      select,
      input[type="search"],
      button {
        width: 100%;
      }
    }

    @media (max-width: 520px) {
      h1 {
        font-size: 24px;
      }

      .stats {
        grid-template-columns: 1fr;
      }

      .bar-row {
        grid-template-columns: 1fr 1fr 36px;
      }
    }
  </style>
</head>
<body>
  <main class="shell">
    <header>
      <div>
        <h1>Glamsterdam public seed dataset</h1>
        <p class="subtle">Static browser for committed fixture reports, threshold comparisons, and provenance.</p>
      </div>
      <div class="meta" aria-label="Dataset metadata">
        <span>Dataset ${escapeHtml(data.manifest.lastUpdated)}</span>
        <span>Tool ${escapeHtml(data.manifest.toolVersion)}</span>
        <span>Site ${escapeHtml(data.generatedAt)}</span>
      </div>
    </header>

    <section aria-labelledby="summary-heading">
      <h2 id="summary-heading">Summary</h2>
      <div class="stats">
        ${stat("Fixtures", data.summary.fixtureCount)}
        ${stat("Reports", data.summary.reportCount)}
        ${stat("Comparisons", data.summary.comparisonCount)}
        ${stat("Findings", data.summary.counts.findingsById.reduce((total, item) => total + item.count, 0))}
      </div>
      <div class="link-row" aria-label="Dataset files">
        <a href="${datasetUrl("manifest.json")}">manifest.json</a>
        <a href="${datasetUrl("summary.json")}">summary.json</a>
        <a href="${datasetUrl("reports.csv")}">reports.csv</a>
        <a href="${datasetUrl("findings.csv")}">findings.csv</a>
        <a href="${datasetUrl("summary.csv")}">summary.csv</a>
        <a href="${repoUrl("fixtures/provenance.json")}">fixture provenance</a>
      </div>
    </section>

    <section aria-labelledby="charts-heading">
      <h2 id="charts-heading">Distribution</h2>
      <div class="chart-grid">
        ${chart("Reports by risk", sortCounts(data.summary.counts.reportsByRisk))}
        ${chart("Reports by fixture kind", sortCounts(data.summary.counts.reportsByFixtureKind))}
        ${chart("Reports by threshold", sortCounts(data.summary.counts.reportsByThresholdProfile))}
        ${chart("Fixtures by source", sortCounts(data.summary.counts.fixturesBySourceType))}
        ${chart("Most common finding IDs", topFindings, " chart-wide")}
      </div>
    </section>

    <section aria-labelledby="reports-heading">
      <h2 id="reports-heading">Reports</h2>
      <div class="filter-row" role="search">
        ${selectFilter("risk-filter", "Risk", risks)}
        ${selectFilter("kind-filter", "Fixture kind", fixtureKinds)}
        ${selectFilter("profile-filter", "Threshold", thresholdProfiles)}
        <label for="report-search">Search
          <input id="report-search" type="search" autocomplete="off" placeholder="Report, finding ID, fixture path">
        </label>
        <button id="reset-filters" type="button">Reset</button>
        <a class="chip" id="share-link" href="index.html">Share view</a>
        <span class="chip" id="visible-count">${data.reports.length} of ${data.reports.length} reports</span>
      </div>
      <div class="table-wrap">
        <table aria-describedby="visible-count">
          <thead>
            <tr>
              <th scope="col">Fixture</th>
              <th scope="col">Source</th>
              <th scope="col">Kind</th>
              <th scope="col">Profile</th>
              <th scope="col">Risk</th>
              <th scope="col">Findings</th>
              <th scope="col">Links</th>
            </tr>
          </thead>
          <tbody>
            ${data.reports.map(reportRow).join("\n")}
          </tbody>
        </table>
      </div>
      <div class="empty-state" id="empty-state">No reports match the current filters.</div>
    </section>

    <section aria-labelledby="comparisons-heading">
      <h2 id="comparisons-heading">Threshold Comparisons</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Fixture</th>
              <th scope="col">Risk change</th>
              <th scope="col">Added</th>
              <th scope="col">Removed</th>
              <th scope="col">Changed</th>
              <th scope="col">Unchanged</th>
              <th scope="col">Links</th>
            </tr>
          </thead>
          <tbody>
            ${data.comparisons.map(comparisonRow).join("\n")}
          </tbody>
        </table>
      </div>
    </section>

    <section aria-labelledby="limits-heading">
      <h2 id="limits-heading">Limitations</h2>
      <ul class="limitations">
        ${data.manifest.limitations.map((limitation) => `<li>${escapeHtml(limitation)}</li>`).join("\n")}
      </ul>
    </section>
  </main>
  <script id="site-data" type="application/json">${safeScriptJson({
    generatedAt: data.generatedAt,
    reportCount: data.reports.length,
    comparisonCount: data.comparisons.length
  })}</script>
  <script>
    const rows = Array.from(document.querySelectorAll(".report-row"));
    const riskFilter = document.getElementById("risk-filter");
    const kindFilter = document.getElementById("kind-filter");
    const profileFilter = document.getElementById("profile-filter");
    const searchInput = document.getElementById("report-search");
    const resetButton = document.getElementById("reset-filters");
    const shareLink = document.getElementById("share-link");
    const visibleCount = document.getElementById("visible-count");
    const emptyState = document.getElementById("empty-state");
    const initialParams = new URLSearchParams(window.location.search);

    function selectFromQuery(select, key) {
      const value = initialParams.get(key);
      if (!value) {
        return;
      }
      for (const option of Array.from(select.options)) {
        if (option.value === value) {
          select.value = value;
          return;
        }
      }
    }

    selectFromQuery(riskFilter, "risk");
    selectFromQuery(kindFilter, "kind");
    selectFromQuery(profileFilter, "profile");
    searchInput.value = initialParams.get("q") ?? "";

    function currentParams() {
      const params = new URLSearchParams();
      const query = searchInput.value.trim();

      if (riskFilter.value !== "all") {
        params.set("risk", riskFilter.value);
      }
      if (kindFilter.value !== "all") {
        params.set("kind", kindFilter.value);
      }
      if (profileFilter.value !== "all") {
        params.set("profile", profileFilter.value);
      }
      if (query.length > 0) {
        params.set("q", query);
      }

      return params;
    }

    function writeFilterState() {
      const params = currentParams();
      const query = params.toString();
      const path = window.location.pathname;
      const nextUrl = query.length > 0 ? path + "?" + query : path;

      history.replaceState(null, "", nextUrl);
      shareLink.href = query.length > 0 ? "index.html?" + query : "index.html";
    }

    function applyFilters(updateUrl = true) {
      const query = searchInput.value.trim().toLowerCase();
      let visible = 0;

      for (const row of rows) {
        const matchesRisk = riskFilter.value === "all" || row.dataset.risk === riskFilter.value;
        const matchesKind = kindFilter.value === "all" || row.dataset.kind === kindFilter.value;
        const matchesProfile = profileFilter.value === "all" || row.dataset.profile === profileFilter.value;
        const matchesSearch = query.length === 0 || row.dataset.search.includes(query);
        const shouldShow = matchesRisk && matchesKind && matchesProfile && matchesSearch;

        row.hidden = !shouldShow;
        if (shouldShow) {
          visible += 1;
        }
      }

      visibleCount.textContent = visible + " of " + rows.length + " reports";
      emptyState.style.display = visible === 0 ? "block" : "none";
      if (updateUrl) {
        writeFilterState();
      }
    }

    for (const control of [riskFilter, kindFilter, profileFilter, searchInput]) {
      control.addEventListener("input", applyFilters);
    }

    resetButton.addEventListener("click", () => {
      riskFilter.value = "all";
      kindFilter.value = "all";
      profileFilter.value = "all";
      searchInput.value = "";
      applyFilters();
      searchInput.focus();
    });

    applyFilters(false);
    writeFilterState();
  </script>
</body>
</html>
`;
}

function stat(label: string, value: string | number): string {
  const displayValue = typeof value === "number" ? value.toLocaleString("en-US") : value;
  return `<div class="stat"><span class="stat-value">${escapeHtml(displayValue)}</span><span class="stat-label">${escapeHtml(label)}</span></div>`;
}

function chart(title: string, counts: DatasetSummaryCount[], className = ""): string {
  const max = Math.max(...counts.map((count) => count.count), 1);
  return `<div class="chart${className}">
    <h3>${escapeHtml(title)}</h3>
    <div class="bar-list">
      ${counts.map((count) => {
        const width = Math.max(3, Math.round((count.count / max) * 100));
        return `<div class="bar-row">
          <span class="bar-label">${escapeHtml(count.key)}</span>
          <span class="bar-track" aria-hidden="true"><span class="bar" style="--bar-width: ${width}%"></span></span>
          <span class="bar-count">${count.count.toLocaleString("en-US")}</span>
        </div>`;
      }).join("\n")}
    </div>
  </div>`;
}

function selectFilter(id: string, label: string, options: string[]): string {
  return `<label for="${escapeAttr(id)}">${escapeHtml(label)}
    <select id="${escapeAttr(id)}">
      <option value="all">All</option>
      ${options.map((option) => `<option value="${escapeAttr(option)}">${escapeHtml(option)}</option>`).join("\n")}
    </select>
  </label>`;
}

function reportRow(report: SiteReportRow): string {
  return `<tr class="report-row" data-risk="${escapeAttr(report.risk)}" data-kind="${escapeAttr(report.fixtureKind)}" data-profile="${escapeAttr(report.thresholdProfile)}" data-search="${escapeAttr(report.searchText)}">
    <td>
      <div class="path">${escapeHtml(report.sourceFixture)}</div>
      <div class="subtle">${escapeHtml(report.description)}</div>
    </td>
    <td>
      <strong>${escapeHtml(report.sourceType)}</strong>
      <div class="subtle">${escapeHtml(report.sourceName)}</div>
    </td>
    <td>${escapeHtml(report.fixtureKind)}</td>
    <td>${escapeHtml(report.thresholdProfile)}</td>
    <td><span class="badge risk-${escapeAttr(report.risk)}">${escapeHtml(report.risk)}</span></td>
    <td>
      <strong>${report.findingCount.toLocaleString("en-US")}</strong>
      <div class="finding-list">${escapeHtml(report.findingIds.join(", "))}</div>
    </td>
    <td>
      <div class="cell-actions">
        <a href="${escapeAttr(report.reportUrl)}">details</a>
        <a href="${escapeAttr(report.reportJsonUrl)}">json</a>
        ${report.comparisonDetailUrl ? `<a href="${escapeAttr(report.comparisonDetailUrl)}">comparison</a>` : ""}
        <a href="${escapeAttr(report.fixtureUrl)}">fixture</a>
        <a href="${escapeAttr(report.provenanceUrl)}">provenance</a>
        ${report.sourceUrl ? `<a href="${escapeAttr(report.sourceUrl)}" rel="noopener">source</a>` : ""}
      </div>
    </td>
  </tr>`;
}

function comparisonRow(comparison: SiteComparisonRow): string {
  return `<tr>
    <td class="path">${escapeHtml(comparison.sourceFixture)}</td>
    <td>${escapeHtml(comparison.riskChange)}</td>
    <td>${comparison.addedCount.toLocaleString("en-US")}</td>
    <td>${comparison.removedCount.toLocaleString("en-US")}</td>
    <td>${comparison.changedCount.toLocaleString("en-US")}</td>
    <td>${comparison.unchangedCount.toLocaleString("en-US")}</td>
    <td>
      <div class="cell-actions">
        <a href="${escapeAttr(comparison.detailUrl)}">details</a>
        <a href="${escapeAttr(comparison.comparisonUrl)}">json</a>
        <a href="${escapeAttr(comparison.baselineDetailUrl)}">default</a>
        <a href="${escapeAttr(comparison.candidateDetailUrl)}">research</a>
        <a href="${escapeAttr(comparison.fixtureUrl)}">fixture</a>
      </div>
    </td>
  </tr>`;
}

function renderReportDetailPage(data: SiteData, report: SiteReportRow): string {
  const compatibilityReport = report.compatibilityReport;
  const body = `
    <section aria-labelledby="summary-heading">
      <h2 id="summary-heading">Summary</h2>
      <div class="stats">
        ${stat("Risk", report.risk)}
        ${stat("Findings", report.findingCount)}
        ${stat("Medium", compatibilityReport.summary.mediumCount)}
        ${stat("Unknown", compatibilityReport.summary.unknownCount)}
      </div>
      ${detailLinkRow([
        ["filtered index", filteredIndexUrl(report)],
        ["report json", detailDatasetUrl(report.report)],
        report.comparisonDetailUrl ? ["comparison", detailSiteUrl(report.comparisonDetailUrl)] : undefined,
        report.comparisonDatasetPath ? ["comparison json", detailDatasetUrl(report.comparisonDatasetPath)] : undefined,
        ["source fixture", detailRepoUrl(report.sourceFixture)],
        ["provenance", detailRepoUrl("fixtures/provenance.json")],
        report.sourceUrl ? ["source", report.sourceUrl] : undefined
      ])}
    </section>

    <section aria-labelledby="source-heading">
      <h2 id="source-heading">Source</h2>
      <div class="detail-grid">
        ${detailPanel("Fixture", [
          ["Path", report.sourceFixture],
          ["Kind", report.fixtureKind],
          ["Profile", report.thresholdProfile],
          ["Report", report.report]
        ])}
        ${detailPanel("Provenance", [
          ["Source type", report.sourceType],
          ["Source name", report.sourceName],
          ["Description", report.description]
        ])}
      </div>
    </section>

    <section aria-labelledby="findings-heading">
      <h2 id="findings-heading">Findings</h2>
      ${compatibilityReport.findings.length === 0
        ? `<div class="empty-state visible">No findings in this report.</div>`
        : compatibilityReport.findings.map((finding, index) => reportFindingBlock(finding, index)).join("\n")}
    </section>

    ${detailTextSection("Assumptions", compatibilityReport.assumptions)}
    ${detailTextSection("Limitations", compatibilityReport.limitations)}
  `;

  return renderDetailShell({
    title: `Report: ${report.sourceFixture}`,
    subtitle: `${report.fixtureKind} / ${report.thresholdProfile} / ${report.risk}`,
    data,
    body
  });
}

function renderComparisonDetailPage(data: SiteData, comparison: SiteComparisonRow): string {
  const report = comparison.comparisonReport;
  const body = `
    <section aria-labelledby="summary-heading">
      <h2 id="summary-heading">Summary</h2>
      <div class="stats">
        ${stat("Risk change", comparison.riskChange)}
        ${stat("Added", comparison.addedCount)}
        ${stat("Removed", comparison.removedCount)}
        ${stat("Changed", comparison.changedCount)}
      </div>
      ${detailLinkRow([
        ["filtered index", comparisonIndexUrl(comparison)],
        ["comparison json", detailDatasetUrl(comparison.comparison)],
        ["default report", detailSiteUrl(comparison.baselineDetailUrl)],
        ["research report", detailSiteUrl(comparison.candidateDetailUrl)],
        ["default json", detailDatasetUrl(comparison.baselineReport)],
        ["research json", detailDatasetUrl(comparison.candidateReport)],
        ["source fixture", detailRepoUrl(comparison.sourceFixture)]
      ])}
    </section>

    <section aria-labelledby="reports-heading">
      <h2 id="reports-heading">Reports</h2>
      <div class="detail-grid">
        ${detailPanel("Default", [
          ["Risk", report.comparison.baseline.summary.risk],
          ["Findings", String(report.comparison.baseline.summary.findingCount)],
          ["Target", report.comparison.baseline.target.name],
          ["Kind", report.comparison.baseline.target.kind]
        ])}
        ${detailPanel("Research", [
          ["Risk", report.comparison.candidate.summary.risk],
          ["Findings", String(report.comparison.candidate.summary.findingCount)],
          ["Target", report.comparison.candidate.target.name],
          ["Kind", report.comparison.candidate.target.kind]
        ])}
      </div>
    </section>

    ${comparisonSection("Added", report.changes.added)}
    ${comparisonSection("Removed", report.changes.removed)}
    ${changedComparisonSection(report.changes.changed)}
    ${comparisonSection("Unchanged", report.changes.unchanged)}
    ${detailTextSection("Assumptions", report.assumptions)}
    ${detailTextSection("Limitations", report.limitations)}
  `;

  return renderDetailShell({
    title: `Comparison: ${comparison.sourceFixture}`,
    subtitle: "default vs research threshold profiles",
    data,
    body
  });
}

function renderDetailShell(input: {
  title: string;
  subtitle: string;
  data: SiteData;
  body: string;
}): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(input.title)}</title>
  <style>
    ${detailStyles()}
  </style>
</head>
<body>
  <main class="shell">
    <header>
      <div>
        <div class="nav-row">
          <a href="../index.html">Index</a>
        </div>
        <h1>${escapeHtml(input.title)}</h1>
        <p class="subtle">${escapeHtml(input.subtitle)}</p>
      </div>
      <div class="meta" aria-label="Dataset metadata">
        <span>Dataset ${escapeHtml(input.data.manifest.lastUpdated)}</span>
        <span>Tool ${escapeHtml(input.data.manifest.toolVersion)}</span>
        <span>Site ${escapeHtml(input.data.generatedAt)}</span>
      </div>
    </header>
    ${input.body}
  </main>
</body>
</html>
`;
}

function detailStyles(): string {
  return `
    :root {
      color-scheme: light;
      --bg: #f7f5ef;
      --surface: #ffffff;
      --surface-muted: #f0eee7;
      --border: #d8d2c8;
      --text: #242620;
      --muted: #64665f;
      --strong: #11130f;
      --accent: #236f5d;
      --blue: #345995;
      --amber: #a86617;
      --red: #9d3e3e;
      --unknown: #6b6470;
      --shadow: 0 1px 2px rgba(31, 35, 28, 0.08);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-size: 15px;
      line-height: 1.45;
    }

    a {
      color: var(--blue);
      text-decoration-thickness: 1px;
      text-underline-offset: 3px;
    }

    a:hover {
      color: var(--accent);
    }

    .shell {
      width: min(1180px, calc(100% - 32px));
      margin: 0 auto;
      padding: 28px 0 40px;
    }

    header {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 18px;
      align-items: end;
      padding-bottom: 18px;
      border-bottom: 1px solid var(--border);
    }

    h1,
    h2,
    h3,
    p {
      margin: 0;
    }

    h1 {
      color: var(--strong);
      font-size: 25px;
      font-weight: 720;
      letter-spacing: 0;
      overflow-wrap: anywhere;
    }

    h2 {
      color: var(--strong);
      font-size: 18px;
      font-weight: 680;
      letter-spacing: 0;
    }

    h3 {
      color: var(--strong);
      font-size: 15px;
      font-weight: 680;
      letter-spacing: 0;
    }

    section {
      padding: 22px 0;
      border-bottom: 1px solid var(--border);
    }

    .subtle,
    .meta {
      color: var(--muted);
    }

    .meta {
      display: grid;
      gap: 4px;
      font-size: 13px;
      text-align: right;
    }

    .nav-row,
    .link-row,
    .cell-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }

    .nav-row {
      margin-bottom: 8px;
    }

    .link-row {
      margin-top: 12px;
    }

    .nav-row a,
    .link-row a {
      display: inline-flex;
      align-items: center;
      min-height: 30px;
      padding: 5px 9px;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: var(--surface);
      color: var(--text);
      font-size: 13px;
      text-decoration: none;
      white-space: nowrap;
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(4, minmax(140px, 1fr));
      gap: 10px;
      margin-top: 14px;
    }

    .stat,
    .panel,
    .finding,
    .table-wrap {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 6px;
      box-shadow: var(--shadow);
    }

    .stat {
      min-height: 78px;
      padding: 14px;
    }

    .stat-value {
      display: block;
      color: var(--strong);
      font-size: 22px;
      font-weight: 760;
      line-height: 1.2;
      overflow-wrap: anywhere;
    }

    .stat-label {
      display: block;
      margin-top: 6px;
      color: var(--muted);
      font-size: 13px;
    }

    .detail-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 12px;
      margin-top: 12px;
    }

    .panel {
      padding: 14px;
    }

    .kv {
      display: grid;
      grid-template-columns: 112px minmax(0, 1fr);
      gap: 8px;
      margin-top: 10px;
      font-size: 13px;
    }

    .kv dt {
      color: var(--muted);
      font-weight: 680;
    }

    .kv dd {
      margin: 0;
      overflow-wrap: anywhere;
    }

    .finding {
      margin-top: 12px;
      padding: 14px;
    }

    .finding-head {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
    }

    .finding-title {
      display: grid;
      gap: 4px;
    }

    .path,
    code,
    pre {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      font-size: 12px;
    }

    .path {
      overflow-wrap: anywhere;
    }

    pre {
      max-height: 260px;
      margin: 10px 0 0;
      padding: 12px;
      overflow: auto;
      background: var(--surface-muted);
      border: 1px solid var(--border);
      border-radius: 6px;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 720;
      white-space: nowrap;
    }

    .risk-low {
      background: #e1f0df;
      color: #236126;
    }

    .risk-medium {
      background: #fae8c9;
      color: var(--amber);
    }

    .risk-high {
      background: #f3d6d6;
      color: var(--red);
    }

    .risk-unknown {
      background: #e5e0e8;
      color: var(--unknown);
    }

    .table-wrap {
      margin-top: 12px;
      overflow-x: auto;
    }

    table {
      width: 100%;
      min-width: 760px;
      border-collapse: collapse;
    }

    th,
    td {
      padding: 10px 12px;
      border-bottom: 1px solid var(--border);
      vertical-align: top;
      text-align: left;
    }

    th {
      background: var(--surface-muted);
      color: var(--muted);
      font-size: 12px;
      font-weight: 720;
      text-transform: uppercase;
      letter-spacing: 0;
    }

    tbody tr:last-child td {
      border-bottom: 0;
    }

    ul {
      margin: 10px 0 0;
      padding-left: 18px;
      color: var(--muted);
    }

    li {
      margin: 5px 0;
    }

    .empty-state {
      margin-top: 12px;
      padding: 14px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--muted);
    }

    @media (max-width: 820px) {
      .shell {
        width: min(100% - 20px, 1180px);
        padding-top: 18px;
      }

      header {
        grid-template-columns: 1fr;
        align-items: start;
      }

      .meta {
        text-align: left;
      }

      .stats {
        grid-template-columns: repeat(2, minmax(130px, 1fr));
      }
    }

    @media (max-width: 520px) {
      h1 {
        font-size: 22px;
      }

      .stats {
        grid-template-columns: 1fr;
      }

      .kv {
        grid-template-columns: 1fr;
      }
    }
  `;
}

function detailLinkRow(links: Array<[string, string] | undefined>): string {
  return `<div class="link-row">${links
    .filter((link): link is [string, string] => Boolean(link))
    .map(([label, href]) => `<a href="${escapeAttr(href)}">${escapeHtml(label)}</a>`)
    .join("\n")}</div>`;
}

function detailPanel(title: string, rows: Array<[string, string]>): string {
  return `<div class="panel">
    <h3>${escapeHtml(title)}</h3>
    <dl class="kv">
      ${rows.map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd>`).join("\n")}
    </dl>
  </div>`;
}

function reportFindingBlock(finding: CompatibilityReport["findings"][number], index: number): string {
  return `<article class="finding">
    <div class="finding-head">
      <div class="finding-title">
        <h3>${index + 1}. ${escapeHtml(finding.title)}</h3>
        <div class="path">${escapeHtml(finding.id)}</div>
      </div>
      <div class="cell-actions">
        <span class="badge risk-${escapeAttr(finding.severity)}">${escapeHtml(finding.severity)}</span>
        <span class="badge risk-${escapeAttr(finding.confidence)}">${escapeHtml(finding.confidence)} confidence</span>
      </div>
    </div>
    <p>${escapeHtml(finding.description)}</p>
    ${findingMetadata(finding)}
    ${finding.evidence.length > 0 ? `<pre><code>${escapeHtml(JSON.stringify(finding.evidence, null, 2))}</code></pre>` : ""}
  </article>`;
}

function findingMetadata(finding: CompatibilityReport["findings"][number]): string {
  return `<dl class="kv">
    <dt>Domains</dt><dd>${escapeHtml(finding.domain.join(", "))}</dd>
    <dt>Related EIPs</dt><dd>${escapeHtml(finding.relatedEips.length > 0 ? finding.relatedEips.join(", ") : "none")}</dd>
    <dt>Recommendation</dt><dd>${escapeHtml(finding.recommendation)}</dd>
  </dl>`;
}

function comparisonSection(title: string, rows: ComparisonReport["changes"]["added"]): string {
  return `<section aria-labelledby="${escapeAttr(sectionId(title))}">
    <h2 id="${escapeAttr(sectionId(title))}">${escapeHtml(title)}</h2>
    ${rows.length === 0 ? `<div class="empty-state">No ${escapeHtml(title.toLowerCase())} findings.</div>` : comparisonFindingsTable(rows)}
  </section>`;
}

function changedComparisonSection(rows: ComparisonReport["changes"]["changed"]): string {
  return `<section aria-labelledby="changed-findings">
    <h2 id="changed-findings">Changed</h2>
    ${rows.length === 0 ? `<div class="empty-state">No changed findings.</div>` : `<div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">Finding</th>
            <th scope="col">Fields</th>
            <th scope="col">Severity</th>
            <th scope="col">Confidence</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `<tr>
            <td><strong>${escapeHtml(row.candidate.title)}</strong><div class="path">${escapeHtml(row.id)}</div></td>
            <td>${escapeHtml(row.changedFields.join(", "))}</td>
            <td>${row.severityChange ? escapeHtml(`${row.severityChange.from} -> ${row.severityChange.to}`) : "unchanged"}</td>
            <td>${row.confidenceChange ? escapeHtml(`${row.confidenceChange.from} -> ${row.confidenceChange.to}`) : "unchanged"}</td>
          </tr>`).join("\n")}
        </tbody>
      </table>
    </div>`}
  </section>`;
}

function comparisonFindingsTable(rows: ComparisonReport["changes"]["added"]): string {
  return `<div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th scope="col">Finding</th>
          <th scope="col">Severity</th>
          <th scope="col">Confidence</th>
          <th scope="col">Domains</th>
          <th scope="col">Related EIPs</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => `<tr>
          <td><strong>${escapeHtml(row.title)}</strong><div class="path">${escapeHtml(row.id)}</div></td>
          <td><span class="badge risk-${escapeAttr(row.severity)}">${escapeHtml(row.severity)}</span></td>
          <td>${escapeHtml(row.confidence)}</td>
          <td>${escapeHtml(row.domain.join(", "))}</td>
          <td>${escapeHtml(row.relatedEips.length > 0 ? row.relatedEips.join(", ") : "none")}</td>
        </tr>`).join("\n")}
      </tbody>
    </table>
  </div>`;
}

function detailTextSection(title: string, rows: string[]): string {
  if (rows.length === 0) {
    return "";
  }

  return `<section aria-labelledby="${escapeAttr(sectionId(title))}">
    <h2 id="${escapeAttr(sectionId(title))}">${escapeHtml(title)}</h2>
    <ul>${rows.map((row) => `<li>${escapeHtml(row)}</li>`).join("\n")}</ul>
  </section>`;
}

function detailSiteUrl(path: string): string {
  return `../${siteUrl(path)}`;
}

function filteredIndexUrl(report: SiteReportRow): string {
  return `../index.html?risk=${encodeURIComponent(report.risk)}&kind=${encodeURIComponent(report.fixtureKind)}&profile=${encodeURIComponent(report.thresholdProfile)}&q=${encodeURIComponent(report.sourceFixture)}`;
}

function comparisonIndexUrl(comparison: SiteComparisonRow): string {
  return `../index.html?kind=${encodeURIComponent(comparison.comparisonReport.comparison.baseline.target.kind)}&q=${encodeURIComponent(comparison.sourceFixture)}`;
}

function sectionId(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function sortCounts(counts: DatasetSummaryCount[]): DatasetSummaryCount[] {
  return [...counts].sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

function safeScriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  generatePublicSite();
}
