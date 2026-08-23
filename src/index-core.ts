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
export { runCli } from "./cli-core.js";
export type {
  CheckLaneConfig,
  Diagnostic,
  ResolvedConfig,
  UserConfig,
  VerificationOptions,
} from "./types.js";
