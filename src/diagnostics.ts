import type { Diagnostic } from "./types.js";

export function diagnostic({
  code,
  rule,
  file,
  line = 1,
  subject,
  message,
}: {
  code: string;
  rule: string;
  file: string;
  line?: number;
  subject?: string;
  message: string;
}): Diagnostic {
  return { code, rule, file, line, subject, message };
}

export function compareDiagnostics(left: Diagnostic, right: Diagnostic): number {
  return (
    left.file.localeCompare(right.file) ||
    left.line - right.line ||
    left.code.localeCompare(right.code) ||
    (left.subject ?? "").localeCompare(right.subject ?? "")
  );
}

export function formatDiagnostic(entry: Diagnostic): string {
  const subject = entry.subject ? ` [${entry.subject}]` : "";
  return `${entry.code} ${entry.rule} ${entry.file}:${entry.line}${subject} — ${entry.message}`;
}
