import { resolve } from "jsr:@std/path@1.1.6";

import {
  buildWorkspaceGraph,
  createPortableManifest,
  loadWorkspaceDeclaration,
  parseWorkspaceDeclaration,
  runWorkspaceTask,
  syncWorkspaceLinks,
  validateWorkspaceLinks,
  writePortableManifest,
} from "./mod.ts";

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

function writeJson(path: string, value: unknown): void {
  Deno.mkdirSync(resolve(path, ".."), { recursive: true });
  Deno.writeTextFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function createRepository(
  root: string,
  name: string,
  packageName: string,
  links: unknown[] = [],
): void {
  Deno.mkdirSync(root, { recursive: true });
  writeJson(resolve(root, "package.json"), {
    name: packageName,
    version: "1.2.3",
    type: "module",
    exports: { ".": "./dist/index.js" },
    bin: { [name]: "./dist/cli.js" },
  });
  Deno.mkdirSync(resolve(root, "dist"), { recursive: true });
  Deno.writeTextFileSync(resolve(root, "dist/index.js"), "export {};\n");
  Deno.writeTextFileSync(resolve(root, "dist/cli.js"), "#!/usr/bin/env node\n");
  writeJson(resolve(root, "lapismd-workspace.json"), {
    schemaVersion: 1,
    repository: {
      name,
      packages: [packageName],
      workspaceRoot: "..",
    },
    links,
  });
}

function providerLink(path = "../provider") {
  return {
    name: "@test/provider",
    path,
    revision: "0123456789abcdef0123456789abcdef01234567",
    range: "^1.2.0",
    requiredExports: ["."],
    requiredFiles: ["dist/index.js"],
  };
}

Deno.test(
  "workspace declarations reject unknown fields and duplicate links",
  () => {
    assertThrows(
      () =>
        parseWorkspaceDeclaration({
          schemaVersion: 1,
          repository: {
            name: "consumer",
            packages: ["@test/consumer"],
            workspaceRoot: "..",
          },
          links: [],
          surprise: true,
        }),
      /unknown field/u,
    );
    assertThrows(
      () =>
        parseWorkspaceDeclaration({
          schemaVersion: 1,
          repository: {
            name: "consumer",
            packages: ["@test/consumer"],
            workspaceRoot: "..",
          },
          links: [providerLink(), providerLink()],
        }),
      /duplicate package/u,
    );
  },
);

Deno.test(
  "link validation checks boundaries, names, exports, and build output",
  () => {
    const workspace = Deno.makeTempDirSync();
    try {
      const consumer = resolve(workspace, "consumer");
      const provider = resolve(workspace, "provider");
      createRepository(provider, "provider", "@test/provider");
      createRepository(consumer, "consumer", "@test/consumer", [
        providerLink(),
      ]);
      assertEquals(
        loadWorkspaceDeclaration(consumer).repository.name,
        "consumer",
      );
      assertEquals(
        validateWorkspaceLinks(consumer).map((link) => link.manifest.name),
        ["@test/provider"],
      );

      writeJson(resolve(consumer, "lapismd-workspace.json"), {
        schemaVersion: 1,
        repository: {
          name: "consumer",
          packages: ["@test/consumer"],
          workspaceRoot: ".",
        },
        links: [providerLink()],
      });
      assertThrows(
        () => validateWorkspaceLinks(consumer),
        /escapes workspace root/u,
      );
    } finally {
      Deno.removeSync(workspace, { recursive: true });
    }
  },
);

Deno.test(
  "link synchronization is owned, deterministic, and collision safe",
  () => {
    const workspace = Deno.makeTempDirSync();
    try {
      const consumer = resolve(workspace, "consumer");
      const provider = resolve(workspace, "provider");
      createRepository(provider, "provider", "@test/provider");
      createRepository(consumer, "consumer", "@test/consumer", [
        providerLink(),
      ]);
      const first = syncWorkspaceLinks(consumer);
      const second = syncWorkspaceLinks(consumer);
      assertEquals(first, second);
      assert(
        Deno.lstatSync(resolve(consumer, "node_modules/@test/provider"))
          .isSymlink,
      );
      assert(
        Deno.lstatSync(resolve(consumer, "node_modules/.bin/provider"))
          .isSymlink,
      );

      Deno.removeSync(resolve(consumer, "node_modules/@test/provider"));
      Deno.mkdirSync(resolve(consumer, "node_modules/@test/provider"), {
        recursive: true,
      });
      assertThrows(() => syncWorkspaceLinks(consumer), /non-symlink/u);
    } finally {
      Deno.removeSync(workspace, { recursive: true });
    }
  },
);

Deno.test("pack writes portable manifests without mutating source", () => {
  const workspace = Deno.makeTempDirSync();
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
      JSON.parse(Deno.readTextFileSync(resolve(consumer, "package.json"))),
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
    Deno.removeSync(workspace, { recursive: true });
  }
});

Deno.test(
  "workspace graph runs dependencies first and rejects cycles",
  async () => {
    const workspace = Deno.makeTempDirSync();
    try {
      const consumer = resolve(workspace, "consumer");
      const provider = resolve(workspace, "provider");
      createRepository(provider, "provider", "@test/provider");
      createRepository(consumer, "consumer", "@test/consumer", [
        providerLink(),
      ]);
      const graph = buildWorkspaceGraph(consumer);
      assertEquals([...graph.nodes.keys()], ["provider", "consumer"]);
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

      writeJson(resolve(provider, "lapismd-workspace.json"), {
        schemaVersion: 1,
        repository: {
          name: "provider",
          packages: ["@test/provider"],
          workspaceRoot: "..",
        },
        links: [
          {
            name: "@test/consumer",
            path: "../consumer",
            revision: "0123456789abcdef0123456789abcdef01234567",
            range: "^1.2.0",
            requiredExports: ["."],
            requiredFiles: ["dist/index.js"],
          },
        ],
      });
      await assertRejects(
        () =>
          runWorkspaceTask(consumer, "check", { includeDependencies: true }),
        /cycle/u,
      );
    } finally {
      Deno.removeSync(workspace, { recursive: true });
    }
  },
);
