import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { decodeMessage } from "../src/protocol.ts";

async function loadCapture(name: string) {
  const path = fileURLToPath(new URL(`../fixtures/captures/${name}`, import.meta.url));
  const lines = (await readFile(path, "utf8")).trim().split(/\r?\n/).slice(1);
  return lines.map((line) => {
    const row = JSON.parse(line) as { direction: string; dataHex: string };
    return { direction: row.direction, decoded: decodeMessage(Uint8Array.from(Buffer.from(row.dataHex, "hex"))) };
  });
}

test("startup fixture contains identity and a 48-byte bank read", async () => {
  const messages = await loadCapture("003-cubesuite-startup.jsonl");
  assert.ok(messages.some((m) => m.decoded.kind === "identity-request"));
  assert.ok(messages.some((m) => m.decoded.kind === "identity-response" && m.decoded.name === "SINCO-CubeBaby"));
  assert.ok(messages.some((m) => m.decoded.kind === "memory-read-request" && m.decoded.memory === 5 && m.decoded.address === 0 && m.decoded.length === 48));
  assert.ok(messages.some((m) => m.decoded.kind === "memory-read-response" && m.decoded.memory === 5 && m.decoded.address === 0 && m.decoded.data.length === 48));
});

test("CubeSuite save fixture is live write + ACK(0) + bank write + ACK(0) + read-back", async () => {
  const messages = await loadCapture("020-cubesuite-save.jsonl");
  assert.equal(messages.length, 6);
  const kinds = messages.map((m) => m.decoded.kind);
  assert.deepEqual(kinds, ["memory-write-request", "ack", "memory-write-request", "ack", "memory-read-request", "memory-read-response"]);
  const live = messages[0].decoded;
  assert.ok(live.kind === "memory-write-request");
  assert.equal(live.address, 0x80000005);
  assert.deepEqual([...live.data], [100]);
  const bankWrite = messages[2].decoded;
  assert.ok(bankWrite.kind === "memory-write-request");
  assert.equal(bankWrite.address, 0);
  assert.equal(bankWrite.data.length, 48);
  assert.ok([messages[1].decoded, messages[3].decoded].every((m) => m.kind === "ack" && m.rawValue === 0));
});

for (const capture of ["018-preset-switch-a-b-c.jsonl", "019-footswitch-a-b-c.jsonl"]) {
  test(`${capture} contains no memory write`, async () => {
    const messages = await loadCapture(capture);
    assert.equal(messages.some((m) => m.decoded.kind === "memory-write-request"), false);
  });
}
