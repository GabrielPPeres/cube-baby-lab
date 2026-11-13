# CubeSuite Windows static analysis

This directory contains analysis code, inventories, hashes, and reports. Proprietary vendor
binaries are downloaded into `phase3/artifacts/` and extracted into `phase3/extracted/` for local
inspection; both locations are ignored and must not be published or redistributed.

Requirements: Node.js 24+. From `phase3/`:

```powershell
npm.cmd test
npm.cmd run inventory
npm.cmd run bluetooth:passive
```

`inventory` only reads the extracted package and writes hashes/metadata to `analysis/`.
`bluetooth:passive` only lists Bluetooth PnP devices already known to Windows. It does not scan the
radio, pair, connect, enumerate GATT/SDP, or transmit data.

Reports:

- [`docs/cubesuite-phase3-report.md`](../docs/cubesuite-phase3-report.md)
- [`analysis/function-map.md`](analysis/function-map.md)
- [`docs/cubesuite-phase3-physical-validation.md`](../docs/cubesuite-phase3-physical-validation.md)
