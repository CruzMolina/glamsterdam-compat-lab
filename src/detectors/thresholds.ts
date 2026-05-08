import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const moduleDir = dirname(fileURLToPath(import.meta.url));

export const detectorThresholdsSchema = z.object({
  schemaVersion: z.number().int().positive(),
  lastUpdated: z.string().min(1),
  notes: z.array(z.string()).default([]),
  bytecode: z.object({
    contractSize: z.object({
      currentRuntimeLimitBytes: z.number().int().positive(),
      nearCurrentLimitBytes: z.number().int().positive()
    }),
    stateAccountOpcodeExposure: z.object({
      mediumSensitiveOpcodeCount: z.number().int().positive(),
      lowSensitiveOpcodeCount: z.number().int().positive()
    }),
    storagePattern: z.object({
      mediumStorageOpcodeCount: z.number().int().positive()
    })
  }),
  trace: z.object({
    stateHeavyExecution: z.object({
      highStorageOps: z.number().int().positive(),
      highSensitiveOpcodeCount: z.number().int().positive(),
      mediumStorageOps: z.number().int().positive(),
      mediumSensitiveOpcodeCount: z.number().int().positive()
    }),
    calldataHeavy: z.object({
      mediumCalldataBytes: z.number().int().positive()
    })
  })
});

export type DetectorThresholds = z.infer<typeof detectorThresholdsSchema>;

export function defaultThresholdsPath(): string {
  return resolve(moduleDir, "../../data/detectors/thresholds.json");
}

export function loadDetectorThresholds(thresholdsPath = defaultThresholdsPath()): DetectorThresholds {
  if (!existsSync(thresholdsPath)) {
    throw new Error(`Detector thresholds not found: ${thresholdsPath}`);
  }

  return detectorThresholdsSchema.parse(JSON.parse(readFileSync(thresholdsPath, "utf8")));
}
