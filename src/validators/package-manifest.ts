import { diagnostic } from "../diagnostics.js";
import { existsSync, path, readFileSync } from "../platform/current.js";
import type { ValidationContext } from "../types.js";

export const name = "packageManifest";

export function validate(context: ValidationContext) {
  const options = context.config.validators.packageManifest;
  if (options === false) return [];
  const rule = context.config.ruleIds.packageManifest;
  const findings = [];
  const packagePath = path.join(context.model.repoRoot, "package.json");
  const packageJson = JSON.parse(readFileSync(packagePath, "utf8")) as {
    name?: string;
    version?: string;
    private?: boolean;
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  if (options.name && packageJson.name !== options.name) {
    findings.push(
      diagnostic({
        code: "SPEC-PKG-NAME",
        rule,
        file: "package.json",
        message: `package name must be ${options.name}`,
      }),
    );
  }
  if (options.version && packageJson.version !== options.version) {
    findings.push(
      diagnostic({
        code: "SPEC-PKG-VERSION",
        rule,
        file: "package.json",
        message: `package version must be ${options.version}`,
      }),
    );
  }
  if (!options.privateAllowed && packageJson.private === true) {
    findings.push(
      diagnostic({
        code: "SPEC-PKG-PRIVATE",
        rule,
        file: "package.json",
        message: "package must be publishable",
      }),
    );
  }
  if (options.portableDependencies) {
    const dependencyText = JSON.stringify({
      dependencies: packageJson.dependencies,
      peerDependencies: packageJson.peerDependencies,
      devDependencies: packageJson.devDependencies,
    });
    if (/(workspace:|link:|file:|\/Users\/)/.test(dependencyText)) {
      findings.push(
        diagnostic({
          code: "SPEC-PKG-PORTABLE",
          rule,
          file: "package.json",
          message: "dependency manifest is not portable",
        }),
      );
    }
  }
  if (options.manifest) {
    const manifestPath = path.join(
      context.model.repoRoot,
      options.manifestPath,
    );
    if (!existsSync(manifestPath)) {
      findings.push(
        diagnostic({
          code: "SPEC-PKG-MANIFEST-MISSING",
          rule,
          file: options.manifestPath,
          message: "plugin manifest is missing",
        }),
      );
      return findings;
    }
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<
      string,
      unknown
    >;
    for (const [key, value] of Object.entries(options.manifest)) {
      if (manifest[key] !== value) {
        findings.push(
          diagnostic({
            code: "SPEC-PKG-MANIFEST",
            rule,
            file: options.manifestPath,
            subject: key,
            message: `manifest ${key} must equal ${JSON.stringify(value)}`,
          }),
        );
      }
    }
  }
  return findings;
}
