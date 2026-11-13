import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { fileURLToPath } from "node:url";

const dist = fileURLToPath(new URL("../dist", import.meta.url));
const port = Number.parseInt(process.env.CUBE_LAB_PORT ?? "4173", 10);
const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };

createServer(async (request, response) => {
  const relative = request.url === "/" ? "/index.html" : (request.url ?? "/index.html").split("?")[0];
  if (relative.includes("..")) { response.writeHead(400).end("Bad request"); return; }
  try {
    const data = await readFile(`${dist}${relative}`);
    response.writeHead(200, { "content-type": mime[extname(relative)] ?? "application/octet-stream", "cache-control": "no-store" });
    response.end(data);
  } catch {
    response.writeHead(404).end("Not found");
  }
}).listen(port, "127.0.0.1", () => console.log(`Cube Baby lab: http://127.0.0.1:${port}`));
