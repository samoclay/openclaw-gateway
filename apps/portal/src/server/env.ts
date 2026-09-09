function fallback(name: string, devDefault: string): string {
  return process.env[name] || devDefault;
}

export const env = {
  AUTH_SECRET: fallback("AUTH_SECRET", "dev-only-change-me-use-32-chars-min"),
  AUTH_URL: fallback("AUTH_URL", "http://localhost:3000"),
  OPENCLAW_GATEWAY_URL: fallback(
    "OPENCLAW_GATEWAY_URL",
    "http://127.0.0.1:18789",
  ),
  OPENCLAW_GATEWAY_TOKEN: fallback(
    "OPENCLAW_GATEWAY_TOKEN",
    "dev-gateway-token",
  ),
  ADMIN_EMAIL: fallback("ADMIN_EMAIL", "admin@localhost"),
  ADMIN_PASSWORD: fallback("ADMIN_PASSWORD", "changeme-admin"),
  OPENCLAW_BIN: fallback("OPENCLAW_BIN", "openclaw"),
  OPENCLAW_CONFIG_PATH: process.env.OPENCLAW_CONFIG_PATH,
  OPENCLAW_PROVISION_CMD: process.env.OPENCLAW_PROVISION_CMD,
  OPENCLAW_WORKSPACE_ROOT: fallback(
    "OPENCLAW_WORKSPACE_ROOT",
    `${process.env.HOME ?? "/tmp"}/.openclaw`,
  ),
  AWS_REGION: fallback("AWS_REGION", "eu-west-2"),
  DYNAMODB_ENDPOINT: process.env.DYNAMODB_ENDPOINT,
  DYNAMODB_TABLE_PREFIX: fallback("DYNAMODB_TABLE_PREFIX", "halcyon_"),
};
