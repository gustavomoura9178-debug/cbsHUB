# Trabalho ativo e reservas

Data: 05/11/2026 (America/Sao_Paulo). Responsável: Codex/OpenAI.
Branch: `audit/cbshub-v2-2026-11-05`. Base auditada: `5deab40aa1629a975dc72588b658569b21494c23`.

## Registro atual

| Campo | Valor |
| --- | --- |
| ID | AUDIT-001 |
| Responsável | Codex/OpenAI a pedido do mantenedor |
| Objetivo | Auditoria, proteção Git, documentação e setup cloud; sem redesign |
| Branch | audit/cbshub-v2-2026-11-05 |
| Base | 5deab40aa1629a975dc72588b658569b21494c23 |
| Commit de conteúdo | 724abeaec50df76bffecb3dcd5e48a8ad6d163ba |
| Estado | Concluído; aguardando revisão humana da entrega |
| Reserva | docs/PROJECT_AUDIT.md e oito arquivos em docs/development; liberada ao concluir entrega |
| Áreas de produto alteradas | Nenhuma |
| Dependências externas | Publicar/aplicar configuração cloud para reavaliar PeerJS; dispositivos/rede para testes reais |
| Próxima tarefa sugerida | R1/K01 — geração determinística do preload |
| Redesign em execução | Não |

## Como reservar a próxima tarefa

Registrar ID, pessoa/agente, data, branch/base, arquivos exatos, objetivo, critérios de aceite, dependências, estado e evidência de sincronização com o outro mantenedor. Não editar reservas existentes para tomar posse; registrar a transição acordada. Ao finalizar, registrar commit, resultados reais e pendências no ACTIVITY_LOG e AI_HANDOFF e liberar a reserva.

Áreas com alto risco de conflito: `webrtcEngine.ts`, `useHubStore.ts`, `cbshub.d.ts`, `App.tsx`, `index.css`, `vite.config.ts`, package/lock e estes documentos. Evitar duas tarefas ativas nesses arquivos. Nenhuma pessoa B foi designada automaticamente.

## REDESIGN-001 — em execução

- Data: 05/11/2026; responsável: Codex/OpenAI, por solicitação explícita do mantenedor após AUDIT-001.
- Branch: `feat/workspace-redesign-2026-11-05`; base: tag `recovery/pre-redesign-2026-11-05`.
- Reserva: componentes de interface, App, index.css, index.html, hook local de layout e documentação compartilhada. Motores, contratos de rede, store, manifests e lockfile ficam fora deste escopo.
- Objetivo: shell/nav, sidebar redimensionável/recolhível, membros opcionais, chat, controles e telemetria, mantendo shadcn/ui/Tailwind.
- Autorização: o pedido atual permite executar R5 com regressões locais, antecipando o gate proposto no roadmap. A matriz multipar R3 continua pendente; não será declarada aprovada.
- Conferência concorrente: remoto segue somente main em 5deab40; sem alterações externas no checkout. Último commit da outra IA em áudio/SDP foi revisado e será preservado. Trabalho não publicado fora deste checkout não é visível.
- Aceite: build, smoke local de chat/Soundboard, resize/collapse/membros/menus, teclados e viewports; sem personalização de temas nesta etapa.

## Encerramento — REDESIGN-001

Implementação concluída para revisão. Commit de conteúdo: REDESIGN_CONTENT_COMMIT. Reserva liberada. Componentes e testes descritos em REDESIGN_REVIEW.md. R3 continua não executado. Sem tarefa de personalização ativa.
