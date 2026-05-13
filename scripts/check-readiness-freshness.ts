#!/usr/bin/env tsx

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  auditSourceFreshness,
  clientMatrixSourceRefs,
  defaultClientMatrixPath,
  defaultRegistryPath,
  loadClientMatrix,
  loadEipRegistry,
  SOURCE_FRESHNESS_POLICY,
  type SourceFreshnessAuditResult,
  type SourceFreshnessRef
} from "../src/index.js";

export interface CheckReadinessFreshnessOptions {
  asOf?: string;
  eipRegistryPath?: string;
  clientMatrixPath?: string;
}

export interface CheckReadinessFreshnessResult extends SourceFreshnessAuditResult {
  sourceCount: number;
}

export function checkReadinessFreshness(
  options: CheckReadinessFreshnessOptions = {}
): CheckReadinessFreshnessResult {
  const asOf = options.asOf ?? localIsoDate(new Date());
  const eipRegistry = loadEipRegistry(options.eipRegistryPath ?? defaultRegistryPath());
  const clientMatrix = loadClientMatrix(options.clientMatrixPath ?? defaultClientMatrixPath());
  const refs: SourceFreshnessRef[] = [
    ...eipRegistry.sources.map((source, index) => ({
      label: `eip-registry.sources[${index}]`,
      source
    })),
    ...clientMatrixSourceRefs(clientMatrix).map((ref) => ({
      label: `client-matrix.${ref.label}`,
      source: ref.source
    }))
  ];
  const audit = auditSourceFreshness(refs, asOf);

  return {
    ...audit,
    sourceCount: refs.length
  };
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const result = checkReadinessFreshness(options);

  console.log("readiness source freshness check");
  console.log(`asOf: ${result.asOf}`);
  console.log(`policy: ${SOURCE_FRESHNESS_POLICY.name}`);
  console.log(
    `bands: fresh <= ${SOURCE_FRESHNESS_POLICY.freshMaxDays}d, watch <= ${SOURCE_FRESHNESS_POLICY.watchMaxDays}d, stale > ${SOURCE_FRESHNESS_POLICY.watchMaxDays}d`
  );
  console.log(`sources: ${result.sourceCount}`);
  console.log(
    `freshness: fresh ${result.countsByBand.fresh}, watch ${result.countsByBand.watch}, stale ${result.countsByBand.stale}`
  );

  if (result.warnings.length > 0) {
    console.log("");
    console.log("warnings:");
    for (const warning of result.warnings) {
      console.log(`- ${warning}`);
    }
  }

  if (result.errors.length > 0) {
    console.log("");
    console.log("errors:");
    for (const error of result.errors) {
      console.log(`- ${error}`);
    }
    process.exit(1);
  }

  console.log("");
  console.log("readiness sources passed the live freshness audit.");
}

function parseArgs(args: string[]): CheckReadinessFreshnessOptions {
  const options: CheckReadinessFreshnessOptions = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === "--as-of") {
      if (!next) {
        throw new Error("--as-of requires a YYYY-MM-DD value.");
      }
      options.asOf = next;
      index += 1;
    } else if (arg === "--eip-registry") {
      if (!next) {
        throw new Error("--eip-registry requires a path.");
      }
      options.eipRegistryPath = resolve(next);
      index += 1;
    } else if (arg === "--client-matrix") {
      if (!next) {
        throw new Error("--client-matrix requires a path.");
      }
      options.clientMatrixPath = resolve(next);
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log("Usage: pnpm readiness:freshness [--as-of YYYY-MM-DD] [--eip-registry path] [--client-matrix path]");
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function localIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
