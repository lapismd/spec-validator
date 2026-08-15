export interface Diagnostic {
  code: string;
  rule: string;
  file: string;
  line: number;
  subject?: string;
  message: string;
}

export interface SpecFile {
  absolutePath: string;
  relativePath: string;
  chapterPath: string;
  source: string;
}

export interface RequirementDefinition {
  id: string;
  surface?: string;
  statement: string;
  file: string;
  chapterPath: string;
  line: number;
  words: number;
  sentences: number;
  validId?: boolean;
}

export interface AcceptanceSection {
  id: string;
  file: string;
  line: number;
  present: boolean;
  introduction: boolean;
  nonBullet: string[];
  bullets: Array<{
    statement: string;
    line: number;
    words: number;
    sentences: number;
  }>;
}

export interface CoverageRow {
  surface: string;
  boundary: string;
  id: string;
  file: string;
  line: number;
}

export interface ParsedRequirementFile {
  file: SpecFile;
  definitions: RequirementDefinition[];
  malformed: Array<{ line: number; reason: string }>;
  acceptanceSections: AcceptanceSection[];
  coverage: CoverageRow[];
}

export interface SpecModel {
  repoRoot: string;
  sourceDirectory: string;
  files: SpecFile[];
  canonicalFiles: SpecFile[];
  parsed: ParsedRequirementFile[];
  definitions: RequirementDefinition[];
  acceptanceSections: AcceptanceSection[];
  coverage: CoverageRow[];
  definitionsById: Map<string, RequirementDefinition[]>;
  coverageById: Map<string, CoverageRow[]>;
}

export interface ValidationContext {
  model: SpecModel;
  trackedFiles: string[];
  config: ResolvedConfig;
  readOptional(filePath: string): string | null;
}

export interface Validator {
  name: string;
  validate(context: ValidationContext): Diagnostic[];
}

export type RequirementStyle = "heading" | "table";
export type MirrorStyle = "src-spec-mdx" | "stories-spec";
export type ColorMode = "auto" | "always" | "never";

/** Validator-level defaults. Exact `diagnostics` entries override these values. */
export interface RuleIds {
  summary: string;
  governance: string;
  verification: string;
  book: string;
  bookIgnore: string;
  publicSurfaces: string;
  storybookCatalog: string;
  storybookMirrors: string;
  repositoryLayout: string;
  packageDocs: string;
  qmd: string;
  markdownlint: string;
  packageManifest: string;
  specFirst: string;
  internal: string;
}

export type DiagnosticRuleMap = Record<string, string>;

export interface SpecFirstRule {
  pattern: string;
  chapters?: string[];
  captureMap?: Record<string, string[]>;
  captureGroup?: number;
  defaultChapters?: string[];
  changedLines?: string;
}

export interface CheckLaneConfig {
  name: string;
  command: string;
  args?: string[];
}

export interface VerificationOptions {
  mode?: "table" | "references";
  file?: string;
  section?: string;
  headers?: {
    ids: string[];
    status?: string[];
    evidence?: string[];
    required?: string[][];
  };
  idMode?: "single" | "grouped";
  statuses?: string[];
  statusMatch?: "exact" | "prefix";
  rejectOrphans?: boolean;
  requireEvidence?: boolean;
}

export interface ValidatorOptions {
  summary?: boolean | Record<string, never>;
  governance?:
    | boolean
    | {
        extras?: string[];
        normative?: boolean;
        proseLimits?: boolean;
        acceptance?: boolean;
        acceptanceScope?: "all" | "declared";
        acceptanceIntroduction?: "forbid" | "require" | "allow";
        acceptanceAtomic?: boolean;
        acceptanceColocation?: boolean;
        references?: boolean;
        changeMap?: boolean;
      };
  verification?: boolean | VerificationOptions;
  book?: boolean | { src?: string; buildDir?: string };
  publicSurfaces?:
    boolean | { map?: string; roots?: string[]; requireCoverage?: boolean };
  storybookCatalog?:
    | boolean
    | {
        roots?: string[];
        packageRoots?: string[];
        packageName?: string;
        storyOnlyName?: string;
        forbiddenSource?: string;
        plainTextLanguages?: string[];
      };
  storybookMirrors?:
    | boolean
    | {
        style?: MirrorStyle;
        directory?: string;
        titlePrefix?: string;
        verifyTarget?: boolean;
        verifyTitle?: boolean;
        verifyContent?: boolean;
        previewPath?: string;
        verifyOrder?: boolean;
        registryPath?: string;
        registryEntryTemplate?: string;
      };
  repositoryLayout?:
    | boolean
    | {
        requiredFiles?: string[];
        forbiddenEntries?: string[];
        forbiddenPaths?: string[];
        allowedRootMarkdown?: string[];
      };
  packageDocs?:
    | boolean
    | {
        root?: string;
        packagePattern?: string;
        chapterTemplate?: string;
        identityTemplate?: string;
      };
  qmd?: boolean | { collection?: string; configPath?: string };
  markdownlint?: boolean | { config?: string };
  packageManifest?:
    | boolean
    | {
        name?: string;
        version?: string;
        privateAllowed?: boolean;
        portableDependencies?: boolean;
        manifest?: Record<string, unknown>;
        manifestPath?: string;
      };
  specFirst?:
    | boolean
    | {
        mode?: "mapped" | "any";
        canonicalPattern?: string;
        ignore?: string[];
        rules?: SpecFirstRule[];
        protected?: string[];
        conditional?: Record<string, string>;
      };
}

export interface UserConfig {
  name?: string;
  idPattern?: string | RegExp;
  specDir?: string;
  requirementStyle?: RequirementStyle;
  tableSection?: string;
  headingTemplate?: string;
  maxWords?: number;
  maxSentences?: number;
  minAcceptance?: number;
  maxAcceptance?: number | null;
  ruleIds?: Partial<RuleIds>;
  diagnostics?: DiagnosticRuleMap;
  validators?: ValidatorOptions;
  plugins?: string[];
  check?: {
    lanes?: CheckLaneConfig[];
    build?: boolean;
    first?: boolean;
  };
}

export interface ResolvedConfig {
  name: string;
  idPattern: RegExp;
  referencePattern: RegExp;
  specDir: string;
  requirementStyle: RequirementStyle;
  tableSection: string | null;
  headingTemplate: string;
  maxWords: number;
  maxSentences: number;
  minAcceptance: number;
  maxAcceptance: number | null;
  ruleIds: RuleIds;
  diagnostics: DiagnosticRuleMap;
  validators: ResolvedValidators;
  plugins: string[];
  check: {
    lanes: CheckLaneConfig[];
    build: boolean;
    first: boolean;
  };
}

export interface ResolvedValidators {
  summary: false | Record<string, never>;
  governance:
    | false
    | {
        extras: string[];
        normative: boolean;
        proseLimits: boolean;
        acceptance: boolean;
        acceptanceScope: "all" | "declared";
        acceptanceIntroduction: "forbid" | "require" | "allow";
        acceptanceAtomic: boolean;
        acceptanceColocation: boolean;
        references: boolean;
        changeMap: boolean;
      };
  verification:
    | false
    | (Required<Omit<VerificationOptions, "section">> & { section?: string });
  book: false | { src: string; buildDir: string };
  publicSurfaces:
    false | { map: string; roots: string[]; requireCoverage: boolean };
  storybookCatalog:
    | false
    | {
        roots: string[];
        packageRoots: string[];
        packageName?: string;
        storyOnlyName: string;
        forbiddenSource: string;
        plainTextLanguages: string[];
      };
  storybookMirrors:
    | false
    | {
        style: MirrorStyle;
        directory: string;
        titlePrefix: string;
        verifyTarget: boolean;
        verifyTitle: boolean;
        verifyContent: boolean;
        previewPath: string;
        verifyOrder: boolean;
        registryPath?: string;
        registryEntryTemplate: string;
      };
  repositoryLayout:
    | false
    | {
        requiredFiles: string[];
        forbiddenEntries: string[];
        forbiddenPaths: string[];
        allowedRootMarkdown: string[];
      };
  packageDocs:
    | false
    | {
        root: string;
        packagePattern: string;
        chapterTemplate: string;
        identityTemplate: string;
      };
  qmd: false | { collection: string; configPath: string };
  markdownlint: false | { config: string };
  packageManifest:
    | false
    | {
        name?: string;
        version?: string;
        privateAllowed: boolean;
        portableDependencies: boolean;
        manifest?: Record<string, unknown>;
        manifestPath: string;
      };
  specFirst:
    | false
    | {
        mode: "mapped" | "any";
        canonicalPattern: string;
        ignore: string[];
        rules: SpecFirstRule[];
        protected: string[];
        conditional: Record<string, string>;
      };
}

export interface OutputOptions {
  color: ColorMode;
  json: boolean;
}

export interface CheckLaneResult {
  name: string;
  ok: boolean;
  exitCode: number;
  findings?: Diagnostic[];
  stdout?: string;
  stderr?: string;
  stats?: Record<string, number | string>;
}

export interface JsonReport {
  version: 1;
  ok: boolean;
  exitCode: number;
  findings?: Diagnostic[];
  checks?: DoctorCheck[];
  lanes?: CheckLaneResult[];
  validators?: Array<{ name: string; enabled: boolean; options: unknown }>;
  results?: unknown;
  stats?: Record<string, number | string>;
  message?: string;
}

export interface DoctorCheck {
  name: string;
  status: "pass" | "warn" | "fail";
  message: string;
  fixable?: boolean;
}
