import { bytesToHex, decodeBank, hexToBankBytes, PRESET_BANK_BYTES, type PresetBank } from "./presets.ts";

export const BACKUP_SCHEMA = "cube-baby-preset-bank-lab-v1" as const;

export interface PresetBackupDocument {
  readonly schema: typeof BACKUP_SCHEMA;
  readonly createdAt: string;
  readonly byteLength: typeof PRESET_BANK_BYTES;
  readonly dataHex: string;
  readonly note?: string;
}

export function exportPresetBackup(bank: PresetBank, options: { createdAt?: string; note?: string } = {}): string {
  const document: PresetBackupDocument = {
    schema: BACKUP_SCHEMA,
    createdAt: options.createdAt ?? new Date().toISOString(),
    byteLength: PRESET_BANK_BYTES,
    dataHex: bytesToHex(bank.raw),
    ...(options.note === undefined ? {} : { note: options.note }),
  };
  return `${JSON.stringify(document, null, 2)}\n`;
}

export function importPresetBackup(json: string): PresetBank {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json) as unknown;
  } catch {
    throw new Error("backup is not valid JSON");
  }
  if (parsed === null || typeof parsed !== "object") throw new Error("backup must be a JSON object");
  const document = parsed as Partial<PresetBackupDocument>;
  if (document.schema !== BACKUP_SCHEMA) throw new Error(`unsupported backup schema: ${String(document.schema)}`);
  if (document.byteLength !== PRESET_BANK_BYTES) throw new Error(`backup byteLength must be ${PRESET_BANK_BYTES}`);
  if (typeof document.createdAt !== "string" || Number.isNaN(Date.parse(document.createdAt))) throw new Error("backup createdAt must be an ISO date");
  if (typeof document.dataHex !== "string") throw new Error("backup dataHex is required");
  return decodeBank(hexToBankBytes(document.dataHex));
}
