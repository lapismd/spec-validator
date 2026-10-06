export {
  defineConfig,
  loadResolvedConfig,
  mergeValidatorOptions,
  resolveConfig,
} from "./config.js";
export { diagnostic, formatDiagnostic } from "./diagnostics.js";
export { createSpecModel } from "./model.js";
export {
  groupedIdVerification,
  headingRequirements,
  profiles,
  singleIdVerification,
  tableRequirements,
} from "./profiles.js";
export { expandSummary } from "./navigation.js";
export { documentRole } from "./document-roles.js";
export type {
  ChangeConfirmation,
  ConfirmationProvider,
  DocumentRole,
  FileLimitOptions,
  SearchScope,
} from "./layout-types.js";
export {
  classifySpecFirstChanges,
  changesFromVcs,
} from "./validators/spec-first.js";
export { runCli } from "./cli-core.js";
export type {
  CheckLaneConfig,
  Diagnostic,
  ResolvedConfig,
  UserConfig,
  VerificationOptions,
} from "./types.js";
