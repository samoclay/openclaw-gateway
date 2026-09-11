export const WORKSPACE_STAGES = [
  "browser",
  "portal",
  "sidecar",
  "gateway",
  "model",
] as const;

export type WorkspaceStage = (typeof WORKSPACE_STAGES)[number];

export type WorkspaceError = {
  code: string;
  stage: WorkspaceStage;
  title: string;
  detail: string;
};

export const WORKSPACE_ERRORS: Record<string, WorkspaceError> = {
  not_signed_in: {
    code: "not_signed_in",
    stage: "portal",
    title: "Sign in required",
    detail: "Your session expired. Sign in again to use Workspace.",
  },
  no_sandbox: {
    code: "no_sandbox",
    stage: "portal",
    title: "No environment yet",
    detail:
      "You do not have an isolated environment. An admin must grant one in Access.",
  },
  not_a_member: {
    code: "not_a_member",
    stage: "portal",
    title: "This environment is closed to you",
    detail:
      "You are not a member of that sandbox. Choose one from the list or ask an admin.",
  },
  sidecar_offline: {
    code: "sidecar_offline",
    stage: "sidecar",
    title: "Capacity is offline",
    detail:
      "The portal reached our servers, but the inference host is not connected. Chat stays disabled until capacity shows connected.",
  },
  crypto_setup_failed: {
    code: "crypto_setup_failed",
    stage: "browser",
    title: "Could not start a private session",
    detail:
      "This browser could not agree encryption keys with the inference host. Refresh and try again.",
  },
  decrypt_failed: {
    code: "decrypt_failed",
    stage: "browser",
    title: "A reply could not be unlocked",
    detail:
      "A message arrived from the host but this session could not decrypt it. Nothing was stored. Refresh Workspace.",
  },
  passkey_unavailable: {
    code: "passkey_unavailable",
    stage: "browser",
    title: "History will not be saved on this device",
    detail:
      "Live chat can continue in memory. This browser has no passkey, so Halcyon will not keep a local transcript.",
  },
  passkey_cancelled: {
    code: "passkey_cancelled",
    stage: "browser",
    title: "History not unlocked",
    detail:
      "You cancelled the passkey prompt. The room is empty until you unlock, or you can chat without saving.",
  },
  role_unknown: {
    code: "role_unknown",
    stage: "portal",
    title: "That agent is not in this environment",
    detail: "@mention only works for roles in the sandbox you have open.",
  },
  role_create_failed: {
    code: "role_create_failed",
    stage: "sidecar",
    title: "Could not add that agent",
    detail:
      "The portal saved nothing. Capacity must be connected; try again once it is.",
  },
  gateway_unreachable: {
    code: "gateway_unreachable",
    stage: "sidecar",
    title: "The model host did not answer",
    detail:
      "Capacity is connected, but the local Gateway on the inference host refused or timed out.",
  },
  model_error: {
    code: "model_error",
    stage: "model",
    title: "The model failed this turn",
    detail:
      "The environment is up; this completion failed. Try a shorter message or another role.",
  },
  thread_denied: {
    code: "thread_denied",
    stage: "portal",
    title: "That conversation does not belong here",
    detail:
      "The thread id is not yours for this sandbox. Start a new thread.",
  },
  sealed_rejected: {
    code: "sealed_rejected",
    stage: "portal",
    title: "Message not accepted",
    detail:
      "The portal refused a malformed sealed payload. Nothing was sent to the model.",
  },
};

export function workspaceError(code: string): WorkspaceError {
  return WORKSPACE_ERRORS[code] ?? WORKSPACE_ERRORS.sealed_rejected;
}
