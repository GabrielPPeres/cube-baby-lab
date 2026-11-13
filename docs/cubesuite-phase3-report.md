# CubeSuite Windows — relatório técnico da Fase 3

Data: 2026-11-13
Método: inspeção estática; o CubeSuite não foi executado e nenhum hardware foi acessado.

## Resumo executivo

O pacote oficial analisado é uma aplicação nativa C++/MSVC de 32 bits baseada em Qt 5.15.2. O
executável incorpora RtMidi e importa diretamente 18 funções MIDI de `WINMM.dll`, incluindo
`midiOutLongMsg` e preparação de headers longos. Strings internas citam explicitamente envio de
SysEx pelo backend `MidiOutWinMM`. Isso é evidência independente e forte de que o CubeSuite para
Windows comunica por MIDI SysEx; combinado às capturas USB anteriores, sustenta o modelo atual do
laboratório.

Não foi encontrada evidência estática de controle Bluetooth: o pacote não contém `Qt5Bluetooth`,
não importa APIs Windows Bluetooth, e o executável não contém referências a Bluetooth, GATT, SDP,
RFCOMM, BLE-MIDI ou UUIDs. A ausência não prova que o hardware não tenha outro canal, mas indica
que esta versão do CubeSuite não implementa um backend Bluetooth visível nas superfícies estáticas
inspecionadas.

## 1. Proveniência e integridade

- Origem: link Windows publicado na [página oficial de downloads da M-VAVE/Cuvave](https://www.cuvave.com/appdownload).
- Arquivo local ignorado: `phase3/artifacts/CubeSuite.zip`.
- Tamanho: 14.785.970 bytes.
- SHA-256: `d9a1add312ae3fa82f93fefd32a723e541536dd7ed9b2434db364fe8c5a17423`.
- REA: inventário completo da central directory, 73 nós, 74 ocorrências e zero contradições de
  integridade. A enumeração local reproduzível contém 63 entradas de arquivo e 10 diretórios.
- Extração local ignorada: `phase3/extracted/CubeSuite/CubeSuite/`.

O inventário publicável contém somente nomes, tamanhos, formatos e hashes em
[`phase3/analysis/inventory.md`](../phase3/analysis/inventory.md). Nenhum binário proprietário foi
adicionado ao conjunto de entregáveis versionáveis.

## 2. Executável e tecnologia

`CubeSuite.exe`:

| Propriedade | Valor observado |
| --- | --- |
| Tamanho | 3.945.984 bytes |
| SHA-256 | `0e0183fd6dc1b347534c9ce1e3677ecda2a6ae77fe3da8d6314d43c7c2cfd2e6` |
| Formato | PE32/x86, GUI Windows |
| Image base | `0x00400000` |
| Entry point RVA | `0x0011a03c` |
| Timestamp COFF | 2026-04-22 09:11:40 UTC |
| Assinatura Authenticode | `NotSigned` |
| VersionInfo próprio | ausente |
| Framework | Qt 5.15.2.0, DLLs x86 |
| Runtime/compiler | MSVC (`MSVCP140.dll`, `VCRUNTIME140.dll`) |
| MIDI | RtMidi compilado com backend Windows Multimedia (`WINMM.dll`) |

Seções: `.text` (1.558.016 bytes brutos), `.rdata` (1.922.048), `.data` (28.160), `.rsrc`
(68.608) e `.reloc` (368.128). O REA confirmou três recursos: ícone 128×128, grupo de ícone e
manifesto. O manifesto solicita `asInvoker`, `uiAccess=false` e Common Controls 6.0.

O pacote inclui 22 PE/DLLs x86: Qt Core/Gui/Widgets/Network/Svg, plugins de plataforma,
imageformats/styles, ANGLE e D3DCompiler. As DLLs Qt declaram versão 5.15.2.0. Há também PDFs,
traduções e payloads opacos `.bin`, `.DAT` e `.up`; estes foram somente inventariados/hachados,
não executados, extraídos internamente ou gravados em dispositivo.

## 3. Comunicação encontrada

### Fatos

- `WINMM.dll` é importada diretamente com 18 APIs `midiIn*`/`midiOut*`.
- `midiOutLongMsg`, `midiOutPrepareHeader` e `midiOutUnprepareHeader` suportam mensagens MIDI
  longas; strings RtMidi identificam esse caminho como SysEx.
- Há nomes RTTI `RtMidiIn`, `RtMidiOut`, `MidiInWinMM`, `MidiOutWinMM` e `CUSBPort`.
- Há strings de erro para write, read verification e timeout, além de import/export de presets.
- O pacote oficial descreve conexão do software de PC por cabo USB; a
  [página do produto](https://www.cuvave.com/product?id=cube-baby) descreve Bluetooth para áudio.

### Interpretação controlada

O WinMM não prova fisicamente o barramento USB: ele vê um endpoint MIDI do Windows. Contudo, a
combinação de documentação oficial, capturas USB anteriores e backend WinMM/SysEx do binário
torna USB-MIDI SysEx a explicação confirmada para o Cube Baby original.

As strings `USB Loopback`, `CUSBPort` e as classes de diálogos ajudam a localizar o subsistema,
mas o CubeSuite suporta vários produtos; uma string global isolada não é automaticamente específica
da Cube Baby original.

### Comparação com o protocolo modelado

| Elemento do laboratório | Evidência da Fase 3 | Resultado |
| --- | --- | --- |
| Envelope MIDI SysEx | RtMidi + `midiOutLongMsg` + erros SysEx | compatível e reforçado |
| `0x00 0x59`, tipos `0x11/0x22/0x23` | frames exatos não aparecem contíguos no PE | não confirmado estaticamente; provável construção em runtime |
| banco `memory=5/address=0/length=48` | sequências exatas de identity/read-48 não aparecem contíguas | permanece confirmado pelas capturas, não pelo PE isolado |
| write/ACK/read-back | strings de write, verify e timeout | fluxo geral compatível; estrutura exata vem das capturas |
| A/B/C = 3×16 bytes | UI de presets presente, sem estrutura descompilada | sem nova prova independente |
| preview B/C | sem call graph/descompilação local | hipótese não resolvida nesta fase |

Não é correto usar as muitas ocorrências casuais de bytes `00 59` como prova do magic do protocolo.
Os dois frames completos conhecidos — identity e read-48 — não aparecem como blobs literais, o que
é esperado se forem montados por código.

## 4. Resultado Bluetooth

### Evidência negativa observada

- zero referências textuais a `Bluetooth`, `QBluetooth`, `GATT`, `SDP`, `RFCOMM` ou BLE-MIDI;
- zero `Qt5Bluetooth.dll` no pacote;
- zero imports de APIs Windows Bluetooth;
- zero imports de `QtSerialPort`, Winsock, SetupAPI ou HID no executável principal;
- nenhum UUID candidato encontrado no inventário textual.

### Limites

O executável importa `GetProcAddress`, portanto uma carga dinâmica teoricamente pode ocultar APIs.
Ainda assim, faltam também nomes de DLLs, strings de perfis, UUIDs, UI e dependências Bluetooth.
A conclusão correta é: **não há evidência de backend Bluetooth nesta versão do CubeSuite**. Não é
uma prova universal sobre todas as revisões do pedal ou sobre o firmware do módulo original.

O Qt5Network presente não significa Bluetooth; suas imports são HTTP/reply (`GET`) e não há elo
estático com controle do dispositivo.

## 5. Diagnóstico Bluetooth passivo implementado

`phase3/src/passive-bluetooth.ts` lista, via `Get-PnpDevice`, apenas dispositivos Bluetooth já
conhecidos pelo Windows. O relatório declara explicitamente:

- nenhuma descoberta ativa;
- nenhuma tentativa de conexão ou pareamento;
- nenhuma enumeração GATT/SDP;
- nenhuma transmissão ou escrita.

O diagnóstico é útil como baseline da máquina, não para provar que a Cube Baby anuncia BLE ou
Classic. O comando é `npm.cmd run bluetooth:passive` dentro de `phase3/`; a saída contém IDs locais
e não é salva automaticamente.

## 6. REA e limitações de análise

O REA foi usado no ZIP oficial e no PE. O parser de recursos concluiu toda a árvore do executável.
O provedor de descompilação profunda não estava disponível: Ghidra não configurado, Hopper não
suportado no host Windows, IDA não configurado e Kuna sem suporte PE/configuração. O adapter GNU
objdump também não pôde iniciar no host.

Por isso, a Fase 3 entrega mapa de subsistemas e fronteiras de API, não pseudocódigo nem call graph
de funções internas. O parser PE TypeScript reproduz inventário de seções/imports sem executar o
alvo. Próxima análise estática recomendada: configurar Ghidra 12.1.x no REA e seguir xrefs a
`midiOutLongMsg`, RTTI `CUSBPort` e classes `CCubeBaby*IREditDlg`.

## 7. Testes e reprodutibilidade

Em `phase3/`:

```powershell
npm.cmd test
npm.cmd run inventory
```

Os testes cobrem PE válido/malformado, busca textual/binária com offsets, normalização do inventário
PnP e garantias de que o coletor passivo não pede conexão, pareamento, GATT, SDP ou escrita. A suíte
da Fase 2 é preservada e deve continuar com 26 testes aprovados.

## 8. Conclusões

1. O CubeSuite Windows é nativo Qt/MSVC x86 e usa RtMidi/WinMM para MIDI/SysEx.
2. A análise é coerente com o protocolo USB-MIDI capturado, mas não revela de forma independente
   os endereços do banco nem resolve o preview B/C.
3. Esta distribuição não oferece evidência de controle Bluetooth.
4. O módulo Bluetooth original continua devendo ser tratado como áudio-only até observação de SDP,
   advertising/GATT ou tráfego legítimo que demonstre um canal de dados.
5. Nenhum payload de firmware foi executado, alterado ou enviado ao pedal.
