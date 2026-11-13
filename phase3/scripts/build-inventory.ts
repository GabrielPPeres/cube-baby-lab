import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildInventory } from "../src/inventory.ts";

const phase3 = resolve(import.meta.dirname, "..");
const root = resolve(phase3, "extracted", "CubeSuite", "CubeSuite");
const output = resolve(phase3, "analysis");
const records = await buildInventory(root);
await mkdir(output, { recursive: true });
await writeFile(resolve(output, "inventory.json"), `${JSON.stringify({ schema: "cubesuite-inventory-v1", root: "CubeSuite/", files: records }, null, 2)}\n`);

const rows = records.map((record) => `| \`${record.path}\` | ${record.bytes} | ${record.format} | \`${record.sha256}\` |`);
const markdown = [
  "# CubeSuite file inventory",
  "",
  "> Generated locally from the official package. It contains hashes and metadata only, never proprietary payload bytes.",
  "",
  "| Relative path | Bytes | Format | SHA-256 |",
  "| --- | ---: | --- | --- |",
  ...rows,
  "",
].join("\n");
await writeFile(resolve(output, "inventory.md"), markdown);
console.log(`Inventoried ${records.length} files.`);
