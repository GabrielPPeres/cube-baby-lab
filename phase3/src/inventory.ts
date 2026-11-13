import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { findBytePattern, findTextEvidence, parsePe, type PeInfo, type TextEvidence } from "./pe.ts";

export const COMMUNICATION_TERMS = [
  "midi", "sysex", "usb", "winmm", "midiIn", "midiOut", "bluetooth", "ble", "gatt", "sdp", "rfcomm",
  "QBluetooth", "QSerialPort", "RtMidi", "SetupDi", "HidD", "libusb", "CubeBaby", "SINCO",
] as const;

export interface InventoryRecord {
  readonly path: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly format: string;
  readonly pe?: PeInfo;
  readonly communicationText?: readonly TextEvidence[];
  readonly protocolPatternOffsets?: Readonly<Record<string, readonly number[]>>;
}

function formatOf(bytes: Uint8Array, name: string): string {
  if (bytes[0] === 0x4d && bytes[1] === 0x5a) return "pe";
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "pdf";
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return "zip";
  if (name.toLowerCase().endsWith(".qm")) return "qt-qm";
  if (name.toLowerCase().endsWith(".ini")) return "ini";
  if (/\.(bin|dat|up)$/i.test(name)) return "opaque-binary";
  return "unknown";
}

async function filesBelow(root: string, current = root): Promise<string[]> {
  const output: string[] = [];
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const path = resolve(current, entry.name);
    if (entry.isDirectory()) output.push(...await filesBelow(root, path));
    else if (entry.isFile()) output.push(path);
  }
  return output;
}

export async function buildInventory(root: string): Promise<InventoryRecord[]> {
  const records: InventoryRecord[] = [];
  for (const path of (await filesBelow(root)).sort()) {
    const bytes = new Uint8Array(await readFile(path));
    const info = await stat(path);
    const format = formatOf(bytes, path);
    const record: InventoryRecord = {
      path: relative(root, path).replaceAll("\\", "/"),
      bytes: info.size,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      format,
      ...(format === "pe" ? { pe: parsePe(bytes) } : {}),
      ...(format === "pe" ? { communicationText: findTextEvidence(bytes, COMMUNICATION_TERMS) } : {}),
      ...(format === "pe" ? {
        protocolPatternOffsets: {
          identityClearHeader: findBytePattern(bytes, Uint8Array.of(0x00, 0x59, 0x11, 0x00, 0x00, 0x00)),
          presetReadClearBody: findBytePattern(bytes, Uint8Array.of(0x05, 0x00, 0x00, 0x00, 0x00, 0x30, 0x00, 0x00)),
          identityWireFrame: findBytePattern(bytes, Uint8Array.from(Buffer.from("f0003245000000407ff7", "hex"))),
          presetReadWireFrame: findBytePattern(bytes, Uint8Array.from(Buffer.from("f000320d410000400200000000000600004a01f7", "hex"))),
        },
      } : {}),
    };
    records.push(record);
  }
  return records;
}
