# Public Seed Dataset

The public seed dataset is a deterministic export generated from fixtures in this repository. It is meant for reproducible scanner review, spreadsheet inspection, and lightweight research workflows.

The dataset lives under `datasets/public-seed/` and is regenerated and checked with:

```sh
pnpm dataset:generate
pnpm dataset:check
pnpm test
pnpm build
```

Treat the dataset as reproducibility scaffolding. It is not an aggregate measurement of public-chain Glamsterdam readiness.

## Files

- `manifest.json`: dataset index, source manifest pointer, threshold profiles, report entries, comparison entries, limitations, and CSV export paths.
- `summary.json`: aggregate counts by fixture kind, source type, report risk, threshold profile, and finding ID.
- `reports.csv`: one row per generated compatibility report.
- `findings.csv`: one row per finding in each generated compatibility report.
- `summary.csv`: flattened count rows from `summary.json`.
- `reports/`: generated JSON compatibility reports.
- `comparisons/`: generated JSON default-vs-research comparison reports for bytecode and trace fixtures.

## CSV Headers

`reports.csv` has one row per report listed in `manifest.json`.

| Column | Meaning |
| --- | --- |
| `sourceFixture` | Source fixture path under `fixtures/`. |
| `fixtureKind` | Scanner kind: `bytecode`, `trace`, `indexer`, or `validator`. |
| `thresholdProfile` | Threshold profile used to generate the report: `default` or `research`. |
| `report` | Generated JSON report path relative to `datasets/public-seed/`. |
| `risk` | Report-level risk from the scanner summary. |
| `findingCount` | Number of findings in the JSON report. |
| `findingIds` | Pipe-delimited finding IDs in report order. |

`findings.csv` has one row per generated report finding.

| Column | Meaning |
| --- | --- |
| `sourceFixture` | Source fixture path under `fixtures/`. |
| `fixtureKind` | Scanner kind for the source fixture. |
| `thresholdProfile` | Threshold profile used to generate the report. |
| `report` | Generated JSON report path relative to `datasets/public-seed/`. |
| `findingIndex` | One-based finding order within the JSON report. |
| `findingId` | Stable scanner finding ID. |
| `title` | Human-readable finding title. |
| `severity` | Finding severity: `low`, `medium`, `high`, or `unknown`. |
| `confidence` | Finding confidence: `low`, `medium`, or `high`. |
| `domains` | Pipe-delimited report domains. |
| `relatedEips` | Pipe-delimited registry IDs related to the finding. |

`summary.csv` has one row per aggregate count.

| Column | Meaning |
| --- | --- |
| `category` | Count group, such as `totals`, `reportsByRisk`, or `findingsById`. |
| `key` | Count key within that group. |
| `count` | Count value as an integer. |

## Joins

Use `report` as the primary join key between `reports.csv`, `findings.csv`, and generated JSON report files:

```text
reports.csv.report = findings.csv.report = manifest.json.reports[].report
```

Use `sourceFixture` plus `thresholdProfile` when comparing generated rows back to source fixtures:

```text
reports.csv.sourceFixture = fixtures/provenance.json.fixtures[].path
reports.csv.thresholdProfile = default | research
```

Use `summary.csv` as a denormalized view of `summary.json`. For example, `category=findingsById` and `key=trace.logs-calls-visible` corresponds to:

```json
{
  "counts": {
    "findingsById": [
      { "key": "trace.logs-calls-visible", "count": 22 }
    ]
  }
}
```

## Stability

Run `pnpm dataset:check` before opening a PR that changes fixtures, scanners, thresholds, registry data, or the client compatibility matrix. The check regenerates the dataset into a temporary directory and compares it with `datasets/public-seed/`. If it reports stale, missing, or extra committed files, run `pnpm dataset:generate` and review the generated artifact changes.

These fields are intended to be stable enough for downstream scripts:

- CSV filenames and headers.
- `sourceFixture` paths for committed fixtures.
- `report` paths for committed fixtures and threshold profiles.
- `fixtureKind`, `thresholdProfile`, `findingId`, `domains`, and `relatedEips` values.

These fields can change when scanner behavior, thresholds, fixtures, or registry metadata changes:

- `risk`, `findingCount`, `findingIndex`, `title`, `severity`, and `confidence`.
- Aggregate counts in `summary.json` and `summary.csv`.
- Comparison report contents under `comparisons/`.

Use `manifest.json.toolVersion`, `summary.json.toolVersion`, and the release tag when comparing exports across releases.

## Import Notes

The CSV files use comma delimiters, RFC-style double-quote escaping, and a single header row. Multi-value fields use `|` as the internal separator.

Spreadsheet users can open the CSVs directly. Warehouse users should import `findingCount`, `findingIndex`, and `count` as integers and keep all path, ID, profile, severity, and confidence fields as strings.

## Example

See `examples/public-seed-analysis.md` for small Node-based analyses that count reports by risk, summarize coverage by fixture kind, and list the most common finding IDs.
