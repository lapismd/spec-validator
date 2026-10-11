import type { SpecFirstRule } from "./types.js";
export interface DocumentRole {
  pattern: string;
  role: "contract" | "verification" | "progress" | "history" | "navigation";
}
export interface SummaryOptions {
  fragments?: boolean;
}
export interface FileLimitOptions {
  maxLines?: number;
  maxBytes?: number;
}
export interface SearchScope {
  collection: string;
  path: string;
}
export interface QmdOptions {
  collection?: string;
  configPath?: string;
  defaultScope?: string;
  scopes?: Record<string, SearchScope>;
}
export interface ChangeConfirmation {
  paths: string[];
  chapters: string[];
  evidence: string;
  reason: string;
}
export interface ConfirmationSelection {
  base?: string;
  head?: string;
  files?: string[];
}
export type ConfirmationProvider = (
  repoRoot: string,
  selection: ConfirmationSelection,
) => ChangeConfirmation[];
export interface SpecFirstOptions {
  mode?: "mapped" | "any";
  canonicalPattern?: string;
  ignore?: string[];
  rules?: SpecFirstRule[];
  protected?: string[];
  conditional?: Record<string, string>;
  confirmationProvider?: ConfirmationProvider;
}
