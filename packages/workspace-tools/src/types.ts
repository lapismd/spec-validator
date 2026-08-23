export const WORKSPACE_SCHEMA_VERSION = 1 as const;

export interface RepositoryDeclaration {
  name: string;
  packages: string[];
  workspaceRoot: string;
}

export interface LinkDeclaration {
  name: string;
  path: string;
  range: string;
  requiredExports: string[];
  requiredFiles: string[];
}

export interface WorkspaceDeclaration {
  schemaVersion: typeof WORKSPACE_SCHEMA_VERSION;
  repository: RepositoryDeclaration;
  links: LinkDeclaration[];
}

export interface PackageManifest {
  name?: string;
  version?: string;
  exports?: unknown;
  main?: string;
  module?: string;
  bin?: string | Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  [key: string]: unknown;
}

export interface ValidatedLink {
  declaration: LinkDeclaration;
  targetPath: string;
  manifest: PackageManifest;
  bins: Record<string, string>;
}

export interface WorkspaceGraphNode {
  name: string;
  root: string;
  packages: string[];
  dependencies: string[];
}

export interface WorkspaceGraph {
  current: string;
  nodes: Map<string, WorkspaceGraphNode>;
}
