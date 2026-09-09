import { existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { env } from "./env";

export type ProvisionResult = {
  ok: boolean;
  message: string;
};

function provisionScript(): string | undefined {
  if (env.OPENCLAW_PROVISION_CMD) {
    return env.OPENCLAW_PROVISION_CMD;
  }
  const candidates = [
    path.resolve(process.cwd(), "scripts/provision-sandbox.mjs"),
    path.resolve(process.cwd(), "../../scripts/provision-sandbox.mjs"),
    path.resolve(process.cwd(), "../scripts/provision-sandbox.mjs"),
  ];
  return candidates.find((file) => existsSync(file));
}

export function provisionSandbox(args: {
  agentId: string;
  modelRef: string;
}): Promise<ProvisionResult> {
  const command = provisionScript();
  if (!command) {
    return Promise.resolve({
      ok: false,
      message: "provision script not found; sandbox saved in portal only",
    });
  }

  return new Promise((resolve) => {
    const child = spawn(command, [args.agentId, args.modelRef], {
      shell: true,
      env: {
        ...process.env,
        OPENCLAW_BIN: env.OPENCLAW_BIN,
        OPENCLAW_CONFIG_PATH: env.OPENCLAW_CONFIG_PATH ?? "",
        OPENCLAW_WORKSPACE_ROOT: env.OPENCLAW_WORKSPACE_ROOT,
      },
    });
    let stderr = "";
    let stdout = "";
    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      resolve({ ok: false, message: error.message });
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ ok: true, message: stdout.trim() || "provisioned" });
        return;
      }
      resolve({
        ok: false,
        message: stderr.trim() || stdout.trim() || `provision exited ${code}`,
      });
    });
  });
}
