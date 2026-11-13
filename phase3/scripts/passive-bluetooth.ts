import { collectPassiveWindowsBluetooth } from "../src/passive-bluetooth.ts";

const report = await collectPassiveWindowsBluetooth();
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
