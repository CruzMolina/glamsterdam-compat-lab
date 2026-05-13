# Public Seed Dataset

This directory contains the first deterministic dataset seed for Glamsterdam Compatibility Lab. It is generated from safe-to-publish fixtures documented in `fixtures/provenance.json`.

The seed is intentionally small. It is meant to prove the dataset workflow, not to measure aggregate public-chain readiness.

## Contents

- `manifest.json`: index of generated reports, comparisons, source fixtures, threshold profiles, and limitations.
- `summary.json`: aggregate counts by fixture kind, source type, report risk, threshold profile, and finding ID.
- `reports.csv`: flat index of generated reports for spreadsheet and warehouse import.
- `findings.csv`: one row per generated report finding, including severity, confidence, domains, and related EIPs.
- `summary.csv`: flattened aggregate totals and counts from `summary.json`.
- `reports/`: JSON compatibility reports generated from source fixtures.
- `comparisons/`: JSON comparison reports for default-vs-research threshold profiles on bytecode and trace fixtures.

## Regenerate

```sh
pnpm dataset:generate
```

Check committed artifacts are fresh with:

```sh
pnpm dataset:check
```

Then run:

```sh
pnpm test
pnpm build
```

Review generated changes before publishing. Dataset comparisons are structural report differences only; they do not infer final Glamsterdam gas deltas or client behavior.
