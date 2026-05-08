export { loadEipRegistry, defaultRegistryPath } from "./registry/eipRegistry.js";
export type { EipEntry, EipRegistry, EipStatus, EipDomain } from "./registry/schemas.js";

export { scanBytecode } from "./scanners/bytecodeScanner.js";
export { scanTrace, scanTraceFile, normalizeTrace } from "./scanners/traceScanner.js";
export { scanIndexer, summarizeHandlers } from "./scanners/indexerScanner.js";
export { scanValidatorConfig, defaultClientMatrixPath } from "./scanners/validatorScanner.js";

export {
  compatibilityReportSchema,
  findingSchema,
  makeReport,
  summarizeFindings,
  validateCompatibilityReport,
  combineReports
} from "./reports/reportTypes.js";
export type {
  CompatibilityFinding,
  CompatibilityReport,
  Confidence,
  ReportDomain,
  Severity,
  TargetKind
} from "./reports/reportTypes.js";

export { renderJsonReport } from "./reports/jsonReporter.js";
export { renderMarkdownReport } from "./reports/markdownReporter.js";

export {
  normalizeBytecode,
  disassembleBytecode,
  countOpcodeNames,
  byteLength,
  opcodeCount
} from "./utils/bytecode.js";
