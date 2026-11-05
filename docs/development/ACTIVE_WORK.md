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

Implementação concluída para revisão. Commit de conteúdo: a29e4ca. Reserva liberada. Componentes e testes descritos em REDESIGN_REVIEW.md. R3 continua não executado. Sem tarefa de personalização ativa.

## STUDIO-001 — em execução

05/11/2026 · Codex/OpenAI · feat/cbshub-studio-2026-11-05 · base 08f0c51.
Preflight: redesign integrado pelo PR #1; main remota revisada e incorporada por fast-forward, sem mudanças concorrentes adicionais. Reserva: src/studio, integração visual App/main/rail/layout/CSS, testes e docs. Objetivo: temas/presets seguros, preview, persistência, import/export e acessibilidade. Motores de comunicação e perfis fora do escopo. Recuperação: recovery/pre-studio-2026-11-05.


## Atualização — STUDIO-001 — 05/11/2026

STUDIO-001 concluído para revisão; reserva liberada. Commit 19d316f; base 08f0c51. Componentes, testes e limites em STUDIO.md. Sem perfis, push ou merge nesta tarefa.

## PROFILE-001 — em execução

05/11/2026 · Codex/OpenAI · feat/user-profiles-2026-11-05 · base 03217b8 (Studio integrado pelo PR #2). Checkout limpo; main incorporada por fast-forward. Reserva: src/profiles, pontos de presença/permissões no motor, contrato aditivo, avatares/cartões/editor e documentação/testes. Sem alteração de autenticação (não há autenticação de contas no repositório). Backend global e unicidade de nomes dependem de infraestrutura ainda inexistente; implementar limites locais/P2P explicitamente, sem alegar autorização de servidor.


## Atualização — PROFILE-001 — 05/11/2026

PROFILE-001 concluído para revisão; reserva liberada. Branch feat/user-profiles-2026-11-05; base 03217b8; commit 7a88783. Escopo local/P2P aprovado pelo mantenedor, backend depois. Ver PROFILES.md.

## CHAT-002 — em execução

05/11/2026 · Codex/OpenAI · feat/chat-v2-2026-11-05 · base 206dc46 (perfis integrados pelo PR #3). Checkout limpo; main incorporada por fast-forward. Reserva: módulos chat, componente TextChatSection, persistência/protocolo de mensagens, gates do motor e testes/docs. Preservar áudio/vídeo/Soundboard/Studio/perfis. Backend segue inexistente conforme escopo local/P2P aprovado; não alegar autorização de servidor. Recuperação recovery/pre-chat-v2-2026-11-05.


## Atualização — CHAT-002 — 05/11/2026

CHAT-002 concluído para revisão; reserva liberada. feat/chat-v2-2026-11-05, base 206dc46, commit b74272e. Ver CHAT_2.md. Sem push/merge nesta tarefa.
