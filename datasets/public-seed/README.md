# Public Seed Dataset

This directory contains the first deterministic dataset seed for Glamsterdam Compatibility Lab. It is generated from safe-to-publish fixtures documented in `fixtures/provenance.json`.

The seed is intentionally small. It is meant to prove the dataset workflow, not to measure aggregate public-chain readiness.

## Contents

- `manifest.json`: index of generated reports, comparisons, source fixtures, threshold profiles, and limitations.
- `reports/`: JSON compatibility reports generated from source fixtures.
- `comparisons/`: JSON comparison reports for default-vs-research threshold profiles on bytecode and trace fixtures.

## Regenerate

```sh
pnpm dataset:generate
```

Then run:

```sh
pnpm test
pnpm build
```

Review generated changes before publishing. Dataset comparisons are structural report differences only; they do not infer final Glamsterdam gas deltas or client behavior.
