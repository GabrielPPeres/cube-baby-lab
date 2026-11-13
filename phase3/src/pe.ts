export interface PeSection {
  readonly name: string;
  readonly virtualAddress: number;
  readonly virtualSize: number;
  readonly rawOffset: number;
  readonly rawSize: number;
  readonly characteristics: number;
}

export interface PeImport {
  readonly dll: string;
  readonly functions: readonly ({ readonly name: string; readonly hint: number } | { readonly ordinal: number })[];
}

export interface PeInfo {
  readonly format: "pe32" | "pe32+";
  readonly machine: number;
  readonly architecture: "x86" | "x64" | "unknown";
  readonly timestamp: number;
  readonly entryPointRva: number;
  readonly imageBase: number;
  readonly subsystem: number;
  readonly characteristics: number;
  readonly dllCharacteristics: number;
  readonly sections: readonly PeSection[];
  readonly imports: readonly PeImport[];
}

function requireRange(bytes: Uint8Array, offset: number, length: number, label: string): void {
  if (!Number.isInteger(offset) || offset < 0 || length < 0 || offset + length > bytes.length) {
    throw new Error(`${label} is outside the file`);
  }
}

function u16(view: DataView, offset: number): number {
  requireRange(new Uint8Array(view.buffer, view.byteOffset, view.byteLength), offset, 2, "u16");
  return view.getUint16(offset, true);
}

function u32(view: DataView, offset: number): number {
  requireRange(new Uint8Array(view.buffer, view.byteOffset, view.byteLength), offset, 4, "u32");
  return view.getUint32(offset, true);
}

function asciiZ(bytes: Uint8Array, offset: number, limit = 4096): string {
  requireRange(bytes, offset, 1, "string");
  const endLimit = Math.min(bytes.length, offset + limit);
  let end = offset;
  while (end < endLimit && bytes[end] !== 0) end += 1;
  if (end === endLimit) throw new Error("unterminated or overlong PE string");
  return Buffer.from(bytes.subarray(offset, end)).toString("ascii");
}

export function parsePe(bytes: Uint8Array): PeInfo {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  requireRange(bytes, 0, 0x40, "DOS header");
  if (bytes[0] !== 0x4d || bytes[1] !== 0x5a) throw new Error("not an MZ executable");
  const pe = u32(view, 0x3c);
  requireRange(bytes, pe, 24, "PE header");
  if (u32(view, pe) !== 0x00004550) throw new Error("invalid PE signature");

  const coff = pe + 4;
  const machine = u16(view, coff);
  const sectionCount = u16(view, coff + 2);
  const timestamp = u32(view, coff + 4);
  const optionalSize = u16(view, coff + 16);
  const characteristics = u16(view, coff + 18);
  const optional = coff + 20;
  requireRange(bytes, optional, optionalSize, "optional header");
  const magic = u16(view, optional);
  if (magic !== 0x10b && magic !== 0x20b) throw new Error("unsupported PE optional header");
  const is64 = magic === 0x20b;
  const format = is64 ? "pe32+" : "pe32";
  const entryPointRva = u32(view, optional + 16);
  const imageBase = is64
    ? Number(view.getBigUint64(optional + 24, true))
    : u32(view, optional + 28);
  const subsystem = u16(view, optional + 68);
  const dllCharacteristics = u16(view, optional + 70);
  const dataDirectory = optional + (is64 ? 112 : 96);
  const numberOfDirectories = u32(view, optional + (is64 ? 108 : 92));

  const sectionTable = optional + optionalSize;
  requireRange(bytes, sectionTable, sectionCount * 40, "section table");
  const sections: PeSection[] = [];
  for (let index = 0; index < sectionCount; index += 1) {
    const at = sectionTable + index * 40;
    const nameEnd = bytes.subarray(at, at + 8).indexOf(0);
    const nameBytes = bytes.subarray(at, at + (nameEnd < 0 ? 8 : nameEnd));
    sections.push({
      name: Buffer.from(nameBytes).toString("ascii"),
      virtualSize: u32(view, at + 8),
      virtualAddress: u32(view, at + 12),
      rawSize: u32(view, at + 16),
      rawOffset: u32(view, at + 20),
      characteristics: u32(view, at + 36),
    });
  }

  const rvaToOffset = (rva: number): number => {
    for (const section of sections) {
      const span = Math.max(section.virtualSize, section.rawSize);
      if (rva >= section.virtualAddress && rva < section.virtualAddress + span) {
        const offset = section.rawOffset + rva - section.virtualAddress;
        requireRange(bytes, offset, 1, `RVA 0x${rva.toString(16)}`);
        return offset;
      }
    }
    if (rva < sectionTable) return rva;
    throw new Error(`unmapped RVA 0x${rva.toString(16)}`);
  };

  const imports: PeImport[] = [];
  if (numberOfDirectories > 1) {
    const importRva = u32(view, dataDirectory + 8);
    const importSize = u32(view, dataDirectory + 12);
    if (importRva !== 0 && importSize !== 0) {
      const descriptorStart = rvaToOffset(importRva);
      const descriptorLimit = Math.min(bytes.length, descriptorStart + importSize);
      for (let at = descriptorStart; at + 20 <= descriptorLimit; at += 20) {
        const originalThunkRva = u32(view, at);
        const nameRva = u32(view, at + 12);
        const firstThunkRva = u32(view, at + 16);
        if (originalThunkRva === 0 && nameRva === 0 && firstThunkRva === 0) break;
        const dll = asciiZ(bytes, rvaToOffset(nameRva));
        const thunkOffset = rvaToOffset(originalThunkRva || firstThunkRva);
        const functions: ({ name: string; hint: number } | { ordinal: number })[] = [];
        const width = is64 ? 8 : 4;
        for (let cursor = thunkOffset, count = 0; count < 65536; cursor += width, count += 1) {
          requireRange(bytes, cursor, width, "import thunk");
          const value = is64 ? view.getBigUint64(cursor, true) : BigInt(u32(view, cursor));
          if (value === 0n) break;
          const ordinalFlag = is64 ? 0x8000000000000000n : 0x80000000n;
          if ((value & ordinalFlag) !== 0n) {
            functions.push({ ordinal: Number(value & 0xffffn) });
          } else {
            const nameOffset = rvaToOffset(Number(value));
            functions.push({ hint: u16(view, nameOffset), name: asciiZ(bytes, nameOffset + 2) });
          }
        }
        imports.push({ dll, functions });
      }
    }
  }

  return {
    format,
    machine,
    architecture: machine === 0x14c ? "x86" : machine === 0x8664 ? "x64" : "unknown",
    timestamp,
    entryPointRva,
    imageBase,
    subsystem,
    characteristics,
    dllCharacteristics,
    sections,
    imports,
  };
}

export interface TextEvidence {
  readonly offset: number;
  readonly encoding: "ascii" | "utf16le";
  readonly value: string;
  readonly terms: readonly string[];
}

export function findTextEvidence(bytes: Uint8Array, terms: readonly string[], minimumLength = 4): TextEvidence[] {
  const needles = terms.map((term) => term.toLowerCase());
  const results: TextEvidence[] = [];
  const add = (offset: number, encoding: "ascii" | "utf16le", value: string): void => {
    const lower = value.toLowerCase();
    const matched = terms.filter((_, index) => {
      const needle = needles[index] ?? "";
      if (needle === "ble") return /(^|[^a-z0-9])ble([^a-z0-9]|$)/iu.test(lower);
      return lower.includes(needle);
    });
    if (matched.length > 0) results.push({ offset, encoding, value, terms: matched });
  };
  for (let index = 0; index < bytes.length;) {
    let end = index;
    while (end < bytes.length && bytes[end]! >= 0x20 && bytes[end]! <= 0x7e) end += 1;
    if (end - index >= minimumLength) add(index, "ascii", Buffer.from(bytes.subarray(index, end)).toString("ascii"));
    index = Math.max(end, index + 1);
  }
  for (let index = 0; index + 1 < bytes.length;) {
    let end = index;
    while (end + 1 < bytes.length && bytes[end]! >= 0x20 && bytes[end]! <= 0x7e && bytes[end + 1] === 0) end += 2;
    if ((end - index) / 2 >= minimumLength) add(index, "utf16le", Buffer.from(bytes.subarray(index, end)).toString("utf16le"));
    index = Math.max(end, index + 2);
  }
  return results;
}

export function findBytePattern(bytes: Uint8Array, pattern: Uint8Array): number[] {
  if (pattern.length === 0) throw new Error("pattern must not be empty");
  const offsets: number[] = [];
  outer: for (let at = 0; at <= bytes.length - pattern.length; at += 1) {
    for (let index = 0; index < pattern.length; index += 1) if (bytes[at + index] !== pattern[index]) continue outer;
    offsets.push(at);
  }
  return offsets;
}
