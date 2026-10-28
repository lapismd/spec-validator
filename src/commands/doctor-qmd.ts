import { spawnSync, runtime } from "../platform/current.js";
import type { DoctorCheck } from "../types.js";
import {
  findQmdOnPath,
  nativeModuleAdvice,
  QMD_INSTALL_COMMAND,
} from "./search-host.js";

/** Report whether the system `qmd` binary is reachable on PATH. */
export function qmdBinaryCheck(
  binary: string | null = findQmdOnPath() ?? null,
): DoctorCheck {
  return binary
    ? {
        name: "qmd-binary",
        status: "pass",
        message: `system qmd found at ${binary}`,
      }
    : {
        name: "qmd-binary",
        status: "warn",
        message: `qmd is not on PATH; install it with \`${QMD_INSTALL_COMMAND}\`; search will fall back to rg`,
      };
}

/**
 * Probe the system binary with `qmd status`, which loads the native SQLite
 * modules and opens the local index, so an ABI mismatch or a missing binding
 * surfaces here with the exact npm repair command.
 */
export function qmdNativeCheck(
  repoRoot: string,
  binary: string | null = findQmdOnPath() ?? null,
): DoctorCheck {
  if (!binary) {
    return {
      name: "qmd-native",
      status: "warn",
      message: "skipped because the system qmd binary is not on PATH",
    };
  }
  const probe = spawnSync(binary, ["status"], {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...runtime.env, PWD: repoRoot },
    shell: runtime.platform === "win32",
  });
  const advice = nativeModuleAdvice(probe);
  if (advice) {
    return { name: "qmd-native", status: "fail", message: advice };
  }
  if ((probe.status ?? 1) !== 0) {
    const detail = (probe.stderr || probe.error?.message || "qmd status failed")
      .trim()
      .split("\n")[0];
    return {
      name: "qmd-native",
      status: "warn",
      message: `qmd status reported: ${detail}`,
    };
  }
  return {
    name: "qmd-native",
    status: "pass",
    message: "QMD native modules load and the index opens",
  };
}
