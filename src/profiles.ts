import type { UserConfig, VerificationOptions } from "./types.js";

export function headingRequirements(
  overrides: Partial<UserConfig> = {},
): UserConfig {
  return {
    requirementStyle: "heading",
    headingTemplate: "## <ID> — <surface>",
    minAcceptance: 2,
    maxAcceptance: 4,
    ...overrides,
    validators: { governance: true, ...overrides.validators },
  };
}

export function tableRequirements(
  overrides: Partial<UserConfig> = {},
): UserConfig {
  return {
    requirementStyle: "table",
    minAcceptance: 0,
    maxAcceptance: 20,
    ...overrides,
    validators: {
      governance: {
        acceptance: false,
        normative: true,
        proseLimits: true,
        references: true,
      },
      ...overrides.validators,
    },
  };
}

export function singleIdVerification(
  overrides: VerificationOptions = {},
): VerificationOptions {
  return {
    mode: "table",
    headers: {
      ids: ["Requirement", "ID"],
      status: ["Status"],
      evidence: ["Evidence"],
      required: [],
    },
    idMode: "single",
    statuses: ["Implemented", "In progress", "Partial"],
    statusMatch: "exact",
    rejectOrphans: true,
    requireEvidence: true,
    ...overrides,
  };
}

export function groupedIdVerification(
  overrides: VerificationOptions = {},
): VerificationOptions {
  return {
    ...singleIdVerification(),
    headers: {
      ids: ["Requirements", "Requirement"],
      status: ["Status", "Audit state"],
      evidence: ["Evidence", "Primary automated evidence"],
      required: [],
    },
    idMode: "grouped",
    ...overrides,
  };
}

export const profiles = {
  headingRequirements,
  tableRequirements,
  singleIdVerification,
  groupedIdVerification,
};
