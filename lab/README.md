# Cube Baby Bluetooth Research Lab — Fase 2

Bancada TypeScript independente, offline e sem dependências externas. Foi construída a partir das
evidências locais de `Tonehub` e `tonehub-app`, mas não modifica esses repositórios e não realiza
I/O de hardware.

## Requisitos

- Node.js 24 ou versão com `--experimental-strip-types` equivalente.
- Nenhum pacote precisa ser instalado.

No PowerShell deste ambiente, use `npm.cmd` porque a policy pode bloquear `npm.ps1`.

## Testes

```powershell
cd cube-baby-research\lab
npm.cmd test
npm.cmd run captures
```

Os testes cobrem codec, fronteira exata de 48 bytes, A/B/C, preservação dos bytes 13–15,
endereços live por slot, backup/importação, falhas, checksum, timeout, read-back, descoberta
Bluetooth mock e transporte desconectado por padrão.

## Aplicativo de laboratório

```powershell
npm.cmd run app:build
npm.cmd run app:serve
```

Abra `http://127.0.0.1:4173`. Para outra porta:

```powershell
$env:CUBE_LAB_PORT=4180
npm.cmd run app:serve
```

O aplicativo oferece:

- editor simulado de A/B/C;
- exportação/importação do backup `cube-baby-preset-bank-lab-v1`;
- inspeção hexadecimal, com trailing bytes destacados;
- log de operações e erros;
- painel de descoberta Classic/SDP e BLE/GATT em modo mock vazio.

Ele não possui botão de conexão ou transmissão Bluetooth real.

## Organização

```text
src/protocol.ts              codec SysEx observado
src/presets.ts               banco A/B/C e endereços
src/session.ts               read/edit/restore com timeout e read-back
src/backup.ts                backup JSON validado
src/operation-log.ts         logs estruturados
src/bluetooth/types.ts       observações Classic, SDP, BLE e GATT
src/bluetooth/discovery.ts   coordenação de descoberta read-only + mock
src/bluetooth/transport.ts   BluetoothTransport + MockBluetoothTransport
src/transport.ts             USB-MIDI, simulador e gate experimental legado
src/lab-controller.ts        orquestração do laboratório offline
app/                         aplicativo estático em TypeScript compatível com JS
test/                        testes automatizados
fixtures/captures/           capturas JSONL locais usadas nos testes
```

## Fronteira Bluetooth

Classic/SDP e BLE/GATT são modelos separados. Nenhum UUID, characteristic, canal RFCOMM,
BLE-MIDI ou framing da Cube Baby foi codificado. `MockBluetoothTransport` nasce desconectado e
um profile só pode conectar se declarar evidência física; o mock verificado usado nos testes é
explicitamente sintético.

Veja o [plano de experimentos](../docs/bluetooth-phase2-experiment-plan.md) antes de integrar um
adapter de sistema operacional ou aproximar hardware.
