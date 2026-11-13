import { exportPresetBackup, importPresetBackup } from "./backup.ts";
import type { OperationLogger } from "./operation-log.ts";
import { bytesToHex, type PresetBank, type PresetParam, type SlotId } from "./presets.ts";
import type { PresetSession } from "./session.ts";

export interface HexRow {
  readonly offset: number;
  readonly hex: string;
  readonly slot: SlotId;
}

export class LabController {
  private readonly session: PresetSession;
  private readonly logger: OperationLogger;
  private currentBank: PresetBank | null = null;
  private currentSlot: SlotId = "A";

  constructor(session: PresetSession, logger: OperationLogger) {
    this.session = session;
    this.logger = logger;
  }

  get slot(): SlotId { return this.currentSlot; }
  get bank(): PresetBank | null { return this.currentBank; }

  async initialize(): Promise<PresetBank> {
    this.currentBank = await this.session.readBank();
    return this.currentBank;
  }

  selectSlot(slot: SlotId): void {
    this.currentSlot = slot;
    this.logger.record({ level: "info", scope: "lab.controller", event: "slot-select", direction: "internal", message: `Selected simulated slot ${slot}` });
  }

  async edit(param: PresetParam, value: number): Promise<PresetBank> {
    const result = await this.session.edit(this.currentSlot, param, value);
    this.currentBank = result.after;
    return result.after;
  }

  async preview(param: PresetParam, value: number): Promise<number> {
    return this.session.preview(this.currentSlot, param, value);
  }

  exportBackup(note?: string): string {
    if (this.currentBank === null) throw new Error("lab bank has not been initialized");
    return exportPresetBackup(this.currentBank, { note });
  }

  async importBackup(json: string): Promise<PresetBank> {
    const parsed = importPresetBackup(json);
    this.currentBank = await this.session.restoreBank(parsed);
    return this.currentBank;
  }

  hexRows(): readonly HexRow[] {
    if (this.currentBank === null) return [];
    return this.currentBank.slots.map((slot, index) => ({
      offset: index * 16,
      hex: bytesToHex(slot.raw).replace(/(..)/g, "$1 ").trim(),
      slot: slot.id,
    }));
  }
}
