# Public Seed Dataset

The public seed dataset is a deterministic export generated from fixtures in this repository. It is meant for reproducible scanner review, spreadsheet inspection, and lightweight research workflows.

The dataset lives under `datasets/public-seed/` and is regenerated and checked with:

```sh
pnpm dataset:generate
pnpm dataset:check
pnpm readiness:freshness
pnpm site:generate
pnpm site:check
pnpm test
pnpm build
```

Treat the dataset as reproducibility scaffolding. It is not an aggregate measurement of public-chain Glamsterdam readiness.

## Files

- `manifest.json`: dataset index, source manifest pointer, threshold profiles, report entries, comparison entries, limitations, and CSV export paths.
- `summary.json`: aggregate counts by fixture kind, source type, report risk, threshold profile, and finding ID.
- `readiness.json`: sourced EIP status, client matrix, devnet participant, spec-version, and source-freshness visibility derived from `data/eips/glamsterdam.json` and `data/client-compat/clients.example.json`.
- `reports.csv`: one row per generated compatibility report.
- `findings.csv`: one row per finding in each generated compatibility report.
- `summary.csv`: flattened count rows from `summary.json`.
- `readiness-clients.csv`: one row per client/version matrix entry.
- `readiness-devnets.csv`: one row per devnet participant, or one devnet-only row when no participants are recorded.
- `readiness-eips.csv`: one row per tracked registry entry, including scheduled, considered, declined, and proposed status groupings.
- `readiness-sources.csv`: one row per EIP registry or client matrix source reference with retrieval/source dates, freshness band, and claim text.
- `reports/`: generated JSON compatibility reports.
- `comparisons/`: generated JSON default-vs-research comparison reports for bytecode and trace fixtures.

The static dataset browser lives under `site/public-seed/`. It is generated from the committed dataset files, does not fetch remote scripts or styles, and can be opened directly from `site/public-seed/index.html`.

```sh
pnpm site:generate
pnpm site:check
```

The index page includes summary counts, generated bar charts, report risk and fixture-kind filters, threshold-profile filtering, text search across fixture paths, report paths, finding IDs, and finding titles. Filter state is stored in the URL with `risk`, `kind`, `profile`, and `q` query parameters so filtered views can be shared.

The generated `reports/` pages render finding summaries, stable finding anchors, evidence, recommendations, assumptions, limitations, raw JSON report links, source fixture links, and fixture provenance links. The generated `comparisons/` pages render default-vs-research risk and finding deltas, changed finding groups, raw comparison JSON links, and links to the matching report detail pages.

The generated `findings/` pages group every report occurrence for a finding ID. They link back to the anchored report detail row, raw report JSON, source fixture, and comparison detail page when a comparison exists.

The generated `readiness.html` page shows EIP status groupings, client matrix rows, devnet participant images, spec versions, source links, retrieval/source dates, freshness bands, policy thresholds, source-review notes, and matrix warnings. It is a source visibility page, not a production compatibility assertion.

## Source Freshness

`readiness.json` exports a deterministic `sourceFreshnessPolicy`. Generated source age fields use `readiness.lastUpdated` as the `asOf` date, so `dataset:generate` and `site:generate` stay stable when run on a later calendar day.

The policy bands are:

| Band | Retrieved age | Meaning |
| --- | --- | --- |
| `fresh` | 0-30 days | No refresh prompt. |
| `watch` | 31-90 days | Recheck soon, especially before release work. |
| `stale` | More than 90 days | Refresh before relying on the row. |

Run a live audit when maintainers want to compare source `retrievedAt` values with the current date:

```sh
pnpm readiness:freshness
pnpm readiness:freshness --as-of 2026-08-15
```

The live audit fails on invalid dates, missing source metadata, future `retrievedAt`/`sourceDate` values, and `retrievedAt` dates before `sourceDate`. It warns, but does not fail, for `watch` or `stale` sources. A stale source means "refresh this citation"; it does not mean the associated EIP or client is incompatible.

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

`readiness-clients.csv` has one row per client matrix version entry.

| Column | Meaning |
| --- | --- |
| `role` | Client role: `execution`, `consensus`, or `validator`. |
| `name` | Client name from the matrix. |
| `version` | Exact version or image string. |
| `status` | Sourced matrix status: `compatible`, `partial`, `incompatible`, or `unknown`. |
| `sourceType` | Matrix source type. |
| `sourceUrl` | Public or local source URL. |
| `retrievedAt` | Date the source was retrieved. |
| `retrievedDaysAgo` | Source retrieval age in days relative to the dataset date. |
| `freshnessBand` | `fresh`, `watch`, or `stale` band for the source retrieval date. |
| `notes` | Matrix notes for the version, when present. |

`readiness-devnets.csv` has one row per devnet participant.

| Column | Meaning |
| --- | --- |
| `devnet` | Devnet or interop context name. |
| `devnetStatus` | Sourced devnet status string. |
| `role` | Participant role, when a participant is recorded. |
| `name` | Participant client or tool name. |
| `image` | Participant image/version when present. |
| `status` | Participant status from the matrix. |
| `sourceUrl` | Source URL for the devnet entry. |
| `retrievedAt` | Date the devnet source was retrieved. |
| `notes` | Participant or devnet notes. |

`readiness-eips.csv` has one row per EIP registry entry.

| Column | Meaning |
| --- | --- |
| `id` | EIP or local registry ID. |
| `name` | Registry entry name. |
| `status` | Registry status such as `scheduled`, `considered`, `declined`, or `proposed`. |
| `domain` | Pipe-delimited domains. |
| `detectors` | Pipe-delimited detector module names, when any detector uses the entry. |
| `notes` | Registry notes. |

`readiness-sources.csv` has one row per source reference.

| Column | Meaning |
| --- | --- |
| `area` | `eip-registry` or `client-matrix`. |
| `label` | Source location in the source JSON. |
| `type` | Source type. |
| `url` | Exact source URL. |
| `sourceDate` | Publication or release date when known. |
| `retrievedAt` | Retrieval date. |
| `retrievedDaysAgo` | Retrieval age in days relative to the dataset date. |
| `sourceAgeDays` | Publication/release age in days relative to the dataset date, when `sourceDate` is present. |
| `freshnessAsOf` | Date used to classify source freshness, equal to `readiness.lastUpdated` for generated artifacts. |
| `freshnessBand` | `fresh`, `watch`, or `stale` source freshness band. |
| `freshnessReview` | Human-readable refresh guidance for the band. |
| `claim` | Concise source claim summary. |
| `notes` | Source notes. |

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

Use `readiness.json` for nested source context, and use the `readiness-*.csv` files for flat imports. The readiness exports join back to the source files by URL, client name/version, devnet name, or EIP ID:

```text
readiness-eips.csv.id = data/eips/glamsterdam.json.eips[].id
readiness-clients.csv.name + readiness-clients.csv.version = data/client-compat/clients.example.json clients[].versions[]
readiness-sources.csv.url = source.url
```

## Stability

Run `pnpm dataset:check` before opening a PR that changes fixtures, scanners, thresholds, registry data, or the client compatibility matrix. The check regenerates the dataset into a temporary directory and compares it with `datasets/public-seed/`. If it reports stale, missing, or extra committed files, run `pnpm dataset:generate` and review the generated artifact changes.

Run `pnpm readiness:freshness` when reviewing source currency against today's date. This live audit is intentionally separate from `dataset:check`: committed artifact age fields remain pinned to the dataset date, while the live audit can warn that real-world source retrievals have aged into `watch` or `stale`.

Run `pnpm site:check` before opening a PR that changes committed dataset artifacts or the site generator. The check regenerates the static site into a temporary directory and compares it with `site/public-seed/`. If it reports stale, missing, or extra committed files, run `pnpm site:generate` and review the generated site changes.

These fields are intended to be stable enough for downstream scripts:

- CSV filenames and headers.
- `sourceFixture` paths for committed fixtures.
- `report` paths for committed fixtures and threshold profiles.
- `fixtureKind`, `thresholdProfile`, `findingId`, `domains`, and `relatedEips` values.

These fields can change when scanner behavior, thresholds, fixtures, or registry metadata changes:

- `risk`, `findingCount`, `findingIndex`, `title`, `severity`, and `confidence`.
- Aggregate counts in `summary.json` and `summary.csv`.
- Comparison report contents under `comparisons/`.
- Readiness source age fields and EIP/client statuses when upstream sources or the local registry/matrix are refreshed.

Use `manifest.json.toolVersion`, `summary.json.toolVersion`, `readiness.json.toolVersion`, and the release tag when comparing exports across releases.

## Import Notes

The CSV files use comma delimiters, RFC-style double-quote escaping, and a single header row. Multi-value fields use `|` as the internal separator.

Spreadsheet users can open the CSVs directly. Warehouse users should import `findingCount`, `findingIndex`, and `count` as integers and keep all path, ID, profile, severity, and confidence fields as strings.

## Example

See `examples/public-seed-analysis.md` for small Node-based analyses that count reports by risk, summarize coverage by fixture kind, and list the most common finding IDs.
