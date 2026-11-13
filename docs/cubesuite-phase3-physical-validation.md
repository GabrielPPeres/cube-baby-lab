# CubeSuite/Cube Baby — plano de validação física da Fase 3

O plano mantém USB-MIDI e Bluetooth como hipóteses de transporte separadas. Nenhum passo autoriza
reutilizar SysEx USB sobre Bluetooth sem framing observado.

## P0 — baseline sem escrita

1. Identificar unidade, revisão de placa, versão impressa e módulo Bluetooth por fotografias.
2. Calcular e guardar hash do pacote CubeSuite usado.
3. Conectar USB com captura USBPcap/Wireshark e abrir CubeSuite sem alterar controles.
4. Confirmar que a enumeração MIDI do Windows e os nomes de portas coincidem com o caminho WinMM.
5. Fazer leitura/backup de 48 bytes com a ferramenta já validada; não salvar nada no pedal.

Artefatos: inventário USB, portas WinMM, captura pcapng, log do laboratório e backup hashado.

## P1 — confirmar o mapa CubeSuite ↔ protocolo

1. Capturar startup/identity e a leitura do banco.
2. Mover um único parâmetro live reversível no slot A e restaurá-lo.
3. Correlacionar chamadas WinMM com frame SysEx e comparar ao decoder do laboratório.
4. Repetir somente a leitura; nenhuma operação de firmware/IR/erase.

Sucesso: bytes decodificados iguais às fixtures e banco persistente inalterado.

## P2 — resolver preview B/C

1. Registrar banco e áudio baseline.
2. Fazer preview reversível de um parâmetro audível em A, B e C, um por vez.
3. Confirmar endereços candidatos `0x80000000 + slot*0x10 + offset` na captura.
4. Restaurar o valor imediatamente e reler o banco de 48 bytes após cada tentativa.

Parar se o slot errado mudar, houver timeout, ACK inesperado ou divergência no read-back.

## P3 — inventário Bluetooth Classic passivo

1. Realizar inquiry e registrar nome, address/ID, Class of Device e RSSI se disponível.
2. Não parear ou conectar durante a primeira passagem.
3. Se o dispositivo aparecer e houver autorização, enumerar SDP sem abrir canais de dados.
4. Classificar A2DP/AVRCP, SPP/RFCOMM e outros perfis exatamente como anunciados.

Se houver somente perfis de áudio/controle de mídia, encerrar a hipótese de controle Classic para
essa revisão, sem tentar canais RFCOMM arbitrários.

## P4 — inventário BLE/GATT read-only

1. Fazer advertising scan após ciclos documentados de power/pairing; salvar payload bruto.
2. Se BLE existir, conectar apenas para service discovery.
3. Registrar serviços, characteristics, descriptors, propriedades e MTU observados.
4. Não habilitar notifications (isso escreve CCCD) e não escrever characteristics nessa etapa.

Ausência após varreduras reproduzidas em duas plataformas significa “BLE não observado”, não prova
universal de inexistência.

## P5 — somente após canal legítimo demonstrado

Se software legítimo realmente controlar presets via Bluetooth:

1. Capturar uma leitura conhecida em HCI/btsnoop/btmon.
2. Mapear framing, fragmentação, MTU, ordem e resposta/notification.
3. Implementar primeiro apenas identity/read, com UUID/canal vindos da captura.
4. Comparar os 48 bytes lidos por Bluetooth com o backup USB.
5. Só então testar preview reversível; persistência fica para uma sessão posterior com backup novo.

## Operações excluídas

- erase `0x21`;
- gravação/alteração de firmware;
- tentativa em UUID, characteristic ou canal RFCOMM desconhecido;
- upload de IR/ROM como atalho;
- full-bank write sem backup e read-back;
- publicação dos binários oficiais.

## Alternativa se o módulo for exclusivamente de áudio

Manter o Bluetooth original para playback e USB para controle. Se controle sem fio for requisito,
usar um bridge externo removível que atue como USB host e exponha uma API BLE própria. A solução
deve ser descrita como “controle via bridge”, nunca como compatibilidade Bluetooth nativa.
