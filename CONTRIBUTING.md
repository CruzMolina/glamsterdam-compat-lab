# Contributing

Thanks for helping improve Glamsterdam Compatibility Lab.

This project is intentionally data-driven. When adding a detector, keep protocol assumptions in `data/eips/glamsterdam.json` or another data file where possible, and keep detector code focused on evidence found in the input.

## Local workflow

```sh
pnpm install
pnpm test
pnpm build
```

When report wording or JSON structure changes intentionally, update golden snapshots:

```sh
pnpm test:update
```

## Detector guidelines

- Use conservative language. Prefer "review" or "replay representative transactions" over claims that something will break.
- Include actionable recommendations in every finding.
- Add fixtures and tests for each new detector.
- Do not guess client compatibility. Add explicit, sourced client metadata to a user-editable compatibility matrix instead.
- Keep JSON and Markdown report outputs deterministic.
- Keep detector thresholds in `data/detectors/thresholds.json` unless there is a strong reason to hardcode a parser invariant.

## Registry updates

The Glamsterdam fork scope may change. Update `data/eips/glamsterdam.json` with source links, status, detector modules, and a `lastUpdated` date whenever assumptions change.

Detector thresholds live in `data/detectors/thresholds.json`. Treat them as signal-quality heuristics, not protocol gas constants.

Additional threshold profiles live next to the default thresholds. Use `thresholds.research.json` for broad signal collection and `thresholds.ci.json` for lower-noise automation.

## Fixture contributions

See `docs/fixtures.md` before submitting real-world bytecode, traces, indexer configs, validator configs, or compatibility metadata. Fixtures must be safe to publish, clearly licensed, and stripped of secrets or validator-sensitive details.

## Pull requests

Please include:

- A short description of the compatibility risk being detected.
- The data source or rationale for any EIP/client metadata changes.
- New or updated fixtures.
- Tests showing the expected report output.
