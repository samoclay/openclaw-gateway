#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const [agentId, modelRef] = process.argv.slice(2);
if (!agentId || !modelRef) {
  console.error("usage: provision-sandbox.mjs <agentId> <modelRef>");
  process.exit(1);
}

const bin = process.env.OPENCLAW_BIN || "openclaw";
const workspaceRoot =
  process.env.OPENCLAW_WORKSPACE_ROOT || path.join(os.homedir(), ".openclaw");
const workspace = path.join(workspaceRoot, `workspace-${agentId}`);
const configPath =
  process.env.OPENCLAW_CONFIG_PATH ||
  path.join(os.homedir(), ".openclaw", "openclaw.json");

const added = spawnSync(
  bin,
  ["agents", "add", agentId, "--workspace", workspace, "--non-interactive"],
  { encoding: "utf8" },
);

if (added.status !== 0) {
  const combined = `${added.stdout ?? ""}\n${added.stderr ?? ""}`;
  if (!/already exists|exists/i.test(combined)) {
    console.error(combined || `openclaw agents add exited ${added.status}`);
    process.exit(added.status ?? 1);
  }
}

if (fs.existsSync(configPath)) {
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  config.agents ??= {};
  config.agents.list ??= [];
  const existing = config.agents.list.find((entry) => entry.id === agentId);
  const next = {
    id: agentId,
    workspace,
    model: { primary: modelRef },
  };
  if (existing) {
    Object.assign(existing, next);
  } else {
    config.agents.list.push(next);
  }
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
}

console.log(`provisioned ${agentId} -> ${modelRef} (${workspace})`);
