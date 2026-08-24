function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test(
  "bundled Deno CLI validates through the Deno platform adapter",
  () => {
    const result = new Deno.Command("deno", {
      args: ["run", "-A", "./dist/deno/cli.js", "validate", "--json"],
      cwd: Deno.cwd(),
      stdout: "piped",
      stderr: "piped",
    }).outputSync();
    const stdout = new TextDecoder().decode(result.stdout);
    const stderr = new TextDecoder().decode(result.stderr);
    assert(result.success, `Deno CLI failed: ${stderr || stdout}`);
    const report = JSON.parse(stdout) as { ok?: boolean; exitCode?: number };
    assert(report.ok === true && report.exitCode === 0, stdout);
    const bundle = Deno.readTextFileSync("./dist/deno/cli.js");
    assert(
      !bundle.includes('from "node:'),
      "Deno bundle contains a node: import",
    );
  },
);

Deno.test("Deno package name resolves the built portable entry point", () => {
  const result = new Deno.Command("deno", {
    args: [
      "eval",
      'await import("@lapismd/spec-validator"); console.log("package import passed")',
    ],
    cwd: Deno.cwd(),
    stdout: "piped",
    stderr: "piped",
  }).outputSync();
  const stdout = new TextDecoder().decode(result.stdout);
  const stderr = new TextDecoder().decode(result.stderr);
  assert(result.success, `Deno package import failed: ${stderr || stdout}`);
  assert(stdout.includes("package import passed"), stdout);
  assert(!stderr.includes('"links" field'), stderr);
});
