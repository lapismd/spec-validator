const REQUIRED_DENO_VERSION = "2.9.5";

if (Deno.version.deno !== REQUIRED_DENO_VERSION) {
  console.error(
    `Deno ${REQUIRED_DENO_VERSION} is required; received ${Deno.version.deno}.`,
  );
  Deno.exit(1);
}

console.log(`Deno ${REQUIRED_DENO_VERSION} verified.`);
