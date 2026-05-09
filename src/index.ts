export { loadEipRegistry, defaultRegistryPath } from "./registry/eipRegistry.js";
export type { EipEntry, EipRegistry, EipStatus, EipDomain } from "./registry/schemas.js";

export { scanBytecode } from "./scanners/bytecodeScanner.js";
export { scanTrace, scanTraceFile, normalizeTrace } from "./scanners/traceScanner.js";
export {
  fetchAndScanTransactionTrace,
  fetchDebugTraceTransaction,
  normalizeTxHash,
  parseDebugTraceMode,
  scanFetchedTransactionTrace,
  scanTransactionTrace
} from "./scanners/rpcTraceScanner.js";
export { writeFetchedTrace } from "./scanners/rpcTraceScanner.js";
export type {
  DebugTraceMode,
  FetchDebugTraceOptions,
  RpcFetch,
  ScannedTransactionTrace,
  ScanTransactionTraceOptions
} from "./scanners/rpcTraceScanner.js";
export { scanIndexer, summarizeHandlers } from "./scanners/indexerScanner.js";
export { scanValidatorConfig, defaultClientMatrixPath } from "./scanners/validatorScanner.js";
export { loadDetectorThresholds, defaultThresholdsPath, detectorThresholdsSchema } from "./detectors/thresholds.js";
export type { DetectorThresholds } from "./detectors/thresholds.js";

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
