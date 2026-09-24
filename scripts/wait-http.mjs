const target = process.argv[2];
if (!target) throw new Error("Usage: node scripts/wait-http.mjs <url>");
const deadline = Date.now() + 90_000;
let last = "";
while (Date.now() < deadline) {
  try {
    const response = await fetch(target, { redirect: "manual" });
    if (response.status < 500) {
      console.log(`Ready: ${target} (${response.status})`);
      process.exit(0);
    }
    last = `HTTP ${response.status}`;
  } catch (error) {
    last = error instanceof Error ? error.message : String(error);
  }
  await new Promise((resolve) => setTimeout(resolve, 750));
}
throw new Error(`Server did not become ready: ${target} · ${last}`);
