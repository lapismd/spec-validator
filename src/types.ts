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
  nonBullet: string[];
  bullets: Array<{ statement: string; line: number; words: number; sentences: number }>;
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

export interface RuleIds {
  summary: string;
  governance: string;
  verification: string;
  book: string;
  bookIgnore: string;
  publicSurfaces: string;
  storybookCatalog: string;
  storybookMirrors: string;
  qmd: string;
  markdownlint: string;
  packageManifest: string;
  specFirst: string;
  internal: string;
}

export interface SpecFirstRule {
  pattern: string;
  chapters: string[];
}

export interface ValidatorOptions {
  summary?: boolean | Record<string, never>;
  governance?: boolean | { extras?: string[] };
  verification?:
    | boolean
    | {
        columns?: number;
        statuses?: string[];
        header?: string;
      };
  book?: boolean | { src?: string; buildDir?: string };
  publicSurfaces?: boolean | { map?: string };
  storybookCatalog?:
    | boolean
    | { roots?: string[]; packageName?: string };
  storybookMirrors?: boolean | { style?: MirrorStyle; directory?: string };
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
        changeMap?: string;
        ignore?: string[];
        rules?: SpecFirstRule[];
        protected?: string[];
      };
}

export interface UserConfig {
  preset?: string;
  idPattern?: string | RegExp;
  specDir?: string;
  requirementStyle?: RequirementStyle;
  headingTemplate?: string;
  maxWords?: number;
  maxSentences?: number;
  minAcceptance?: number;
  maxAcceptance?: number;
  ruleIds?: Partial<RuleIds>;
  validators?: ValidatorOptions;
  plugins?: string[];
  check?: { tests?: string | boolean };
}

export interface ResolvedConfig {
  preset: string;
  idPattern: RegExp;
  referencePattern: RegExp;
  specDir: string;
  requirementStyle: RequirementStyle;
  headingTemplate: string;
  maxWords: number;
  maxSentences: number;
  minAcceptance: number;
  maxAcceptance: number;
  ruleIds: RuleIds;
  validators: ResolvedValidators;
  plugins: string[];
  check: { tests?: string | boolean };
}

export interface ResolvedValidators {
  summary: false | Record<string, never>;
  governance: false | { extras: string[] };
  verification: false | { columns: number; statuses: string[]; header: string };
  book: false | { src: string; buildDir: string };
  publicSurfaces: false | { map: string };
  storybookCatalog: false | { roots: string[]; packageName?: string };
  storybookMirrors: false | { style: MirrorStyle; directory: string };
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
        changeMap: string;
        ignore: string[];
        rules: SpecFirstRule[];
        protected: string[];
      };
}

export interface OutputOptions {
  color: ColorMode;
  json: boolean;
}

export interface JsonReport {
  version: 1;
  ok: boolean;
  exitCode: number;
  findings?: Diagnostic[];
  checks?: DoctorCheck[];
  stats?: Record<string, number | string>;
  message?: string;
}

export interface DoctorCheck {
  name: string;
  status: "pass" | "warn" | "fail";
  message: string;
  fixable?: boolean;
}
