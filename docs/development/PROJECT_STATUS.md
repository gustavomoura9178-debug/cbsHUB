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
