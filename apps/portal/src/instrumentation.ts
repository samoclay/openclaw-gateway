export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }
  try {
    const { createDocumentClient, ensureTables } = await import("./db/dynamo");
    const { bootstrapAdmin } = await import("./server/bootstrap");
    const { raw } = createDocumentClient();
    await ensureTables(raw);
    await bootstrapAdmin();
  } catch (error) {
    console.warn("bootstrap skipped:", error);
  }
}
