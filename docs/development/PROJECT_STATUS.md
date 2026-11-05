> Atualização atual: **2.0.0-rc.2 / SECURITY-002**. Leia [SECURITY_UPDATE.md](SECURITY_UPDATE.md). Estados anteriores são históricos.

> Estado atual em 05/11/2026: candidato **2.0.0-rc.1**, estabilização STABILIZE-001. Consulte [STABILIZATION.md](STABILIZATION.md). As seções anteriores abaixo são históricas.

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

## VISUAL-002 — 05/11/2026 — Codex/OpenAI

Branch feat/visual-fixes-2026-11-05, base d046d66 (mídia integrada PR #5). Recuperação recovery/pre-visual-fixes-2026-11-05. Referências recebidas: Clássico preto/compacto/sidebar tradicional e Moderno com navegação e membros; Moderno agora roxo. Preservados shadcn/Radix e Tailwind, sem bibliotecas novas.

Alterações: src/chat/activities.ts separa últimos 50 eventos em memória por sala; webrtcEngine não grava nem envia ChatMessage de reprodução, ignora novos eventos de clientes antigos no recebimento de chat/sync; ChatPanel filtra registros antigos por type sem apagá-los e mostra atividades separadas. Áudio/metadata P2P preservados. Temas Clássico e Moderno Roxo em theme.ts, seleção persistente nas configurações e CSS compacto; temas salvos antigos permanecem até seleção explícita. Sidebar com controles por ícone, participantes no Clássico e remoção local confirmada/recuperável. Remoção local aprovada explicitamente pelo mantenedor; não afeta outros participantes, mensagens ou arquivos. Ao remover sala ativa, captura é encerrada e o app não retorna automaticamente à sala no reinício; entrada explícita libera essa pausa. AlertDialog local composto dos primitivos shadcn/Radix Dialog existentes, role alertdialog e foco inicial em cancelar.

AvatarCrop integra seleção de PNG/JPEG/WebP até 20 MB, verificação de assinatura e decodificação, limites de 40 MP/10000 px por lado após decodificar, enquadramento quadrado com zoom e eixos, saída 512px WebP com redução automática de qualidade até limite existente de 100000 caracteres. Bitmap/URL liberados. Banner mantém processamento anterior (2 MB). Sem upload remoto ou validação de backend: infraestrutura segue ausente conforme autorização local/P2P. Decodificação depende do navegador; não há medição de pico de memória ou teste EXIF em celulares físicos.

Testes executados: npm run build e tsc passaram (avisos de bundle e preload permanecem); theme-validation 8 grupos, visual-fixes (temas/persistência/sem registros Soundboard/remoção local após reload), profile-smoke (inclui recorte/persistência), media-engine (WebAudio real sintético e adapters), studio-smoke, redesign-smoke, chat-smoke, chat-drafts e chat-model passaram. Testes atualizados para novos presets/recorte e ausência de eventos na conversa; ambiguidades de seletores corrigidas. Tentativas iniciais falharam por índices de preset/expectativa de cor e dupla submissão do recorte; corrigidas e reexecutadas.

Pendências: validação visual fina contra as capturas, acessibilidade completa, imagens de celulares com EXIF e memória sob carga; chamadas, som e tela entre dois dispositivos físicos continuam NÃO testados nesta instância (ICE/rede cloud já bloqueados na fase anterior). Não declarar reprodução remota, captura real do SO, exclusão global ou autorização no servidor como aprovadas. Exclusão global depende de backend autenticado e política de retenção. Documentação de fases anteriores é histórica: modos normal/compacto não recolocam eventos no histórico nesta fase. Atividades transitórias não persistem; eventos antigos permanecem intactos no banco. Reserva liberada para revisão ao concluir. Nenhum push/merge nesta tarefa.


## STABILIZE-001 — 05/11/2026

Candidato de revisão 2.0.0-rc.1, base 89dc1bb. Todos os testes disponíveis executados: 14 aprovados, media-transport bloqueado por ICE. Electron produção/reload e pacote Linux testados headless. 19 vulnerabilidades de dependências continuam. Arquivos/pastas/GIFs compartilhados e autenticação de contas ausentes. Chamadas entre usuários reais e Windows não aprovados. Ver STABILIZATION.md para matriz completa.


## SECURITY-002 — 05/11/2026

Candidato atual 2.0.0-rc.2: dependências atualizadas e npm audit sem ocorrências conhecidas; CSP/capacidades Electron e presença P2P validadas. Suite: 15 aprovados, media-transport bloqueado por ICE. Pacote Linux e interface/CSP/mic sintético testados. Não aprovado para produção. Backend próprio foi proposto para revisão; contas/sync/global rooms/arquivos/pastas/GIFs permanecem não implementados.


## BRAND-001 — 05/11/2026 — Codex/OpenAI

Branch feat/compact-bars-logo-2026-11-05, base cb7b93f. Barras compactadas (32px titlebar, 60/56px sala, ~32px chamada); subtítulo removido e estado de maximização sincronizado com Electron. Build e testes compact-bars/window-controls/desktop-security/electron-smoke/redesign-smoke/media-smoke passaram localmente. Arraste e aparência real maximizada/restaurada exigem desktop gráfico. Logo/PNG/ICO ainda pendentes do arquivo original solicitado: tentativa generativa alterou arte e não foi integrada. Ler COMPACT_BARS.md para arquivos, evidências e retomada. Trabalho das barras pronto para revisão; não declarar integração da logo concluída. Reserva da identidade permanece aguardando entrada, sem mudanças de motores/backend. Sem push/merge.


## BRAND-002 — 05/11/2026 — Codex/OpenAI

Branch feat/official-logo-2026-11-05, base 9b58863. SVG oficial recebido e preservado byte a byte; fundo já transparente, branco central faz parte da arte. Exportados nove PNGs e ICO multiresolução; integrados à titlebar/rail, BrowserWindow e builder Windows/Linux. Build, official-logo, compact-bars, window-controls, electron-smoke e empacotamento Linux passaram localmente; logo também carregou no executável Linux. Windows/tray/arraste físico não aprovados. Detalhes/arquivos em OFFICIAL_LOGO.md. Pendência de arquivo de BRAND-001 resolvida; reserva liberada ao concluir revisão local. Sem push/merge nesta etapa.
