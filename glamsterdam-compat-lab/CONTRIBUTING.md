# Contributing

Thanks for helping improve Glamsterdam Compatibility Lab.

This project is intentionally data-driven. When adding a detector, keep protocol assumptions in `data/eips/glamsterdam.json` or another data file where possible, and keep detector code focused on evidence found in the input.

## Local workflow

```sh
pnpm install
pnpm test
pnpm build
```

## Detector guidelines

- Use conservative language. Prefer "review" or "replay representative transactions" over claims that something will break.
- Include actionable recommendations in every finding.
- Add fixtures and tests for each new detector.
- Do not guess client compatibility. Add explicit, sourced client metadata to a user-editable compatibility matrix instead.
- Keep JSON and Markdown report outputs deterministic.

## Registry updates

The Glamsterdam fork scope may change. Update `data/eips/glamsterdam.json` with source links, status, detector modules, and a `lastUpdated` date whenever assumptions change.

## Pull requests

Please include:

- A short description of the compatibility risk being detected.
- The data source or rationale for any EIP/client metadata changes.
- New or updated fixtures.
- Tests showing the expected report output.
