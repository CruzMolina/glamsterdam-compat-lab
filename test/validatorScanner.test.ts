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

  it("accepts complete validator metadata without checklist findings", () => {
    const fixture = resolve(rootDir, "fixtures/validator/operator-config-complete.yaml");
    const report = scanValidatorConfig(fixture);
    const findingIds = report.findings.map((finding) => finding.id);

    expect(findingIds).not.toContain("validator.builder-enabled-without-endpoint");
    expect(findingIds).not.toContain("validator.missing-monitoring-endpoints");
    expect(findingIds).not.toContain("validator.missing-testnet-participation");
    expect(findingIds.every((id) => !id.includes("missing-"))).toBe(true);
  });

  it("reports builder, monitoring, and participation gaps in an incomplete config", () => {
    const fixture = resolve(rootDir, "fixtures/validator/operator-config-missing-builder-monitoring.yaml");
    const report = scanValidatorConfig(fixture);
    const findingIds = report.findings.map((finding) => finding.id);

    expect(findingIds).toContain("validator.builder-enabled-without-endpoint");
    expect(findingIds).toContain("validator.missing-monitoring-endpoints");
    expect(findingIds).toContain("validator.missing-testnet-participation");
    expect(findingIds).not.toContain("validator.unknown-execution-client-compatibility");
    expect(findingIds).not.toContain("validator.unknown-consensus-client-compatibility");
    expect(findingIds).not.toContain("validator.unknown-validator-client-compatibility");
  });
});
