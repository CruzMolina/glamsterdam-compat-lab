import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, resolve } from "node:path";
import YAML from "yaml";

export function isReadableFile(value: string): boolean {
  try {
    return existsSync(value) && statSync(value).isFile();
  } catch {
    return false;
  }
}

export function readPathOrValue(pathOrValue: string): { text: string; name: string; isFile: boolean } {
  if (!isReadableFile(pathOrValue)) {
    return {
      text: pathOrValue,
      name: "inline-bytecode",
      isFile: false
    };
  }

  return {
    text: readFileSync(pathOrValue, "utf8"),
    name: pathOrValue,
    isFile: true
  };
}

export function readTextFile(filePath: string): string {
  return readFileSync(filePath, "utf8");
}

export function loadStructuredFile(filePath: string): unknown {
  const text = readTextFile(filePath);
  return parseStructuredText(text, filePath);
}

export function parseStructuredText(text: string, sourceName = "input"): unknown {
  const ext = extname(sourceName).toLowerCase();

  if (ext === ".yaml" || ext === ".yml") {
    return YAML.parse(text) ?? {};
  }

  if (ext === ".json") {
    return JSON.parse(text);
  }

  try {
    return JSON.parse(text);
  } catch {
    return YAML.parse(text) ?? {};
  }
}

export function resolveFromCwd(pathLike: string): string {
  return resolve(process.cwd(), pathLike);
}
