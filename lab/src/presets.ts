export const PRESET_MEMORY = 5;
export const PRESET_BANK_ADDRESS = 0;
export const PRESET_SLOT_BYTES = 16;
export const PRESET_BANK_BYTES = 48;
export const LIVE_BASE_ADDRESS = 0x80000000;

export const PARAM_OFFSETS = {
  type: 0,
  gain: 1,
  tone: 2,
  reverb: 3,
  feedback: 4,
  volume: 5,
  time: 6,
  mix: 7,
  modulation: 8,
  cabinet: 9,
  irSection: 10,
  delaySection: 11,
  toneSection: 12,
} as const;

export type PresetParam = keyof typeof PARAM_OFFSETS;
export type SlotId = "A" | "B" | "C";
export interface PresetSlot { id: SlotId; values: Readonly<Record<PresetParam, number>>; trailing: readonly [number, number, number]; raw: Uint8Array }
export interface PresetBank { slots: readonly [PresetSlot, PresetSlot, PresetSlot]; raw: Uint8Array }

const SLOT_IDS: readonly SlotId[] = ["A", "B", "C"];

export function slotIndexOf(slot: SlotId): number {
  const index = SLOT_IDS.indexOf(slot);
  if (index < 0) throw new Error(`unknown preset slot: ${String(slot)}`);
  return index;
}

export function decodeBank(raw: Uint8Array): PresetBank {
  if (raw.length !== PRESET_BANK_BYTES) throw new Error(`expected ${PRESET_BANK_BYTES} bank bytes`);
  const slots = SLOT_IDS.map((id, slotIndex) => {
    const bytes = raw.slice(slotIndex * PRESET_SLOT_BYTES, (slotIndex + 1) * PRESET_SLOT_BYTES);
    const values = Object.fromEntries(Object.entries(PARAM_OFFSETS).map(([name, offset]) => [name, bytes[offset] ?? 0])) as Record<PresetParam, number>;
    return { id, values, trailing: [bytes[13] ?? 0, bytes[14] ?? 0, bytes[15] ?? 0] as const, raw: bytes };
  }) as [PresetSlot, PresetSlot, PresetSlot];
  return { slots, raw: raw.slice() };
}

export function patchBank(bank: PresetBank, slot: SlotId, param: PresetParam, value: number): PresetBank {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) throw new Error("preset value must be one byte");
  const slotIndex = slotIndexOf(slot);
  const next = bank.raw.slice();
  next[slotIndex * PRESET_SLOT_BYTES + PARAM_OFFSETS[param]] = value;
  return decodeBank(next);
}

export function liveAddress(slot: SlotId, param: PresetParam): number {
  return LIVE_BASE_ADDRESS + slotIndexOf(slot) * PRESET_SLOT_BYTES + PARAM_OFFSETS[param];
}

export function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function hexToBankBytes(hex: string): Uint8Array {
  const normalized = hex.replace(/\s+/g, "").toLowerCase();
  if (!/^[0-9a-f]{96}$/.test(normalized)) throw new Error("preset bank hex must contain exactly 96 hexadecimal characters");
  return Uint8Array.from(normalized.match(/.{2}/g)?.map((pair) => Number.parseInt(pair, 16)) ?? []);
}
