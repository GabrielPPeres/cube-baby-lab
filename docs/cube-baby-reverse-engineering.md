# Engenharia reversa da Cuvave/M-VAVE Cube Baby original

Data da análise: 2026-11-13
Escopo: repositórios locais `Tonehub` e `tonehub-app`, incluindo o histórico Git local do
`Tonehub`; nenhuma comunicação com hardware foi realizada.

## Resumo executivo

Há evidência local forte de um protocolo proprietário sobre USB-MIDI SysEx para ler e gravar o
banco completo de presets A/B/C. O banco persistente é uma imagem de 48 bytes em
`memory=0x05`, `address=0x00000000`: três slots contíguos de 16 bytes. Os 13 primeiros bytes de
cada slot são parâmetros conhecidos; os últimos três foram observados como zero e devem ser
preservados, não recriados.

Uma gravação persistente segura é `read 48 -> patch de um byte -> write 48 -> read 48 -> compare`.
O ACK observado em escritas normais contém `00`; portanto, o campo histórico `accepted=false` não
significa falha. Para banco persistente, a confirmação real é a releitura byte a byte. A região
live `0x80000000...` não respondeu a leituras no experimento histórico 022.

Não há evidência de controle Bluetooth nos dois repositórios. O app atual é USB-OTG, remove
explicitamente dispositivos `TYPE_BLUETOOTH` da lista MIDI e não contém GATT, UUIDs ou permissões
Bluetooth. A frase de diagnóstico que chama o Bluetooth da Cube de “A2DP sink” é uma afirmação do
código, não uma captura. Não é válido transportar o SysEx USB pelo Bluetooth sem descobrir e
validar primeiro o perfil do módulo físico.

## 1. Qualidade e origem das evidências

| Nível | Origem | Uso nesta análise |
|---|---|---|
| A — captura atual | `Tonehub/test/fixtures/captures/*.jsonl` | bytes realmente observados em USB |
| A — teste/código atual | codecs, API e testes do `Tonehub` | implementação reproduzível dos bytes |
| B — registro histórico local | commit `37d6ea2`, pasta `research/` removida depois | logs dos experimentos físicos 018–036 |
| C — comentário posterior | commit `ba3f89c`, referências a exp. 037/038 | mapa live por slot B/C; não há fixture 037/038 no checkout |
| D — hipótese | inferência arquitetural ou alegação sem captura | exige experimento físico |

O histórico Git foi apenas lido com `git show`; nenhum arquivo removido foi restaurado. Os únicos
binários no checkout são dois payloads IR (`2052` e `2056` bytes) e um WAV de fixture. Eles são
dados DSP, não executáveis/firmware/APK. Não havia artefato adequado para desassemblagem no REA;
forçar `raw-binary` exigiria inventar arquitetura e endereço de entrada, produzindo evidência
enganosa. Se surgir APK oficial, firmware ou dump do microcontrolador/módulo Bluetooth, o REA
passa a ser indicado.

## 2. Estrutura do SysEx

### Envelope

```text
F0 | PACK_7BIT(00 59 TYPE LEN0 LEN1 LEN2 CONTENT... CHECKSUM) | F7
```

- `00 59`: magic após desempacotar.
- `TYPE`: um byte.
- `LEN0..2`: tamanho de `CONTENT`, unsigned little-endian de 24 bits.
- `CHECKSUM`: `~(sum(CONTENT) mod 256) & 0xff`; cobre somente o conteúdo.
- `PACK_7BIT`: empacotamento contínuo de bits usado pelo CubeSuite, não o esquema MIDI usual de
  agrupar sete MSBs. O encoder precisa completar para `ceil(clearBytes*8/7)` septetos com `00`.
  Sem o padding, alguns quadros decodificam localmente mas o pedal não responde.

### Tipos conhecidos

| Tipo | Direção/uso | Conteúdo claro |
|---:|---|---|
| `0x00` | ACK do dispositivo | `rawValue(1)`; `00` em writes normais, `01` visto em alguns passos IR/register |
| `0x11` | identity request/response | request vazio; resposta contém nome e 8 bytes de metadata |
| `0x12` | startup | semântica desconhecida; um par request/response foi preservado como `unknown` |
| `0x21` | erase | `memory(1) + addressLE32`; fora do escopo de presets e destrutivo |
| `0x22` | WriteMemory | `memory(1) + addressLE32 + lengthLE24 + data[length]` |
| `0x23` | ReadMemory | request sem data; response repete cabeçalho e acrescenta `data[length]` |
| `0x24` | register/DSP write | `memory(1) + addressLE32 + valueLE32` |

A identidade física capturada é `SINCO-CubeBaby` seguida de metadata
`01 13 14 15 16 17 18 19`. O significado desses oito bytes continua desconhecido.

## 3. Banco A/B/C e endereços

### Banco persistente

| Item | Valor | Confiança |
|---|---:|---|
| selector | `0x05` | captura + leitura física histórica |
| base | `0x00000000` | captura + leitura física histórica |
| tamanho | `48` bytes | captura + leitura física histórica |
| slot A | bytes `0x00..0x0f` | confirmado |
| slot B | bytes `0x10..0x1f` | confirmado |
| slot C | bytes `0x20..0x2f` | confirmado |

### Layout de cada slot de 16 bytes

| Offset | Campo | Limite usado pelo código atual |
|---:|---|---:|
| `0` | type/drive | 8 |
| `1` | gain | 7 |
| `2` | tone | 15 |
| `3` | reverb | 15 |
| `4` | feedback | 127 |
| `5` | volume | 127 |
| `6` | delay time | 31 |
| `7` | mix | 118 |
| `8` | modulation | 15; `7/8` são centro/off |
| `9` | cabinet | 8 |
| `10` | IR/reverb section | 1 |
| `11` | modulation/delay section | 1 |
| `12` | amp/tone section | 1 |
| `13..15` | trailing | observados `00 00 00`; preservar como desconhecidos |

Banco físico usado nas fixtures:

```text
A  05 03 03 06 05 64 05 07 08 08 01 01 01 00 00 00
B  05 03 04 06 41 73 18 50 08 08 01 01 01 00 00 00
C  06 00 03 0a 59 44 0b 0a 08 05 01 01 01 00 00 00
```

### Região live

Endereço proposto/implementado:

```text
0x80000000 + slotIndex*0x10 + fieldOffset
slotIndex: A=0, B=1, C=2
```

- Capturas 004–017 confirmam diretamente os offsets `0..12` na banda A
  `0x80000000..0x8000000c`.
- O código posterior registra exp. 037/038 como validação das bandas B/C:
  A `+0x00`, B `+0x10`, C `+0x20`; exemplos `mix B=0x80000017`,
  `mix C=0x80000027`, `feedback C=0x80000024`.
- Não existe fixture 037/038 no checkout nem no histórico rastreado. Assim, B/C têm registro
  histórico no código, mas menos auditabilidade que a banda A.
- O experimento histórico 022 relata timeout ao tentar `ReadMemory` em `0x80000000` e
  `0x80000001`. Trate live como host-write-only até prova contrária.

Não foi identificado um “endereço de selecionar preset”. As capturas 018 e 019 contêm apenas o
startup: nem o dropdown A/B/C do CubeSuite nem os footswitches físicos geraram SysEx. O app atual
implementa seleção lógica carregando os 13 valores do slot para a banda live correspondente; isso
não prova a existência de um comando de recall físico.

## 4. Leitura, gravação e confirmação

### Leitura de banco

```text
Host   0x23: 05 00000000(LE32) 300000(LE24)
Pedal  0x23: mesmo cabeçalho + 48 bytes
```

O cliente atual aceita a resposta somente se checksum, selector, endereço e tamanho coincidirem.
O link serializa transações: o protocolo não traz transaction ID.

### Preview/live write

```text
Host   0x22: 05 addressLE32 010000 value
Pedal  0x00: 00
```

O ACK `00` confirma que houve uma resposta ao quadro; não confirma semanticamente “accepted”. Como
live não é legível, a confirmação física exige observar áudio/comportamento e restaurar o valor.
O banco persistente permanece intacto enquanto não houver write de 48 bytes na base zero.

### Persistência de um preset

Sequência observada no CubeSuite e reproduzida fisicamente pelo ToneHub:

1. ler 48 bytes;
2. preservar os 47 bytes não editados, inclusive trailing;
3. opcionalmente escrever o byte live para audição imediata;
4. escrever a imagem completa de 48 bytes em `memory=5/address=0`;
5. receber ACK válido (normalmente `rawValue=0`);
6. reler 48 bytes e comparar byte a byte; o cliente tem uma segunda tentativa após atraso.

Uma gravação sobrescreve A+B+C, mesmo quando só um byte muda. Backup é obrigatório antes de
experimento persistente.

### Achado de implementação

`CubeBabyClient.saveParam()` calcula corretamente o byte persistente com
`slotIndex*16+offset`, porém seu write live usa `0x80000000+offset`, sem `slotIndex*16`. Para B/C,
isso pode aplicar o preview na banda A antes de salvar o slot correto. As UIs evitam esse caminho
ao montar a imagem e chamar `restoreBank({liveSlotIndex})`, que usa a banda do slot. Recomenda-se
corrigir/testar `saveParam` antes de usá-lo para B/C em hardware.

## 5. Testes, fixtures e capturas existentes

O `Tonehub` contém 16 arquivos de teste TypeScript. Os grupos relevantes cobrem:

- codec 7-bit, envelope, checksum e vetores byte-a-byte capturados;
- assembler de SysEx fragmentado em callbacks/USB transfers;
- banco A/B/C e trailing bytes;
- mapa live e bandas por slot;
- cliente/sessão, serialização e timeouts;
- `FakeCubeBabyTransport`, read/write/ACK e integração de banco;
- backup/restore e toggles de seções.

O `tonehub-app` contém duas suítes próprias; a maior parte do comportamento de hardware é
delegada aos packages do `Tonehub`. O caminho demo usa `FakeCubeBabyTransport`.

Inventário das 19 fixtures atuais: uma captura startup `.json` em nível USB, 18 `.jsonl`
curadas (003, 004, 006–021), dois payloads IR e um WAV. Principais resultados:

- 003: identity; reads `m0@0x2100[20]`, banco `m5@0[48]`, `m0@0x3000[1]`; tipo `0x12` desconhecido.
- 004, 006–017: cada alteração de parâmetro vira write de um byte na banda live A; todos os ACKs
  são `0`.
- 018/019: nenhum write/evento após startup para dropdown ou footswitch A/B/C.
- 020: live volume `0x80000005=100`, write do banco 48, dois ACKs `0`, read-back 48.
- 021: fluxo IR; útil para confirmar as famílias `0x21/0x22/0x23/0x24`, não necessário para presets.

O histórico local acrescenta resultados físicos 022–036: live-read timeout, layout do banco,
write live reversível, save com restauração, backup/restore e smoke test físico do stack.

As dependências dos repositórios originais não estavam instaladas (`node_modules` ausente e
`pnpm` indisponível), então suas suítes não foram reexecutadas. A nova bancada é zero-dependency
e foi executada com o Node 24 local.

## 6. Bluetooth: fatos, hipóteses e lacunas

### Fatos no código local

- O host Android é `MidiManager + USB-OTG` e filtra VID `0x301A`, PID `0x5555`.
- `CubeBabyMidiEngine.toNativePorts()` retorna vazio para `MidiDeviceInfo.TYPE_BLUETOOTH`.
- O manifesto não solicita permissões Bluetooth.
- Não há `BluetoothGatt`, scan BLE, serviço/characteristic UUID, SPP/RFCOMM ou codec Bluetooth.
- Não há pcap Bluetooth, btsnoop, captura GATT, SDP, advertising data ou firmware do módulo.
- O `Tonehub` e seu histórico de pesquisa não contêm menção Bluetooth/BLE.

### Alegação não comprovada

`TunerPathProbe.kt` diz que o Bluetooth da Cube é “playback (A2DP sink)”. Isso é plausível para o
produto, mas o repositório não inclui a observação que sustentou a frase. Classificação: hipótese
forte/afirmação do desenvolvedor, não fato de protocolo.

### Conclusão

Hoje, suporte Bluetooth de controle = **não demonstrado**. Também não foi demonstrado que o módulo
original expõe BLE-MIDI. Mesmo que exponha, fragmentação, timestamps BLE-MIDI, MTU e direção de
notificação precisam ser validados. Se expuser somente A2DP, o módulo original não oferece canal
de controle sem modificação de hardware/firmware.

## 7. Arquitetura TypeScript proposta

```text
PresetService
  ├─ Preset codec/model (48 bytes, patch preservando desconhecidos)
  ├─ ProtocolSession (serialização, match, timeout, checksum, read-back)
  └─ FrameTransport
       ├─ UsbMidiTransport          (SysEx observado, produção)
       ├─ SimulatedTransport        (memória/ACK, offline)
       └─ ExperimentalBluetoothTransport
            └─ BluetoothControlProfile obrigatório e verificado
```

Princípios:

1. `cube-baby-protocol` continua puro e não conhece portas.
2. `ProtocolSession` mantém uma transação por vez, porque não há transaction ID.
3. USB-MIDI usa SysEx diretamente, pois isso foi capturado.
4. Bluetooth possui uma fase separada de descoberta/probe. O transporte só transmite se receber
   um `BluetoothControlProfile` marcado como verificado e acompanhado de `evidenceId`.
5. O profile injeta framing/chunking; não há UUID, BLE-MIDI ou SysEx default.
6. `PresetService.edit()` é read-modify-write-verify; preview live é uma operação distinta.
7. Escritas persistentes exigem backup e confirmação na UI; erase/ROM ficam fora do serviço de
   presets.

A implementação de referência está em `lab/src`: USB-MIDI por adapter, Bluetooth gated e
simulador em memória. Ela é deliberadamente pequena e não toca hardware.

## 8. Testes offline criados

Comando executado:

```powershell
cd lab
npm.cmd test
```

Resultado: **8/8 testes passaram**.

Cobertura nova:

- leitura e decode do banco físico A/B/C;
- edição de Gain no slot B com write de 48 bytes e read-back;
- garantia de que A/C e trailing não são corrompidos;
- preview do Mix C em `0x80000027` sem persistir;
- ACK bruto `0` tratado como resposta válida;
- bloqueio de transmissão Bluetooth sem perfil verificado;
- replay das fixtures 003, 018, 019 e 020.

`npm.cmd run captures` decodifica e resume todas as fixtures `.jsonl` existentes.

## 9. Experimentos que exigem a Cube Baby

### Passivos/read-only primeiro

1. **Inventário Bluetooth clássico e BLE:** registrar nome, endereço, advertising data, serviços,
   characteristics, propriedades, SDP e perfis conectáveis. Não escrever characteristics.
2. **Confirmar A2DP:** verificar se o módulo anuncia apenas Audio Sink/AVRCP ou também BLE/GATT,
   BLE-MIDI ou SPP. Guardar btsnoop/captura HCI.
3. **Identificar o módulo:** com pedal desligado, fotografar placa, marcações e ligações UART/I²S;
   isso decide se há canal serial de controle entre módulo e MCU/DSP.
4. **Firmware/variantes:** registrar revisão da placa, identity metadata e versões comerciais;
   resultados desta unidade podem não generalizar.
5. **Revalidar bandas B/C:** read bank, aplicar um único parâmetro live reversível em B e C,
   observar áudio, restaurar imediatamente e confirmar banco inalterado.

### Somente se um canal Bluetooth de controle aparecer

6. Capturar uma sessão oficial/legítima do app que realmente controle o pedal, se existir.
7. Determinar framing, MTU, ordem, chunking, notifications/indications e correlação.
8. Enviar primeiro identity/read-only usando o framing observado, nunca o SysEx USB por suposição.
9. Comparar o banco lido por Bluetooth com o backup USB de 48 bytes.
10. Testar um live write reversível, com valor inicial conhecido e restauração imediata.

### Persistência — maior risco

11. Fazer backup USB verificado do banco antes de qualquer save Bluetooth.
12. Alterar um único byte de um slot descartável, persistir, reler por USB e restaurar o backup.
13. Repetir em A/B/C para descobrir se o preview live de `saveParam` precisa do deslocamento por
    slot; não usar erase, ROM/IR ou firmware nesse ciclo.

### Critérios de parada

- parar se só houver A2DP/AVRCP e nenhum canal de dados;
- parar diante de write sem ACK/notification esperada;
- parar se read-back divergir do buffer escrito;
- nunca explorar `0x21` erase, IR ROM ou firmware como atalho para presets.

## 10. Lacunas restantes

- semântica de `0x12` e dos oito bytes de identity metadata;
- correlação/erro explícito além de serialização e timeout;
- significado real dos bytes `13..15` em outros firmwares;
- comando host-side de recall físico A/B/C, se existir;
- prova reproduzível das bandas live B/C fora dos comentários 037/038;
- qualquer canal de controle no módulo Bluetooth original.
