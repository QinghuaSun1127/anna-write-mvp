import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL("..", import.meta.url)), "exports");
const port = Number(process.env.ANNAWRITE_EXPORT_PORT || 5198);

function send(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  });
  res.end(JSON.stringify(body));
}

function sendHtml(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  });
  res.end(body);
}

function safeName(value) {
  return String(value || "annawrite-draft.txt")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 120);
}

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 200, { ok: true });
  if (req.method !== "POST" || !["/export", "/export-form"].includes(req.url || "")) return send(res, 404, { ok: false, error: "Not found" });

  let raw = "";
  req.on("data", (chunk) => {
    raw += chunk;
    if (raw.length > 5_000_000) req.destroy();
  });
  req.on("end", async () => {
    try {
      const payload = req.url === "/export-form"
        ? Object.fromEntries(new URLSearchParams(raw))
        : JSON.parse(raw || "{}");
      const filename = safeName(payload.filename);
      const content = String(payload.content || "");
      const encoding = payload.encoding === "base64" ? "base64" : "utf8";
      await mkdir(root, { recursive: true });
      const path = join(root, filename);
      await writeFile(path, encoding === "base64" ? Buffer.from(content, "base64") : content, encoding === "base64" ? undefined : "utf8");
      if (req.url === "/export-form") return sendHtml(res, 200, `<html><body>Saved ${filename}</body></html>`);
      send(res, 200, { ok: true, path });
    } catch (error) {
      if (req.url === "/export-form") return sendHtml(res, 400, `<html><body>Export failed</body></html>`);
      send(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });
});

server.listen(port, () => {
  console.log(`AnnaWrite export server listening on http://localhost:${port}`);
  console.log(`Exports folder: ${root}`);
});
