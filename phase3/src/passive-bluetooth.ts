import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface WindowsBluetoothDevice {
  readonly status: string | null;
  readonly className: string | null;
  readonly friendlyName: string | null;
  readonly instanceId: string | null;
  readonly problem: number | null;
}

export interface PassiveBluetoothReport {
  readonly schema: "cube-baby-passive-bluetooth-v1";
  readonly collectedAt: string;
  readonly platform: string;
  readonly scope: "windows-pnp-inventory";
  readonly activeDiscoveryPerformed: false;
  readonly connectionAttempted: false;
  readonly serviceQueryPerformed: false;
  readonly devices: readonly WindowsBluetoothDevice[];
  readonly limitations: readonly string[];
}

export type CommandRunner = (file: string, args: readonly string[]) => Promise<{ stdout: string }>;

const defaultCommandRunner: CommandRunner = async (file, args) =>
  execFileAsync(file, [...args], { windowsHide: true, maxBuffer: 4 * 1024 * 1024 }) as Promise<{ stdout: string }>;

const READ_ONLY_SCRIPT = [
  "Get-PnpDevice -Class Bluetooth -PresentOnly:$false",
  "Select-Object Status,Class,FriendlyName,InstanceId,Problem",
  "ConvertTo-Json -Compress",
].join(" | ");

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function normalize(row: Record<string, unknown>): WindowsBluetoothDevice {
  return {
    status: nullableString(row.Status),
    className: nullableString(row.Class),
    friendlyName: nullableString(row.FriendlyName),
    instanceId: nullableString(row.InstanceId),
    problem: typeof row.Problem === "number" ? row.Problem : null,
  };
}

export function parseWindowsPnpJson(stdout: string): WindowsBluetoothDevice[] {
  const trimmed = stdout.trim();
  if (trimmed === "" || trimmed === "null") return [];
  const parsed: unknown = JSON.parse(trimmed);
  const rows = Array.isArray(parsed) ? parsed : [parsed];
  if (!rows.every((row) => typeof row === "object" && row !== null)) throw new Error("unexpected Windows PnP JSON");
  return rows.map((row) => normalize(row as Record<string, unknown>));
}

export async function collectPassiveWindowsBluetooth(
  runner: CommandRunner = defaultCommandRunner,
  now = () => new Date(),
): Promise<PassiveBluetoothReport> {
  if (process.platform !== "win32" && runner === defaultCommandRunner) throw new Error("Windows PnP inventory is only available on Windows");
  const { stdout } = await runner("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", READ_ONLY_SCRIPT]);
  return {
    schema: "cube-baby-passive-bluetooth-v1",
    collectedAt: now().toISOString(),
    platform: process.platform,
    scope: "windows-pnp-inventory",
    activeDiscoveryPerformed: false,
    connectionAttempted: false,
    serviceQueryPerformed: false,
    devices: parseWindowsPnpJson(stdout),
    limitations: [
      "Lists Windows PnP Bluetooth devices already known to the operating system; it is not an active radio scan.",
      "Does not connect, pair, enumerate GATT characteristics, query SDP records, or infer Cube Baby control support.",
      "A missing device is not evidence that the device lacks Bluetooth.",
    ],
  };
}
