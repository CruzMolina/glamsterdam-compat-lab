import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { scanValidatorConfig } from "../src/scanners/validatorScanner.js";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("scanValidatorConfig", () => {
  it("reports unknown compatibility without guessing", () => {
    const fixture = resolve(rootDir, "fixtures/validator/operator-config.yaml");
    const report = scanValidatorConfig(fixture);

    expect(report.target.kind).toBe("validator");
    expect(report.findings.some((finding) => finding.id === "validator.unknown-execution-client-compatibility")).toBe(true);
    expect(report.findings.some((finding) => finding.id === "validator.unknown-consensus-client-compatibility")).toBe(true);
    expect(report.findings.some((finding) => finding.id === "validator.builder-enabled-without-endpoint")).toBe(true);
    expect(report.findings.every((finding) => !finding.description.includes("probably compatible"))).toBe(true);
  });

  it("accepts a complete placeholder operator config without findings", () => {
    const fixture = resolve(rootDir, "fixtures/validator/operator-config-complete.yaml");
    const report = scanValidatorConfig(fixture);

    expect(report.target.kind).toBe("validator");
    expect(report.findings).toEqual([]);
    expect(report.summary.risk).toBe("low");
  });

  it("isolates builder, monitoring, and testnet gaps when client metadata is known", () => {
    const fixture = resolve(rootDir, "fixtures/validator/operator-config-builder-gap.yaml");
    const report = scanValidatorConfig(fixture);
    const findingIds = report.findings.map((finding) => finding.id);

    expect(findingIds).toEqual([
      "validator.builder-enabled-without-endpoint",
      "validator.missing-monitoring-endpoints",
      "validator.missing-testnet-participation"
    ]);
    expect(findingIds.some((id) => id.includes("unknown") || id.includes("missing-execution-client"))).toBe(false);
  });
});
