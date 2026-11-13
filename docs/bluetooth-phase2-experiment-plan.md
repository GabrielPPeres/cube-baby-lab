# Cube Baby Bluetooth Research — plano da Fase 2

Data: 2026-11-13
Estado: software preparado; sem hardware disponível; nenhuma alegação de compatibilidade.

## 1. Evidências confirmadas

- O protocolo de presets observado funciona sobre USB-MIDI SysEx.
- O banco persistente tem exatamente 48 bytes em `memory=5/address=0`: A, B e C têm 16 bytes.
- Campos conhecidos ocupam offsets 0–12; 13–15 são desconhecidos e precisam ser preservados.
- Escrita persistente exige read-modify-write de 48 bytes e read-back.
- ACK bruto `0` é comum e não prova rejeição.
- Capturas 018/019 não mostram tráfego ao selecionar A/B/C no CubeSuite ou nos footswitches.
- O app Android existente usa USB-OTG e exclui `MidiDeviceInfo.TYPE_BLUETOOTH`.
- Não existe captura, UUID, SDP record, GATT inventory ou perfil Bluetooth confirmado da unidade.

## 2. Auditoria do protocolo na Fase 2

### Fronteira de 48 bytes

`decodeBank`, importação de hex, simulator e backup rejeitam qualquer tamanho diferente de 48.
Reads também precisam declarar e entregar 48 bytes. Os encoders rejeitam selector, address e
length fora do domínio.

### Preservação de 13–15

`patchBank()` começa sempre com uma cópia dos 48 bytes e modifica um único offset 0–12. A suíte
testa todos os 39 pares slot/campo usando trailing não-zero diferente em A/B/C.

### A/B/C e hipótese do preview

O endereço live usado pela bancada é:

```text
0x80000000 + slotIndex*16 + fieldOffset
```

Os testes verificam A/B/C, inclusive Mix em `0x80000007`, `0x80000017` e `0x80000027`.

No `Tonehub`, `CubeBabyClient.saveParam()` persiste o byte em
`slotIndex*16+offset`, mas o preview anterior usa somente `LIVE_BASE+offset`. Assim, a hipótese de
bug B/C é sustentada por inspeção estática: o banco correto pode ser salvo enquanto o preview é
endereçado à banda A. Não foi reproduzida fisicamente. A Fase 2 não altera o repositório original;
o laboratório usa `liveAddress(slot,param)` corretamente.

### Falhas

A suíte inclui timeout tipado, resposta curta, checksum corrompido, valor live fora de um byte,
perfil Bluetooth desconectado e write que recebe ACK mas falha no read-back.

## 3. Descoberta Bluetooth preparada

### Bluetooth Classic

O adapter futuro deverá registrar, sem transmissão de protocolo:

- inquiry result, nome, endereço/ID e connectability;
- classes de dispositivo, quando a plataforma expuser;
- SDP service records;
- service class UUIDs;
- protocol descriptor list e parâmetros, incluindo canal apenas se observado;
- atributos SDP brutos em hexadecimal.

SDP não é GATT. A presença de A2DP, AVRCP ou outro perfil de áudio não implica um canal de
controle de presets.

### BLE

O adapter futuro deverá registrar:

- advertising data, nome, RSSI e service UUIDs anunciados;
- manufacturer/service data em hexadecimal;
- após autorização explícita, conexão somente para enumeração;
- serviços GATT primários/secundários;
- characteristics, descriptors e propriedades `read/write/notify/indicate`;
- MTU e comportamento de notifications somente quando a plataforma fornecer observação.

Enumerar uma characteristic gravável não autoriza escrever nela.

### Limitações de plataforma

| Plataforma | BLE/GATT | Classic/SDP | Observação |
|---|---|---|---|
| Web Bluetooth | parcial, sujeito a chooser/permissões | não | inadequado como inventário Classic |
| Android nativo | BLE/GATT | Classic e APIs SDP limitadas/variáveis | melhor candidato móvel, requer permissões por versão |
| Linux/BlueZ | BLE/GATT | Classic/SDP | bom para captura e automação via D-Bus/btmon |
| Windows | BLE/GATT | Classic com APIs distintas | IDs podem ser opacos; SDP exige adapter específico |

O código atual contém contratos, coordinator e mocks; não contém adapters nativos, pois não há
hardware para validar as diferenças de API.

## 4. BluetoothTransport

`BluetoothTransport` possui estados explícitos:

```text
disconnected -> connecting -> connected -> disconnecting -> disconnected
```

- estado inicial obrigatório: `disconnected`;
- `exchangeProtocolFrame()` falha desconectado;
- `connect()` recusa profile sem `verifiedOnCubeBaby=true` e sem `evidenceIds`;
- o profile registra tecnologia e descrição de framing, mas nenhum UUID default;
- logs preservam conexão e frames TX/RX em hex;
- `MockBluetoothTransport` recebe reply handler do teste; não inventa comportamento físico.

O mock verificado da suíte é material sintético para testar a state machine. Não constitui
evidência sobre a Cube Baby.

## 5. Experimentos com a Cube Baby física

Cada etapa deve produzir um artifact versionado com data, unidade, revisão, plataforma, comandos
de captura e hashes. Não avançar se a etapa anterior não trouxer evidência.

### E0 — Identidade e baseline

- fotografar etiquetas, revisão da placa e módulo Bluetooth com o pedal desligado;
- registrar USB identity e metadata;
- fazer backup USB verificado do banco de 48 bytes;
- registrar firmware/software e fonte de alimentação.

Risco: nenhum write.

### E1 — Inquiry Bluetooth Classic

- realizar scan Classic sem parear;
- salvar nome, endereço/ID, class of device e RSSI quando disponível;
- não conectar a serviços.

Critério de sucesso: observation reproduzível em duas varreduras.

### E2 — SDP

- parear apenas se necessário e aprovado;
- enumerar SDP records completos;
- classificar perfis observados, sem inferir canal proprietário;
- procurar SPP/RFCOMM somente como resultado, não como expectativa.

Parar se apenas perfis de áudio/controle de mídia forem anunciados.

### E3 — Advertising BLE

- scan BLE passivo em ao menos duas plataformas, se possível;
- salvar payloads de advertising/scan response;
- distinguir endereço randomizado de identidade estável.

Parar se o dispositivo não anunciar BLE após ciclos documentados de power/pairing.

### E4 — Inventário GATT read-only

- conectar apenas para service discovery;
- registrar serviços, characteristics, descriptors e propriedades;
- habilitar nenhuma notification e escrever nenhum descriptor nesta etapa;
- capturar HCI/btsnoop/btmon para confirmar o que a API ocultar.

### E5 — Classificação do módulo

Com E1–E4, escolher uma conclusão provisória:

1. áudio Classic apenas;
2. BLE presente, mas sem canal de controle identificável;
3. canal de dados candidato, ainda sem framing;
4. perfil de controle demonstrado por tráfego de software legítimo.

Somente a opção 4 permite criar um `BluetoothControlProfile` verificado.

### E6 — Captura de tráfego legítimo

Se existir app ou procedimento conhecido que controle presets:

- capturar HCI/GATT/RFCOMM durante apenas uma leitura/ação conhecida;
- mapear direção, framing, fragmentação, MTU, notification e correlação;
- não reaproveitar SysEx USB por semelhança visual sem replay read-only confirmado.

### E7 — Primeiro comando read-only

- implementar no profile somente o framing capturado;
- tentar identity ou leitura de banco, conforme a evidência;
- comparar os 48 bytes com o backup USB;
- abortar em timeout, resposta inesperada ou qualquer alteração do banco USB.

### E8 — Preview reversível

- escolher um parâmetro audível, registrar baseline e usar valor próximo;
- testar A, restaurar imediatamente e verificar banco persistente inalterado;
- repetir B/C para resolver fisicamente a hipótese do deslocamento `slotIndex*16`;
- não persistir.

### E9 — Persistência controlada

- somente após E7/E8 completos;
- backup USB novo e verificável;
- um byte em slot descartável, full-bank write, read-back via Bluetooth e USB;
- restaurar backup e verificar novamente.

Não usar erase `0x21`, IR/ROM ou firmware em nenhum experimento de presets.

## 6. Critérios de segurança e parada

- nenhum UUID ou serviço é rotulado “Cube Baby control” sem captura;
- nenhuma characteristic desconhecida recebe write;
- ACK sem read-back não confirma persistência;
- timeout, disconnect, alteração inesperada ou resposta malformada encerram a sessão;
- preservar sempre bytes desconhecidos;
- conectar uma tecnologia não autoriza tentar a outra;
- hardware/revisão diferente exige nova evidência.

## 7. Se o módulo original for exclusivamente de áudio

Alternativas, em ordem de menor intervenção:

1. manter Bluetooth original para playback e USB-OTG para controle;
2. usar o laboratório offline para gerenciar backups e conectar USB apenas na sincronização;
3. criar um bridge externo e removível que atue como USB host da Cube e exponha uma API BLE
   própria e documentada; ele não deve se apresentar como suporte Bluetooth nativo do pedal;
4. investigar, com documentação/fotos, se existe UART entre módulo e MCU antes de qualquer tap;
5. substituir/alterar o módulo somente como projeto de hardware separado, com backup e possibilidade
   de reversão.

Um bridge externo é a alternativa de software/hardware mais realista se o rádio original anunciar
somente A2DP/AVRCP. A compatibilidade continuaria sendo “via bridge”, não “Bluetooth original”.
