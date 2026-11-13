import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { decodeMessage } from "../src/protocol.ts";

const directory = fileURLToPath(new URL("../fixtures/captures", import.meta.url));
for (const name of (await readdir(directory)).filter((item) => item.endsWith(".jsonl")).sort()) {
  const rows = (await readFile(`${directory}/${name}`, "utf8"))
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => JSON.parse(line) as { dataHex: string });
  const messages = rows.map((row) => decodeMessage(Uint8Array.from(Buffer.from(row.dataHex, "hex"))));
  const writes = messages
    .filter((message) => message.kind === "memory-write-request")
    .map((message) => `m${message.memory}@0x${message.address.toString(16)}[${message.length}]=${Buffer.from(message.data).toString("hex").slice(0, 24)}`);
  const reads = messages
    .filter((message) => message.kind === "memory-read-request")
    .map((message) => `m${message.memory}@0x${message.address.toString(16)}[${message.length}]`);
  const ack = messages.filter((message) => message.kind === "ack").map((message) => message.rawValue);
  const unknown = messages
    .filter((message) => message.kind === "unknown")
    .map((message) => `0x${message.messageType.toString(16)}`);
  console.log(JSON.stringify({ name, messages: messages.length, writes, reads, ack, unknown }));
}
