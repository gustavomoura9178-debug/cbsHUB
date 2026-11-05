# Estado do projeto

Data: 05/11/2026 (America/Sao_Paulo). Responsável: Codex/OpenAI.
Branch: `audit/cbshub-v2-2026-11-05`. Base auditada: `5deab40aa1629a975dc72588b658569b21494c23`.

**Fase atual: auditoria concluída e colaboração preparada. Redesign visual ainda não iniciado.**

| Eixo | Estado |
| --- | --- |
| Proteção Git | Branch isolada, tag e bundle verificados; sem push |
| Documentação compartilhada | Nove documentos criados; protocolo em AI_HANDOFF/ACTIVE_WORK |
| Instalação cloud | Dependências instaladas com lockfile preservado; workaround de peers/proxy documentado |
| Build TypeScript/Vite/Electron | Passou, com aviso de chunk e colisão de saída preload diagnosticada |
| Renderer e comportamento local | Smoke de chat, IndexedDB, reações, modal e Soundboard passou |
| Electron | Produção e helper dev headless abriram com API; dev padrão apresentou problema de preload |
| Comunicação real entre pares | Não validada; PeerJS bloqueado na rede atual |
| Qualidade de mídia/Windows | Não testada nesta fase |
| Segurança de dependências | 19 dependências reportadas pelo npm audit; atualização depende de tarefa aprovada |
| Redesign | Pronto para planejamento; implementação condicionada ao gate R3 do roadmap |

## Implementado no código

Shell shadcn/Radix, tema dark Tailwind, salas/recentes, presença mesh, chamadas de voz e webcam, compartilhamento com presets/ABR, chat com emojis/reação/digitação, IndexedDB, Soundboard nativo/customizado e IPC de desktop. Existência do código não equivale a aceite funcional multipar.

## Incompleto ou divergente do SDD

VoiceAvatar/speakingLevel/hangover, volume remoto >100%, timer de chamada, toggle responsivo da sidebar, favoritos nativos, propagação imediata da cor, robustez de lifecycle/sync e ABR por par. Detalhes e evidências em KNOWN_ISSUES. PROGRESS.md histórico permanece preservado, mas não é um relatório de testes atuais.

## Configuração salva e pendências externas

Rascunho salvo com `install_script`, `start_skill` e domínio `0.peerjs.com`. Revisar/salvar e publicar nas configurações do ambiente para disponibilizar a versão. Aplicação da política, publicação e restauração em uma nova tarefa ainda não verificadas. Não há bloqueio de credenciais para desenvolvimento local. TURN é opcional e está sem configuração.

Próxima tarefa recomendada: R1, corrigir exclusivamente K01 e validar preload em dev/produção; depois regressões R2/R3. Não há tarefa de implementação ativa nesta entrega.

## Atualização — REDESIGN-001

Redesign implementado a pedido explícito do mantenedor na branch `feat/workspace-redesign-2026-11-05`, para revisão. O gate R3 proposto anteriormente permanece pendente, sem impedir a implementação autorizada. Ver REDESIGN_REVIEW.md e DESIGN_SYSTEM.md. Sem sistema de personalização. Build/regressões locais passaram; chamadas reais não validadas.


## Atualização — STUDIO-001 — 05/11/2026

Studio implementado para revisão: editor de temas, seis presets, preview/cancelamento, biblioteca local, JSON v1 validado, fundos/layout/contraste/movimento reduzido. Ver STUDIO.md. Sincronização automática indisponível por ausência de backend adequado. Sem perfis.


## Atualização — PROFILE-001 — 05/11/2026

Perfis locais/P2P implementados: identidade, cartão rápido/completo, editor/prévia, imagens normalizadas, aparência, privacidade e bloqueio. Backend/autorização de servidor e reserva global de username continuam indisponíveis. Escopo local aprovado explicitamente; PROFILES.md registra garantias e limites.


## Atualização — CHAT-002 — 05/11/2026

Chat 2.0 implementado: operações, ACK, edit/delete/reply/pin/reação, Markdown seguro, links locais, rascunhos, busca, janela limitada e modos Soundboard. Testes locais de dois contextos passaram; backend e sinalização remota não validados. CHAT_2.md registra limites de reconciliação/autoria.


## Atualização — MEDIA-001 — 05/11/2026

MEDIA-001 implementado para revisão em feat/media-experience-2026-11-05, base 6a72051. Melhorias incrementais de controles, dispositivos, qualidade por participante, lifecycle/retries e Soundboard. Build e regressões locais passaram; teste de transporte bloqueado por ausência de candidatos ICE. Dois dispositivos físicos ainda não validados. Ver MEDIA_EXPERIENCE.md. Sem push/merge nesta etapa.
