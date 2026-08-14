import { formatDiagnostic } from "./diagnostics.js";
import { createPalette, resolveColorEnabled } from "./color.js";
import type {
  Diagnostic,
  DoctorCheck,
  JsonReport,
  OutputOptions,
} from "./types.js";

export interface Reporter {
  json: boolean;
  writeReport(report: JsonReport): void;
  writeLine(line: string): void;
  writeError(line: string): void;
}

export function createReporter(
  output: OutputOptions,
  stdout: NodeJS.WritableStream = process.stdout,
  stderr: NodeJS.WritableStream = process.stderr,
): Reporter {
  const color = resolveColorEnabled(
    output.color,
    stdout as NodeJS.WriteStream,
  );
  const paint = createPalette(output.json ? false : color);

  return {
    json: output.json,
    writeLine(line: string) {
      stdout.write(`${line}\n`);
    },
    writeError(line: string) {
      stderr.write(`${line}\n`);
    },
    writeReport(report: JsonReport) {
      if (output.json) {
        stdout.write(`${JSON.stringify(report, null, 2)}\n`);
        return;
      }
      if (report.findings) {
        if (!report.ok) {
          stderr.write(`${paint.red(paint.bold("Specification validation failed:"))}\n`);
          for (const finding of report.findings) {
            stderr.write(`${paint.red(formatPrettyDiagnostic(finding, paint))}\n`);
          }
          return;
        }
        stdout.write(
          `${paint.green("Specification validated:")} ${report.stats?.validators} validators, ${report.stats?.chapters} chapters, ${report.stats?.requirements} requirements.\n`,
        );
        return;
      }
      if (report.checks) {
        writeDoctorPretty(report.checks, report, paint, stdout);
        return;
      }
      if (report.message) stdout.write(`${report.message}\n`);
    },
  };
}

function formatPrettyDiagnostic(
  finding: Diagnostic,
  paint: ReturnType<typeof createPalette>,
): string {
  const subject = finding.subject ? paint.cyan(` [${finding.subject}]`) : "";
  return `${paint.bold(finding.code)} ${paint.yellow(finding.rule)} ${paint.dim(`${finding.file}:${finding.line}`)}${subject} — ${finding.message}`;
}

function writeDoctorPretty(
  checks: DoctorCheck[],
  report: JsonReport,
  paint: ReturnType<typeof createPalette>,
  stdout: NodeJS.WritableStream,
): void {
  const mark = {
    pass: paint.green("pass"),
    warn: paint.yellow("warn"),
    fail: paint.red("fail"),
  };
  stdout.write(`${paint.bold("Spec validator doctor")}\n`);
  for (const check of checks) {
    stdout.write(`  ${mark[check.status]}  ${paint.bold(check.name)}  ${check.message}\n`);
  }
  const failed = checks.filter((check) => check.status === "fail").length;
  const warned = checks.filter((check) => check.status === "warn").length;
  const passed = checks.filter((check) => check.status === "pass").length;
  const summary = report.ok
    ? paint.green(`Doctor passed: ${passed} ok, ${warned} warning(s).`)
    : paint.red(`Doctor failed: ${failed} error(s), ${warned} warning(s).`);
  stdout.write(`\n${summary}\n`);
}

export { formatDiagnostic };
