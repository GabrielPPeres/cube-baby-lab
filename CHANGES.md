# Alterações desta análise

Data: 2026-11-13

- Nenhum arquivo foi alterado em `Tonehub/` ou `tonehub-app/`.
- Criado `lab/`, uma bancada TypeScript offline e sem dependências externas.
- Criado `docs/cube-baby-reverse-engineering.md`, relatório técnico e plano de experimentos.

Não foram executadas operações contra hardware, Bluetooth, USB, ROM ou presets reais.

## Fase 2 — 2026-11-13

- Ampliada a bancada em `lab/` com validações de protocolo, timeout e read-back.
- Criados contratos separados para Bluetooth Classic/SDP e BLE/GATT.
- Criados `BluetoothTransport` e `MockBluetoothTransport`, desconectados por padrão.
- Criados backup JSON, controller offline, logs estruturados e aplicativo estático.
- Criados testes de A/B/C, trailing bytes, falhas, descoberta e UI model.
- Criado `docs/bluetooth-phase2-experiment-plan.md`.

Os repositórios `Tonehub/` e `tonehub-app/` permaneceram sem alterações.

## Preparação para migração — 2026-11-13

- Inicializado repositório Git independente na raiz, sem remoto.
- Copiadas 18 capturas JSONL necessárias para `lab/fixtures/captures/`, com licença e commit de
  origem documentados.
- Removidas dependências de teste em caminhos internos de `Tonehub/`.
- Adicionados `.gitignore`, README raiz, comando único para 32 testes e auditoria de portabilidade.
- Validado o índice Git em uma cópia temporária limpa: 32/32 testes aprovados.
- Binários CubeSuite, builds e repositórios externos permaneceram locais e ignorados.
## Fase 3 — 2026-11-13: CubeSuite Windows

- Adicionado `phase3/` independente com parser PE, inventário reprodutível e busca estática de
  evidências de comunicação.
- Inventariado o pacote oficial CubeSuite localmente; binários proprietários permanecem ignorados.
- Confirmado RtMidi/WinMM/SysEx no executável e documentada a ausência de evidência Bluetooth.
- Adicionado diagnóstico Windows Bluetooth estritamente passivo e testes offline.
- Adicionados relatório técnico, mapa de funções/subsistemas e plano de validação física.
- `Tonehub` e `tonehub-app` não foram modificados.
