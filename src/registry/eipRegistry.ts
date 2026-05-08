import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { eipRegistrySchema, type EipEntry, type EipRegistry } from "./schemas.js";

const moduleDir = dirname(fileURLToPath(import.meta.url));

export function defaultRegistryPath(): string {
  return resolve(moduleDir, "../../data/eips/glamsterdam.json");
}

export function loadEipRegistry(registryPath = defaultRegistryPath()): EipRegistry {
  if (!existsSync(registryPath)) {
    throw new Error(`EIP registry not found: ${registryPath}`);
  }

  const raw = readFileSync(registryPath, "utf8");
  const parsed = JSON.parse(raw);
  return eipRegistrySchema.parse(parsed);
}

export function eipsForDetector(registry: EipRegistry, detectorName: string): EipEntry[] {
  return registry.eips.filter((entry) => entry.detectors.includes(detectorName));
}

export function findEip(registry: EipRegistry, id: string): EipEntry | undefined {
  return registry.eips.find((entry) => entry.id === id);
}

export function activeOrConsideredEipIds(registry: EipRegistry, ids: string[]): string[] {
  const usableStatuses = new Set(["scheduled", "considered"]);
  return ids.filter((id) => {
    const entry = findEip(registry, id);
    return entry ? usableStatuses.has(entry.status) : false;
  });
}
