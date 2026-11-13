# Cube Baby Research

Pesquisa experimental e bancada offline para engenharia reversa da Cuvave/M-VAVE Cube Baby
original. O repositório preserva os resultados das Fases 1–3 sem incluir o CubeSuite proprietário
nem os repositórios externos usados como fonte histórica.

## Estado atual

- protocolo USB-MIDI SysEx documentado e reproduzido offline;
- banco A/B/C modelado como 48 bytes, com preservação dos bytes desconhecidos 13–15;
- transportes USB-MIDI, Bluetooth experimental bloqueado e simulado;
- aplicativo local para edição, backup e inspeção hexadecimal;
- análise estática do CubeSuite Windows e inventário por hashes;
- diagnóstico Bluetooth Windows estritamente passivo;
- 32 testes automatizados, sem hardware e sem dependências npm externas.

Não existe evidência experimental de controle pelo Bluetooth original. O projeto não presume que
o protocolo USB-MIDI possa ser transportado por BLE, GATT, RFCOMM ou Bluetooth MIDI.

## Requisitos

- Git;
- Node.js 24 ou versão compatível com `--experimental-strip-types`;
- PowerShell somente para o diagnóstico PnP opcional no Windows.

Não é necessário executar `npm install`: os projetos não declaram dependências npm.

## Clone e validação

```powershell
git clone https://github.com/GabrielPPeres/cube-baby-research.git
cd cube-baby-research
npm.cmd test
```

Resultado esperado: **32 testes aprovados** — 26 em `lab/` e 6 em `phase3/`.

Comandos adicionais:

```powershell
npm.cmd run captures
npm.cmd run lab:build
npm.cmd run bluetooth:passive
```

`bluetooth:passive` apenas enumera dispositivos Bluetooth já conhecidos pelo Windows. Não faz scan
de rádio, pareamento, conexão, SDP/GATT ou transmissão.

## Estrutura

```text
lab/                 protocolo, simuladores, app e testes das Fases 1–2
lab/fixtures/        capturas necessárias aos testes e à análise offline
phase3/              parser PE, inventário e diagnóstico Bluetooth passivo
phase3/analysis/     hashes, inventário e mapa estático publicável
docs/                relatórios técnicos e planos de validação física
CHANGES.md           histórico das fases
```

## CubeSuite e inventário opcional

Os testes e relatórios não precisam do CubeSuite. Para regenerar `phase3/analysis/inventory.*`,
obtenha o pacote na [página oficial](https://www.cuvave.com/appdownload), valide o arquivo e mantenha
a extração somente nestes diretórios ignorados:

```text
phase3/artifacts/CubeSuite.zip
phase3/extracted/CubeSuite/CubeSuite/
```

Hashes da análise da Fase 3:

- ZIP: `d9a1add312ae3fa82f93fefd32a723e541536dd7ed9b2434db364fe8c5a17423`;
- `CubeSuite.exe`: `0e0183fd6dc1b347534c9ce1e3677ecda2a6ae77fe3da8d6314d43c7c2cfd2e6`.

Somente então execute `npm.cmd run phase3:inventory`. Nunca adicione os binários oficiais ao Git.

## Repositórios externos

Eles são opcionais para executar os 32 testes, mas preservam o contexto completo da pesquisa:

| Diretório | Origem | Commit analisado |
| --- | --- | --- |
| `Tonehub/` | `https://github.com/MrGariZack/cubecontrol.git` | `5dc17c7e4edb48a027c1bbfbeb994cb0e4564d97` |
| `tonehub-app/` | `https://github.com/MrGariZack/cubecontrol-app.git` | `94bb0d11d4433c0e7747fa468949a49a8cadfd2a` |

Para reproduzir exatamente a inspeção, clone cada projeto no diretório indicado e faça checkout do
commit registrado. Eles são ignorados pelo repositório principal e não devem ser alterados.

## Segurança e materiais excluídos

- nenhuma operação de firmware, erase ou escrita em hardware é executada pelos testes;
- `node_modules`, builds, logs, chaves, `.env`, bancos de desassemblador e binários oficiais são
  ignorados;
- mantenha um backup offline separado de `phase3/artifacts/` e `phase3/extracted/`;
- revise `git diff --cached` antes de qualquer push.

Consulte o [relatório da Fase 3](docs/cubesuite-phase3-report.md), o
[plano Bluetooth](docs/bluetooth-phase2-experiment-plan.md) e a
[auditoria de portabilidade](docs/portability-audit.md).
