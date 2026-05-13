export { loadEipRegistry, defaultRegistryPath } from "./registry/eipRegistry.js";
export type { EipEntry, EipRegistry, EipRegistrySource, EipStatus, EipDomain } from "./registry/schemas.js";
export {
  defaultFixtureProvenancePath,
  fixtureProvenanceEntrySchema,
  fixtureProvenanceManifestSchema,
  loadFixtureProvenance,
  validateFixtureProvenance
} from "./fixtures/provenance.js";
export type {
  FixtureCompleteness,
  FixtureProvenanceEntry,
  FixtureProvenanceKind,
  FixtureProvenanceManifest,
  FixtureRedactionStatus,
  FixtureSourceType
} from "./fixtures/provenance.js";

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
export { scanValidatorConfig } from "./scanners/validatorScanner.js";
export {
  clientMatrixSourceRefs,
  checkClientMatrix,
  defaultClientMatrixPath,
  findClientMatrixEntry,
  loadClientMatrix
} from "./registry/clientMatrix.js";
export type {
  ClientEntry,
  ClientMatrix,
  ClientMatrixCheckResult,
  ClientMatrixSourceRef,
  ClientMatrixSource,
  ClientRole,
  ClientVersion
} from "./registry/clientMatrix.js";
export {
  SOURCE_FRESHNESS_POLICY,
  auditSourceFreshness,
  daysBetweenIsoDates,
  sourceFreshness,
  sourceFreshnessBand,
  sourceFreshnessReview
} from "./registry/sourceFreshness.js";
export type {
  SourceFreshness,
  SourceFreshnessAuditResult,
  SourceFreshnessBand,
  SourceFreshnessPolicy,
  SourceFreshnessPolicyBand,
  SourceFreshnessRef
} from "./registry/sourceFreshness.js";
export { loadDetectorThresholds, defaultThresholdsPath, detectorThresholdsSchema } from "./detectors/thresholds.js";
export type { DetectorThresholds } from "./detectors/thresholds.js";

export {
  compatibilityReportSchema,
  comparisonReportSchema,
  comparisonFindingReferenceSchema,
  changedFindingSchema,
  findingSchema,
  makeReport,
  summarizeFindings,
  validateCompatibilityReport,
  validateComparisonReport,
  combineReports
} from "./reports/reportTypes.js";
export type {
  ChangedFinding,
  ComparisonDirection,
  ComparisonField,
  ComparisonFindingReference,
  ComparisonReport,
  CompatibilityFinding,
  CompatibilityReport,
  Confidence,
  ReportDomain,
  Severity,
  TargetKind
} from "./reports/reportTypes.js";

export { compareCompatibilityReports } from "./reports/compareReports.js";
export { renderJsonComparisonReport, renderJsonReport } from "./reports/jsonReporter.js";
export { renderMarkdownComparisonReport, renderMarkdownReport } from "./reports/markdownReporter.js";

export {
  normalizeBytecode,
  disassembleBytecode,
  countOpcodeNames,
  byteLength,
  opcodeCount
} from "./utils/bytecode.js";
