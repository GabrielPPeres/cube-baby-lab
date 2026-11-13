export const SLOT_IDS = ["A", "B", "C"];
export const PARAMS = [
  ["type", "Drive type", 8],
  ["gain", "Gain", 7],
  ["tone", "Tone", 15],
  ["reverb", "Reverb", 15],
  ["feedback", "Feedback", 127],
  ["volume", "Volume", 127],
  ["time", "Delay time", 31],
  ["mix", "Mix", 118],
  ["modulation", "Modulation", 15],
  ["cabinet", "Cabinet", 8],
  ["irSection", "IR / Reverb", 1],
  ["delaySection", "Mod / Delay", 1],
  ["toneSection", "Amp / Tone", 1],
];
export const CAPTURED_BANK_HEX = "05030306056405070808010101000000050304064173185008080101010000000600030a59440b0a0805010101000000";
export const BACKUP_SCHEMA = "cube-baby-preset-bank-lab-v1";

export function fromHex(hex) {
  const normalized = hex.replace(/\s+/g, "").toLowerCase();
  if (!/^[0-9a-f]{96}$/.test(normalized)) throw new Error("O banco deve conter exatamente 48 bytes / 96 caracteres hex.");
  return Uint8Array.from(normalized.match(/.{2}/g).map((pair) => Number.parseInt(pair, 16)));
}

export function toHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function readSlot(bytes, slotIndex) {
  const start = slotIndex * 16;
  return {
    values: Object.fromEntries(PARAMS.map(([name], offset) => [name, bytes[start + offset]])),
    trailing: [...bytes.slice(start + 13, start + 16)],
  };
}

export function editByte(bytes, slotIndex, paramIndex, value) {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 2) throw new Error("Slot inválido.");
  if (!Number.isInteger(paramIndex) || paramIndex < 0 || paramIndex > 12) throw new Error("Parâmetro inválido.");
  if (!Number.isInteger(value) || value < 0 || value > 255) throw new Error("Valor deve ser um byte.");
  const copy = bytes.slice();
  copy[slotIndex * 16 + paramIndex] = value;
  return copy;
}

export function exportBackup(bytes, createdAt = new Date().toISOString()) {
  return JSON.stringify({ schema: BACKUP_SCHEMA, createdAt, byteLength: 48, dataHex: toHex(bytes), note: "Exportado pelo laboratório offline" }, null, 2) + "\n";
}

export function importBackup(text) {
  let document;
  try { document = JSON.parse(text); } catch { throw new Error("Backup não é JSON válido."); }
  if (document.schema !== BACKUP_SCHEMA) throw new Error("Schema de backup incompatível.");
  if (document.byteLength !== 48) throw new Error("Backup não contém 48 bytes.");
  return fromHex(document.dataHex ?? "");
}
