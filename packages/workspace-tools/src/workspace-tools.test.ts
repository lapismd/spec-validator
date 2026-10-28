import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildWorkspaceGraph,
  createPortableManifest,
  loadWorkspaceDeclaration,
  parseWorkspaceDeclaration,
  runWorkspaceTask,
  syncWorkspaceLinks,
  validateWorkspaceLinks,
  writePortableManifest,
} from "./mod.js";

function assert(
  condition: unknown,
  message = "assertion failed",
): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown): void {
  const left = JSON.stringify(actual);
  const right = JSON.stringify(expected);
  if (left !== right) throw new Error(`expected ${right}, received ${left}`);
}

function assertThrows(action: () => unknown, pattern: RegExp): void {
  try {
    action();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert(pattern.test(message), `expected ${pattern}, received ${message}`);
    return;
  }
  throw new Error(`expected action to throw ${pattern}`);
}

function assertMissing(path: string): void {
  try {
    lstatSync(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  throw new Error(`expected ${path} to be missing`);
}

async function assertRejects(
  action: () => Promise<unknown>,
  pattern: RegExp,
): Promise<void> {
  try {
    await action();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert(pattern.test(message), `expected ${pattern}, received ${message}`);
    return;
  }
  throw new Error(`expected action to reject ${pattern}`);
}

function makeTempWorkspace(): string {
  return mkdtempSync(join(tmpdir(), "lapismd-workspace-"));
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function readFixture(name: string): unknown {
  return JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)),
      "utf8",
    ),
  );
}

function buildTasks() {
  return {
    build: {
      inputs: ["src"],
      outputs: ["dist/index.js"],
    },
  };
}

function writeRepositoryContract(
  root: string,
  name: string,
  packageName: string,
  links: unknown[],
  workspaceRoot = "..",
): void {
  writeJson(resolve(root, "lapismd-workspace.json"), {
    schemaVersion: 2,
    repository: {
      name,
      packages: [packageName],
      workspaceRoot,
      tasks: buildTasks(),
    },
    links,
  });
}

function createRepository(
  root: string,
  name: string,
  packageName: string,
  links: unknown[] = [],
): void {
  mkdirSync(root, { recursive: true });
  writeJson(resolve(root, "package.json"), {
    name: packageName,
    version: "1.2.3",
    type: "module",
    exports: { ".": "./dist/index.js" },
    bin: { [name]: "./dist/cli.js" },
  });
  mkdirSync(resolve(root, "dist"), { recursive: true });
  mkdirSync(resolve(root, "src"), { recursive: true });
  writeFileSync(resolve(root, "src/index.ts"), "export {};\n");
  writeFileSync(resolve(root, "dist/index.js"), "export {};\n");
  writeFileSync(resolve(root, "dist/cli.js"), "#!/usr/bin/env node\n");
  writeRepositoryContract(root, name, packageName, links);
}

function providerLink(path = "../provider") {
  return {
    name: "@test/provider",
    path,
    revision: "0123456789abcdef0123456789abcdef01234567",
    range: "^1.2.0",
    direction: "dependency",
    requiredExports: ["."],
    build: {
      task: null,
      inputs: [],
      outputs: ["dist/index.js"],
    },
  };
}

test("workspace declarations reject unknown fields and duplicate links", () => {
  assertEquals(
    parseWorkspaceDeclaration(readFixture("valid.json")).schemaVersion,
    2,
  );
  assertThrows(
    () => parseWorkspaceDeclaration(readFixture("invalid-unknown-field.json")),
    /unknown field/u,
  );
  assertThrows(
    () =>
      parseWorkspaceDeclaration({
        schemaVersion: 2,
        repository: {
          name: "consumer",
          packages: ["@test/consumer"],
          workspaceRoot: "..",
          tasks: {},
        },
        links: [],
        surprise: true,
      }),
    /unknown field/u,
  );
  assertThrows(
    () =>
      parseWorkspaceDeclaration({
        schemaVersion: 2,
        repository: {
          name: "consumer",
          packages: ["@test/consumer"],
          workspaceRoot: "..",
          tasks: {},
        },
        links: [providerLink(), providerLink()],
      }),
    /duplicate package/u,
  );
});

test("link validation checks boundaries, names, exports, and build output", () => {
  const workspace = makeTempWorkspace();
  try {
    const consumer = resolve(workspace, "consumer");
    const provider = resolve(workspace, "provider");
    createRepository(provider, "provider", "@test/provider");
    createRepository(consumer, "consumer", "@test/consumer", [providerLink()]);
    assertEquals(
      loadWorkspaceDeclaration(consumer).repository.name,
      "consumer",
    );
    assertEquals(
      validateWorkspaceLinks(consumer).map((link) => link.manifest.name),
      ["@test/provider"],
    );

    rmSync(resolve(provider, "dist/index.js"));
    assertThrows(
      () => validateWorkspaceLinks(consumer),
      /build output is missing/u,
    );
    writeFileSync(resolve(provider, "dist/index.js"), "export {};\n");

    rmSync(resolve(provider, "dist/cli.js"));
    assertThrows(
      () => validateWorkspaceLinks(consumer),
      /bin provider is missing/u,
    );
    writeFileSync(resolve(provider, "dist/cli.js"), "#!/usr/bin/env node\n");

    const providerManifest = JSON.parse(
      readFileSync(resolve(provider, "package.json"), "utf8"),
    );
    writeJson(resolve(provider, "package.json"), {
      ...providerManifest,
      name: "@test/wrong-provider",
    });
    assertThrows(
      () => validateWorkspaceLinks(consumer),
      /target declares package/u,
    );
    writeJson(resolve(provider, "package.json"), providerManifest);

    writeJson(resolve(provider, "package.json"), {
      ...providerManifest,
      exports: { "./other": "./dist/index.js" },
    });
    assertThrows(
      () => validateWorkspaceLinks(consumer),
      /missing required export/u,
    );
    writeJson(resolve(provider, "package.json"), providerManifest);

    writeRepositoryContract(consumer, "consumer", "@test/consumer", [
      providerLink("../missing"),
    ]);
    assertThrows(() => validateWorkspaceLinks(consumer), /target is missing/u);

    writeRepositoryContract(
      consumer,
      "consumer",
      "@test/consumer",
      [providerLink()],
      ".",
    );
    assertThrows(
      () => validateWorkspaceLinks(consumer),
      /escapes workspace root/u,
    );

    writeRepositoryContract(consumer, "consumer", "@test/consumer", [
      {
        ...providerLink(),
        build: {
          task: "build",
          inputs: ["src"],
          outputs: ["dist/index.js"],
        },
      },
    ]);
    mkdirSync(resolve(provider, "src"), { recursive: true });
    writeFileSync(resolve(provider, "src/index.ts"), "export {};\n");
    const future = new Date(Date.now() + 10_000);
    utimesSync(resolve(provider, "src/index.ts"), future, future);
    assertThrows(
      () => validateWorkspaceLinks(consumer),
      /build output is stale/u,
    );
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("link synchronization is owned, deterministic, and collision safe", () => {
  const workspace = makeTempWorkspace();
  try {
    const consumer = resolve(workspace, "consumer");
    const provider = resolve(workspace, "provider");
    createRepository(provider, "provider", "@test/provider");
    createRepository(consumer, "consumer", "@test/consumer", [providerLink()]);
    const first = syncWorkspaceLinks(consumer);
    const second = syncWorkspaceLinks(consumer);
    assertEquals(first, second);
    assert(
      lstatSync(
        resolve(consumer, "node_modules/@test/provider"),
      ).isSymbolicLink(),
    );
    assert(
      lstatSync(
        resolve(consumer, "node_modules/.bin/provider"),
      ).isSymbolicLink(),
    );

    writeRepositoryContract(consumer, "consumer", "@test/consumer", []);
    syncWorkspaceLinks(consumer);
    assertMissing(resolve(consumer, "node_modules/@test/provider"));
    assertMissing(resolve(consumer, "node_modules/.bin/provider"));

    writeRepositoryContract(consumer, "consumer", "@test/consumer", [
      providerLink(),
    ]);

    mkdirSync(resolve(consumer, "node_modules/@test/provider"), {
      recursive: true,
    });
    assertThrows(() => syncWorkspaceLinks(consumer), /non-symlink/u);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("pack writes portable manifests without mutating source", () => {
  const workspace = makeTempWorkspace();
  try {
    const consumer = resolve(workspace, "consumer");
    createRepository(
      resolve(workspace, "provider"),
      "provider",
      "@test/provider",
    );
    createRepository(consumer, "consumer", "@test/consumer", [providerLink()]);
    const source = {
      name: "@test/consumer",
      version: "1.0.0",
      dependencies: { "@test/provider": "link:../provider", stable: "^2.0.0" },
    };
    writeJson(resolve(consumer, "package.json"), source);
    const portable = createPortableManifest(consumer, source);
    assertEquals(portable.dependencies, {
      "@test/provider": "^1.2.0",
      stable: "^2.0.0",
    });
    writePortableManifest(consumer, "package.json", "staging/package.json");
    assertEquals(
      JSON.parse(readFileSync(resolve(consumer, "package.json"), "utf8")),
      source,
    );
    assertThrows(
      () =>
        createPortableManifest(consumer, {
          ...source,
          dependencies: { unknown: "file:../unknown" },
        }),
      /unmapped local specifier/u,
    );
    assertThrows(
      () => writePortableManifest(consumer, "package.json", "package.json"),
      /must not overwrite/u,
    );
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("workspace graph runs dependencies first and rejects cycles", async () => {
  const workspace = makeTempWorkspace();
  try {
    const consumer = resolve(workspace, "consumer");
    const provider = resolve(workspace, "provider");
    createRepository(provider, "provider", "@test/provider");
    createRepository(consumer, "consumer", "@test/consumer", [providerLink()]);
    const graph = buildWorkspaceGraph(consumer);
    assertEquals([...graph.nodes.keys()].sort(), ["consumer", "provider"]);
    const visited: string[] = [];
    await runWorkspaceTask(
      consumer,
      "check",
      { includeDependencies: true },
      (node) => {
        visited.push(node.name);
        return 0;
      },
    );
    assertEquals(visited, ["provider", "consumer"]);

    writeRepositoryContract(provider, "provider", "@test/provider", [
      {
        ...providerLink("../consumer"),
        name: "@test/consumer",
        direction: "dependent",
      },
    ]);
    const dependentVisited: string[] = [];
    await runWorkspaceTask(
      provider,
      "check",
      { filter: "provider", includeDependents: true },
      (node) => {
        dependentVisited.push(node.name);
        return 0;
      },
    );
    assertEquals(dependentVisited, ["provider", "consumer"]);

    writeRepositoryContract(provider, "provider", "@test/provider", [
      {
        name: "@test/consumer",
        path: "../consumer",
        revision: "0123456789abcdef0123456789abcdef01234567",
        range: "^1.2.0",
        direction: "dependency",
        requiredExports: ["."],
        build: {
          task: null,
          inputs: [],
          outputs: ["dist/index.js"],
        },
      },
    ]);
    await assertRejects(
      () => runWorkspaceTask(consumer, "check", { includeDependencies: true }),
      /cycle/u,
    );
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("workspace task cache invalidates when declared inputs change", async () => {
  const workspace = makeTempWorkspace();
  try {
    const repository = resolve(workspace, "repository");
    createRepository(repository, "repository", "@test/repository");
    let runs = 0;
    const runner = () => {
      runs += 1;
      return 0;
    };
    await runWorkspaceTask(repository, "build", {}, runner);
    await runWorkspaceTask(repository, "build", {}, runner);
    assertEquals(runs, 1);

    writeFileSync(
      resolve(repository, "src/index.ts"),
      "export const changed = true;\n",
    );
    await runWorkspaceTask(repository, "build", {}, runner);
    assertEquals(runs, 2);

    await runWorkspaceTask(repository, "build", { cache: false }, runner);
    assertEquals(runs, 3);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
