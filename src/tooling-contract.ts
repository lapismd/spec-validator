/**
 * Canonical `spec:*` package-script aliases written by `init` and verified by
 * `doctor` in consumer repositories. The published CLI contract stays
 * `spec-validator <command>`; the aliases route repository scripts to the
 * installed binary without an intermediate runtime.
 */
export const PACKAGE_SCRIPT_ALIASES: Record<string, string> = {
  "spec:validate": "spec-validator validate",
  "spec:check": "spec-validator check",
  "spec:first": "spec-validator first",
  "spec:build": "spec-validator build",
  "spec:serve": "spec-validator serve",
  "spec:search": "spec-validator search",
  "spec:index": "spec-validator index",
};
