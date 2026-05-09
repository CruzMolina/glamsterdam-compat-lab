import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadDetectorThresholds } from "../src/detectors/thresholds.js";
import { scanTrace } from "../src/scanners/traceScanner.js";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("detector threshold profiles", () => {
  it("loads default, research, and CI threshold profiles", () => {
    const defaultProfile = loadDetectorThresholds(resolve(rootDir, "data/detectors/thresholds.json"));
    const researchProfile = loadDetectorThresholds(resolve(rootDir, "data/detectors/thresholds.research.json"));
    const ciProfile = loadDetectorThresholds(resolve(rootDir, "data/detectors/thresholds.ci.json"));

    expect(defaultProfile.profile).toBe("default");
    expect(researchProfile.profile).toBe("research");
    expect(ciProfile.profile).toBe("ci");
    expect(researchProfile.trace.calldataHeavy.mediumCalldataBytes)
      .toBeLessThan(defaultProfile.trace.calldataHeavy.mediumCalldataBytes);
    expect(ciProfile.trace.calldataHeavy.mediumCalldataBytes)
      .toBeGreaterThan(defaultProfile.trace.calldataHeavy.mediumCalldataBytes);
  });

  it("lets profiles change scanner sensitivity without detector rewrites", () => {
    const defaultProfile = loadDetectorThresholds(resolve(rootDir, "data/detectors/thresholds.json"));
    const researchProfile = loadDetectorThresholds(resolve(rootDir, "data/detectors/thresholds.research.json"));
    const trace = {
      steps: [
        { op: "CALL", depth: 1, gasCost: 700, calldataBytes: 2048 }
      ]
    };

    const defaultReport = scanTrace(trace, { thresholds: defaultProfile });
    const researchReport = scanTrace(trace, { thresholds: researchProfile });

    expect(defaultReport.findings.some((finding) => finding.id === "trace.calldata-heavy-execution")).toBe(false);
    expect(researchReport.findings.some((finding) => finding.id === "trace.calldata-heavy-execution")).toBe(true);
  });
});
