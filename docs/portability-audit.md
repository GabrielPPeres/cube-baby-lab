# Auditoria de portabilidade — Fases 1–3

Data: 2026-11-13
Intenção: `AUDIT_ANALYSIS`
Escopo: conteúdo próprio de `cube-baby-lab`, sem modificar ou incorporar os repositórios externos.

## Resultado

O projeto pode ser clonado e executar os 32 testes sem `Tonehub/`, `tonehub-app/`, CubeSuite,
hardware ou instalação de pacotes npm. A dependência original nas capturas do `Tonehub` foi
removida copiando as 18 fixtures JSONL permitidas para `lab/fixtures/captures/`, com origem,
commit e licença registrados em `THIRD_PARTY_NOTICES.md`.

Validação final: os arquivos já selecionados no índice Git foram exportados para uma pasta
temporária limpa e `npm.cmd test` aprovou 26 testes do laboratório e 6 da Fase 3. Assim, o teste
não recebeu acesso acidental aos repositórios externos ou aos binários ignorados.

## Conteúdo versionável

| Área | Estado | Observação |
| --- | --- | --- |
| `lab/src`, `lab/app`, `lab/test`, scripts | incluir | código próprio e testes offline |
| `lab/fixtures/captures` | incluir | 18 capturas, 96.792 bytes, origem MIT documentada |
| `phase3/src`, scripts e testes | incluir | ferramentas estáticas/passivas próprias |
| `phase3/analysis` | incluir | hashes, metadados e relatórios; sem payload proprietário |
| `docs/`, `CHANGES.md` | incluir | documentação das três fases |
| `README.md`, `.gitignore`, notices | incluir | bootstrap e governança de migração |

## Exclusões obrigatórias

| Caminho/tipo | Motivo |
| --- | --- |
| `Tonehub/`, `tonehub-app/` | repositórios Git externos independentes |
| `phase3/artifacts/`, `phase3/extracted/` | ZIP, EXE, DLLs e recursos proprietários |
| `lab/dist/` | build regenerável |
| `node_modules`, caches e coverage | derivados locais |
| `.env`, credenciais e chaves | material sensível |
| snapshots REA/Ghidra/IDA | derivados potencialmente grandes/proprietários |

Os arquivos locais excluídos não foram apagados. Devem permanecer no backup offline integral.

## Dependências externas registradas

- `Tonehub`: `https://github.com/MrGariZack/cubecontrol.git`, commit
  `5dc17c7e4edb48a027c1bbfbeb994cb0e4564d97`.
- `tonehub-app`: `https://github.com/MrGariZack/cubecontrol-app.git`, commit
  `94bb0d11d4433c0e7747fa468949a49a8cadfd2a`.
- CubeSuite: página `https://www.cuvave.com/appdownload`; ZIP SHA-256
  `d9a1add312ae3fa82f93fefd32a723e541536dd7ed9b2434db364fe8c5a17423`.
- Runtime: Node.js 24+; nenhuma dependência npm declarada.

## Caminhos absolutos

O único caminho absoluto operacional encontrado estava no README do laboratório e foi substituído
por instruções relativas ao clone. Strings Windows dentro de `phase3/analysis/inventory.json` são
evidência extraída do CubeSuite, não caminhos usados pelo código. URLs `127.0.0.1` são endpoints
locais intencionais do servidor do laboratório.

## Testes e artefatos ignorados

- `npm test` na raiz executa 26 testes do laboratório e 6 da Fase 3.
- `npm run captures` usa somente `lab/fixtures/captures/`.
- `phase3:inventory` é opcional e exige a extração ignorada do pacote oficial.
- o diagnóstico Bluetooth passivo depende de Windows/PowerShell, mas não faz parte de `npm test`.

## Riscos residuais

1. Node anterior ao suporte de type stripping pode não executar os `.ts` diretamente.
2. O link oficial do CubeSuite pode mudar; o hash identifica o pacote efetivamente analisado.
3. Os inventários estáticos podem ser regenerados somente com o binário excluído ou seu backup.
4. A análise profunda do REA exige configurar Ghidra/IDA em uma futura máquina.

## Evidência e confiança

- **Alta:** caminhos dos testes, fixtures locais, hashes, commits externos e execução das suítes.
- **Alta:** regras de exclusão conferidas contra o conteúdo local.
- **Média:** ausência de credenciais, baseada em varredura textual; segredos binários fora do escopo
  versionável continuam protegidos pela exclusão integral dos diretórios proprietários.
