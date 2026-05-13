import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  actionMinimumProblem,
  checkWorkflowShape,
  parseActionReference
} from "../scripts/check-npm-release.mjs";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publishWorkflow = readFileSync(resolve(rootDir, ".github/workflows/npm-publish.yml"), "utf8");

describe("npm release workflow readiness checks", () => {
  it("parses v-prefixed action references", () => {
    expect(parseActionReference("actions/download-artifact@v8")).toEqual({
      action: "actions/download-artifact",
      ref: "v8",
      major: 8
    });
    expect(parseActionReference("actions/upload-artifact@v7.1.2")).toEqual({
      action: "actions/upload-artifact",
      ref: "v7.1.2",
      major: 7
    });
    expect(parseActionReference("actions/download-artifact@main")).toEqual({
      action: "actions/download-artifact",
      ref: "main",
      major: null
    });
  });

  it("requires artifact actions to stay on Node 24-ready majors", () => {
    expect(actionMinimumProblem("actions/upload-artifact@v7", "actions/upload-artifact", 7)).toBe("");
    expect(actionMinimumProblem("actions/download-artifact@v8", "actions/download-artifact", 8)).toBe("");
    expect(actionMinimumProblem("actions/upload-artifact@v6", "actions/upload-artifact", 7))
      .toContain("older than actions/upload-artifact@v7");
    expect(actionMinimumProblem("actions/download-artifact@main", "actions/download-artifact", 8))
      .toContain("not pinned to a v-prefixed major version");
  });

  it("accepts the live publish workflow shape", () => {
    expect(checkWorkflowShape(publishWorkflow)).toEqual({ ok: true, detail: "" });
  });

  it("rejects older artifact actions in the publish workflow", () => {
    const result = checkWorkflowShape(
      publishWorkflow
        .replace("actions/upload-artifact@v7", "actions/upload-artifact@v6")
        .replace("actions/download-artifact@v8", "actions/download-artifact@v7")
    );

    expect(result.ok).toBe(false);
    expect(result.detail).toContain("actions/upload-artifact@v6 is older than actions/upload-artifact@v7");
    expect(result.detail).toContain("actions/download-artifact@v7 is older than actions/download-artifact@v8");
  });

  it("rejects release jobs that leave Node.js 24", () => {
    const result = checkWorkflowShape(publishWorkflow.replaceAll("node-version: 24", "node-version: 20"));

    expect(result.ok).toBe(false);
    expect(result.detail).toContain("preflight job does not use Node.js 24");
    expect(result.detail).toContain("publish job does not use Node.js 24");
  });
});
