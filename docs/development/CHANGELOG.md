# Changelog

## Não lançado — 05/11/2026

Responsável: Codex/OpenAI. Branch `audit/cbshub-v2-2026-11-05`.
Base: `5deab40aa1629a975dc72588b658569b21494c23`. Commit de documentação: `724abeaec50df76bffecb3dcd5e48a8ad6d163ba`.

### Adicionado

- Auditoria técnica de arquitetura, tecnologias, shadcn/ui, estilos, funcionalidades, Git e dependências.
- Oito documentos de desenvolvimento para estado, atividades, mudanças, roadmap, arquitetura, problemas, passagem entre IAs e reserva de tarefas.
- Branch e tag de recuperação locais; backup Git externo verificado.
- Instruções reutilizáveis de instalação e startup headless salvas na configuração cloud, com domínio PeerJS no rascunho.

### Verificado

Build e comportamento local de renderer, chat/IndexedDB, reações, Dialog e Soundboard com sinal sintético. Electron abriu em produção e com helper dev; colisão de outputs do preload no fluxo padrão foi diagnosticada. Npm audit retornou 19 dependências sinalizadas. Detalhes e falhas em ACTIVITY_LOG/PROJECT_AUDIT.

### Limitações

Sem alterações de funcionalidade ou visual; sem substituição/atualização de bibliotecas. Redesign e correções permanecem pendentes de tarefas próprias. Chamadas reais, 4K60, beacon failover e release Windows não foram validados. Documentação anterior preservada. Nenhum release ou push publicado.

## Não lançado — REDESIGN-001 — 05/11/2026

Codex/OpenAI · feat/workspace-redesign-2026-11-05 · a29e4ca. Novo workspace, sidebar ajustável/recolhível, membros opcionais, chat refinado, menus/foco, controle de voz identificado e diagnóstico organizado. Tokens grafite/verde-água e responsividade. Primitivos shadcn/Radix e Tailwind preservados, sem bibliotecas novas. Build e regressões locais passaram; mídia entre máquinas pendente. Detalhes em REDESIGN_REVIEW.md.


## Atualização — STUDIO-001 — 05/11/2026

STUDIO-001 · Codex/OpenAI · feat/cbshub-studio-2026-11-05 · 19d316f. Adicionados presets/editor/preview/library/JSON v1, imagens raster locais, layout e contraste. Slider com nome no Thumb; foco inicial de Sheet ajustado. Sem dependências novas, perfis ou backend de sincronização. Detalhes e testes em STUDIO.md.


## Atualização — PROFILE-001 — 05/11/2026

PROFILE-001 · Codex/OpenAI · feat/user-profiles-2026-11-05 · 7a88783. Perfis locais completos/editáveis, avatar/banner, status, temas de cartão, privacidade e bloqueios; projeção pública e integração P2P validadas. Sem mudança de autenticação nem dependências. Detalhes/testes/limites em PROFILES.md.


## Atualização — CHAT-002 — 05/11/2026

CHAT-002 · Codex/OpenAI · feat/chat-v2-2026-11-05 · b74272e. Chat com edição/exclusão/resposta/pin, reações idempotentes, Markdown/código/links seguros, drafts, ACK, reconciliação lógica, busca/janela limitada e três modos de eventos Soundboard. Sem dependências novas. Resultados/limites em CHAT_2.md.


## Atualização — MEDIA-001 — 05/11/2026

Controles de mídia com estados/erros e painel expandido; RTT/perda por participante; aquisição sob demanda, encerramento/rollback de capturas, handles separados de câmera/tela e reconexão com backoff. Soundboard com categorias, edição/ordem, favoritos nativos persistentes, preview isolado e preferência de eventos compartilhada com chat. Deafen aplicado às telas e sons ativos. Limite de volume individual corrigido para 100%. Sem dependências novas. Detalhes e limites em MEDIA_EXPERIENCE.md.
