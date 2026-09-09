import { bootstrapAdmin } from "../server/bootstrap";
import { createDocumentClient, ensureTables } from "../db/dynamo";

async function main() {
  const { raw } = createDocumentClient();
  await ensureTables(raw);
  await bootstrapAdmin();
  console.log("admin bootstrap complete");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
