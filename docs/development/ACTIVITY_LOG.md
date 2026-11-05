# Registro de atividades

## 05/11/2026 — AUDIT-001 — Codex/OpenAI

- Branch: `audit/cbshub-v2-2026-11-05`.
- Base/recuperação: `5deab40aa1629a975dc72588b658569b21494c23`; tag `recovery/pre-audit-2026-11-05`; bundle completo verificado em `/workspace/cbshub-onboarding/pre-audit-2026-11-05.bundle`.
- Git inicial: branch `work`, sem mudanças tracked/untracked; consulta remota mostrou somente main, no mesmo commit. Nenhum push/force push/alteração direta em main.
- Commit de conteúdo da entrega: `724abeaec50df76bffecb3dcd5e48a8ad6d163ba`. Commit posterior de passagem registra esse hash; consultar `git log` para o HEAD final.
- Arquivos criados: `docs/PROJECT_AUDIT.md`; `docs/development/PROJECT_STATUS.md`, `ACTIVITY_LOG.md`, `CHANGELOG.md`, `ROADMAP.md`, `ARCHITECTURE.md`, `KNOWN_ISSUES.md`, `AI_HANDOFF.md`, `ACTIVE_WORK.md`.
- Funcionalidades implementadas: nenhuma. Auditoria/documentação/protocolo e preparação de ambiente; bibliotecas, estilos, chamadas, mensagens e Soundboard não foram editados.
- Setup externo ao Git: dependências ignoradas, builds ignorados, helper dev, install.sh, probes/resultados/perfis e backup em `/workspace/cbshub-onboarding`.

### Testes e diagnósticos executados

| Comando/cenário | Resultado |
| --- | --- |
| git status/branch/log/ls-remote | Base limpa; branches remotas verificadas, sem comparação com PRs não disponíveis |
| git bundle create/verify | Backup íntegro do histórico disponível |
| npm ci | Falhou por resolução de peer dependencies do lockfile |
| npm ci --legacy-peer-deps | Primeira tentativa falhou no download Electron sem proxy; com ELECTRON_GET_USE_PROXY=1 passou (515 pacotes) |
| npm run build | Passou duas vezes; TypeScript/renderer/main/preload; chunk ~610kB e dupla emissão preload observados |
| npm run dev no cloud | Falha do Electron por DISPLAY ausente apesar de exit 0 do comando |
| Electron headless com output dev | Falha de sintaxe ES em preload.cjs reproduzida |
| resolveViteConfig/mergeConfig | Confirma formatos [es,cjs] colidindo no mesmo caminho |
| Smoke Chromium local | 6 grupos funcionais passaram: renderer/8 sons, compositor+persistence, modal Escape, reações, CRUD/favorito custom WAV, mixagem com mic mudo/stopAll |
| Diagnóstico inicial smoke | 2 tentativas expiraram esperando feed offline; mensagem existia no estado/DB. Teste ajustado para observar persistência, sem simular rede conectada |
| Dois probes de defeitos | Favorito nativo inoperante e sendData(peer_state_sync) ignorado reproduzidos |
| Electron produção headless | Renderer e API preload presentes após nova build; title cbsHUB |
| Electron com helper dev | Renderer em Vite e os seis métodos da API presentes |
| node --check preload.cjs | Passou para artefato final de produção desta execução |
| npm audit --json | Exit 1; 19 dependências (1 crítica, 13 altas, 5 moderadas), sem atualização automática |
| curl HTTPS PeerJS | CONNECT 403; bloqueio de rede observado |

Não executados: chamadas entre máquinas, matriz 3–6 pares, beacon failover, mídia física, 4K60/loopback, empacotamento/instalação Windows, auditoria completa de acessibilidade, suite automatizada do repositório (inexistente). Não houve avaliação auditiva dos sinais sintéticos.

Configuração cloud: rascunho confirmado como salvo com install_script, start_skill e domínio 0.peerjs.com; publicação exigida e não executada. Não há segredos novos solicitados. Não há alegação de restauração em nova tarefa.

Pendências para a outra IA: ler KNOWN_ISSUES; começar por K01/R1; preservar contratos/dados; configurar rede para R3; usar ACTIVE_WORK antes de reservar arquivos. Pronto para planejamento visual, ainda sem gate funcional para implementar redesign.

## 05/11/2026 — REDESIGN-001 — Codex/OpenAI

- Branch `feat/workspace-redesign-2026-11-05`; base 2f54c07; tag `recovery/pre-redesign-2026-11-05`; commit UI a29e4ca.
- Solicitado pelo mantenedor após auditoria: redesign por componentes, mantendo stack. Documentos lidos e última alteração da outra IA em áudio/SDP revisada. Remoto permanece main em 5deab40; nenhuma mudança externa visível.
- Arquivos modificados: App, index.css/index.html, componentes de navegação/chat/palco/controles/modais/Soundboard e tokens em button/badge/dropdown-menu; novos WorkspaceRail, MembersPanel, ParticipantAvatar, StreamDiagnostics, Sheet, ResizeHandle e useWorkspaceLayout. Relação detalhada em REDESIGN_REVIEW.md e diff Git.
- Funcionalidades: navegação recolhível/redimensionável, membros opcionais, menus e diagnóstico, compositor/histórico offline, foco/teclado, adaptação móvel e design system. Sem personalização.
- Testes executados: build TypeScript/Vite/Electron passou; seis grupos de regressão local (chat/DB/reação/modal/WAV/mixagem e stopAll) passaram; Electron produção expôs API. Teste de layout passou para resize teclado/limites/persistência, collapse, membros, menus, diagnóstico, mensagem offline, viewports 390/768/1024, Sheets/Escape e ausência de pageerror. Scripts de probes e capturas em /workspace/cbshub-onboarding; teste UI versionado em tests/redesign-smoke.cjs.
- Preservação confirmada por git diff sem mudanças em src/lib, store, tipos, Electron, manifests/lock e build config.
- Pendências: K01 e demais defeitos auditados, testes reais P2P/voz/vídeo/4K60/Windows, CPU/GPU, acessibilidade completa e CI. Nenhum resultado remoto foi simulado.
- Passagem: revisar REDESIGN_REVIEW e DESIGN_SYSTEM; reservar próximos arquivos em ACTIVE_WORK. Sem push ou merge; personalização não iniciada.


## 05/11/2026 — STUDIO-001 — Codex/OpenAI

- Branch feat/cbshub-studio-2026-11-05; base 08f0c51; recuperação recovery/pre-studio-2026-11-05; commit 19d316f.
- Preflight: checkout limpo; main remota atualizada pelo merge PR #1; atualização incorporada via fast-forward antes de editar. Documentos compartilhados e mudanças revisados.
- Arquivos: novos src/studio/theme.ts, StudioProvider.tsx e StudioDialog.tsx; integração em main/App/WorkspaceRail/useWorkspaceLayout/index.css; ajustes de acessibilidade ui/slider e ui/sheet. Novos tests/theme-validation.cjs e studio-smoke.cjs, teste de redesign formatado e sincronizado com foco; docs/themes/dark-modern.cbshub.json; STUDIO.md e documentos de desenvolvimento atualizados.
- Funcionalidades: seis presets, editor visual, preview/cancel/save, biblioteca até 20, duplicar/renomear/excluir/importar/exportar, JSON versionado validado, fundos sólidos/gradientes/raster, layout, contraste e movimento reduzido. Persistência local, sem perfis ou sync remoto fictício.
- Testes: build passou; 8 grupos de validação/segurança passaram; smoke Studio passou (prévia, rollback, save/reload, CRUD/export/import, HEX, raster/gradiente, largura/reduced motion, defaults/móvel/Escape). Regressão de redesign passou após correção de foco inicial da gaveta. Core smoke passou: compositor/persistência/reação/modal/WAV/mixagem com mic mudo/stopAll; Electron API disponível.
- Falhas investigadas: slider sem nome acessível no Thumb, corrigido; Escape consumido por tooltip autoaberto no foco da gaveta, corrigido focando o painel inicialmente. Tentativas falhas não registradas como passes.
- Preservação: motores src/lib, store/tipos de comunicação, Electron, manifest/lock e config build sem mudanças.
- Pendências: revisão humana das paletas/contraste, testes reais multipar e Windows, CI, quota local, ausência de backend de sincronização e defeitos K01 etc. Ver STUDIO.md. Nenhuma validação de chamadas reais alegada.
- Passagem: não avançar para perfis. Mudanças prontas para revisão na branch de Studio; sem push/merge nesta tarefa.


## 05/11/2026 — PROFILE-001 — Codex/OpenAI

- Branch feat/user-profiles-2026-11-05; base 03217b8; recuperação recovery/pre-profiles-2026-11-05; commit 7a88783.
- Preflight: docs/modelos revisados, main com merge do PR #2 incorporada por fast-forward. Sem alterações locais preexistentes. Mantenedor confirmou continuar local/P2P e backend depois.
- Arquivos: src/profiles/{model,repository,ProfileProvider,ProfileDialog}; main/App; ParticipantAvatar, MembersPanel, LeftSidebar, SettingsModal, UserCallCard, TextChatSection, WorkspaceRail e index.css; contrato cbshub.d.ts e integrações/gates em webrtcEngine; testes profile-validation/profile-smoke; README de testes e docs compartilhadas.
- Implementado: identidade/username/bio/status/emoji/links/data local; imagens validadas e normalizadas; aparência de cartão; visão rápida/completa e editor com preview/save/cancel; privacidade por projeção pública, bloqueio local persistente e permissões de chamadas/reações.
- Testes executados: build passou; 7 grupos de validação passaram; edição/raster/persistência/reload/cancel e visão por outro contexto via handler real/ponte local passaram; bloqueio de mensagem/mídia persistiu; chamadas/reações negadas em sessão conhecida passaram; móvel passou. Studio e redesign smoke passaram; core de chat/DB/modal/reação/WAV/mixagem/stopAll e API Electron passou.
- Não executados: transporte remoto real/ICE, autorização de servidor, unicidade global, testes Windows/hardware e acessibilidade completa. Sem credenciais/backend inventados.
- Pendências e passagem: revisão multipar, definição futura de backend; preservar filtro de campos privados e associação à sessão. Dados já enviados não são revogáveis. Ver PROFILES.md. Sem push, merge ou alteração de main nesta tarefa.


## 05/11/2026 — CHAT-002 — Codex/OpenAI

- Branch feat/chat-v2-2026-11-05; base 206dc46; tag recovery/pre-chat-v2-2026-11-05; commit b74272e.
- Preflight: checkout limpo, docs/fluxo de mensagens revisados; main atualizada com PR #3 por fast-forward. Escopo P2P anterior preservado, backend não criado.
- Arquivos: novos módulos src/chat/model, ledger, ChatPanel, MessageRow, SafeMarkdown; wrapper TextChatSection; protocolo cbshub.d.ts; handlers e métodos de chat no webrtcEngine; persistência/ordem em storageDb e useHubStore; CSS. Testes chat-model/chat-smoke/chat-drafts, readiness do probe de perfis, README de testes e documentação compartilhada.
- Funcionalidades: edição/exclusão/resposta/pin, reação set/unset, menção/digitação/não lidas, copy/context menus, Markdown/código/link local seguro, rascunhos por sala, estados de persistência/ACK/erro, busca e janela de 100/retention500. Soundboard normal/compacto/atividade sem remover áudio.
- Testes reais executados: 7 grupos de modelo; smoke de dois contextos via ponte local (envio/ACK, edição, exclusão persistente, reação/replay, resposta/pin e reconexão lógica); drafts/erro de disco/retry/retention/não lidas; Studio/perfis/navegação/core passaram. Build validado. Sem alegar teste de ICE/internet, backend, Windows ou seis participantes reais.
- Falhas investigadas: singleton duplicado por HMR nos probes, preparação de fixture de perfil antes de readiness e comparador tipado de clip; preparação/tipagem corrigidas, não registradas como passes antes da correção.
- Preservação: Electron, áudio, SoundboardEngine, Studio/perfis e dependências sem alteração funcional; alterações do motor focadas em mensagens.
- Pendências: backend/ACL, histórico de ator ausente, clientes antigos, limites/quota de journal e K01. Ver CHAT_2.md antes de integrar. Sem push ou merge.


## Atualização — MEDIA-001 — 05/11/2026

Data: 05/11/2026, 06:40 America/Sao_Paulo (horário aproximado de fechamento). Responsável: Codex/OpenAI, a pedido do mantenedor. Tarefa MEDIA-001, branch feat/media-experience-2026-11-05, base 6a72051. Preflight: árvore limpa e Chat 2 integrado pelo PR #4; recuperação recovery/pre-media-experience-2026-11-05; sem alterações externas adicionais encontradas.

Implementado: controles/qualidade/erros, seleção e rollback de dispositivos, captura sob demanda/cancelamento, separação dos canais de câmera/tela, retries e teardown, otimização das atualizações de fala; Soundboard com categorias/edição/ordenação, favoritos nativos persistentes, preview isolado, deafen e preferência de eventos comum ao chat. Arquivos modificados e fronteiras listados em MEDIA_EXPERIENCE.md; também atualizados os documentos compartilhados e tests/README.md. Primitivos shadcn/Tailwind, stack e conteúdo acústico preservados.

Testes executados: npm run build passou (avisos preexistentes de bundle/preload); media-smoke e media-engine passaram com captura sintética/adapters; chat-model 7 grupos, theme-validation 8, profile-validation 7 passaram; chat-smoke/chat-drafts/profile-smoke/studio-smoke/redesign-smoke passaram. Falhas iniciais de JSX/fixtures corrigidas; detalhes no relatório. media-transport foi tentado e bloqueado por candidatos ICE ausentes; NÃO registrar como aprovado. Não houve teste em dois dispositivos físicos, redes distintas, saída/hotplug real, picker/loopback do SO, 4K60 ou release Windows.

Pendências: matriz física, K07/ABR multipar, K01/preload e K16/dependências. Outra IA: conferir MEDIA_EXPERIENCE e commits antes de editar áreas de mídia; reservas liberadas. Entrega local para revisão, sem push/merge.

Atualização do mantenedor: publicação da branch autorizada após executar os testes disponíveis. Build e dez scripts de teste passaram; media-transport foi executado e está bloqueado por ausência de candidatos ICE. Publicação não equivale a aprovação da matriz física ou merge.

Commit de conteúdo MEDIA-001: `de8a914`. Dez scripts passaram e um teste de transporte ficou bloqueado (não aprovado). Alterações preparadas para publicação na branch `feat/media-experience-2026-11-05` conforme autorização do mantenedor; main não modificada. Este registro é o commit documental posterior, identificável pelo histórico Git.

## VISUAL-002 — 05/11/2026 — Codex/OpenAI

Branch feat/visual-fixes-2026-11-05, base d046d66 (mídia integrada PR #5). Recuperação recovery/pre-visual-fixes-2026-11-05. Referências recebidas: Clássico preto/compacto/sidebar tradicional e Moderno com navegação e membros; Moderno agora roxo. Preservados shadcn/Radix e Tailwind, sem bibliotecas novas.

Alterações: src/chat/activities.ts separa últimos 50 eventos em memória por sala; webrtcEngine não grava nem envia ChatMessage de reprodução, ignora novos eventos de clientes antigos no recebimento de chat/sync; ChatPanel filtra registros antigos por type sem apagá-los e mostra atividades separadas. Áudio/metadata P2P preservados. Temas Clássico e Moderno Roxo em theme.ts, seleção persistente nas configurações e CSS compacto; temas salvos antigos permanecem até seleção explícita. Sidebar com controles por ícone, participantes no Clássico e remoção local confirmada/recuperável. Remoção local aprovada explicitamente pelo mantenedor; não afeta outros participantes, mensagens ou arquivos. Ao remover sala ativa, captura é encerrada e o app não retorna automaticamente à sala no reinício; entrada explícita libera essa pausa. AlertDialog local composto dos primitivos shadcn/Radix Dialog existentes, role alertdialog e foco inicial em cancelar.

AvatarCrop integra seleção de PNG/JPEG/WebP até 20 MB, verificação de assinatura e decodificação, limites de 40 MP/10000 px por lado após decodificar, enquadramento quadrado com zoom e eixos, saída 512px WebP com redução automática de qualidade até limite existente de 100000 caracteres. Bitmap/URL liberados. Banner mantém processamento anterior (2 MB). Sem upload remoto ou validação de backend: infraestrutura segue ausente conforme autorização local/P2P. Decodificação depende do navegador; não há medição de pico de memória ou teste EXIF em celulares físicos.

Testes executados: npm run build e tsc passaram (avisos de bundle e preload permanecem); theme-validation 8 grupos, visual-fixes (temas/persistência/sem registros Soundboard/remoção local após reload), profile-smoke (inclui recorte/persistência), media-engine (WebAudio real sintético e adapters), studio-smoke, redesign-smoke, chat-smoke, chat-drafts e chat-model passaram. Testes atualizados para novos presets/recorte e ausência de eventos na conversa; ambiguidades de seletores corrigidas. Tentativas iniciais falharam por índices de preset/expectativa de cor e dupla submissão do recorte; corrigidas e reexecutadas.

Pendências: validação visual fina contra as capturas, acessibilidade completa, imagens de celulares com EXIF e memória sob carga; chamadas, som e tela entre dois dispositivos físicos continuam NÃO testados nesta instância (ICE/rede cloud já bloqueados na fase anterior). Não declarar reprodução remota, captura real do SO, exclusão global ou autorização no servidor como aprovadas. Exclusão global depende de backend autenticado e política de retenção. Documentação de fases anteriores é histórica: modos normal/compacto não recolocam eventos no histórico nesta fase. Atividades transitórias não persistem; eventos antigos permanecem intactos no banco. Reserva liberada para revisão ao concluir. Nenhum push/merge nesta tarefa.

Entrega VISUAL-002: commit de conteúdo `27d6c15`; reserva liberada, branch limpa para revisão. tsc e teste visual-fixes passaram após inclusão da confirmação AlertDialog. Uma execução em HMR expirou ao procurar preset; após reiniciar helper e usar módulos estáveis passou. Nenhum push/merge.


## STABILIZE-001 — 05/11/2026

05/11/2026 · Codex/OpenAI · STABILIZE-001 · fix/stabilization-2026-11-05 · base 89dc1bb. Git inicialmente limpo, PR #6 integrado, sem reservas concorrentes. Correções e arquivos: vite.config.ts; electron/main.ts/security.ts; src/chat/ledger.ts; src/profiles/AvatarCrop.tsx; package/lock (somente versão/comandos); scripts de servidor/testes; três regressões novas; README e docs de revisão/versionamento/resultados. Build passou com saída única do preload; Electron produção/reload, sandbox e pacote Linux passaram. npm test executou 15 scripts: 14 passaram e media-transport bloqueou por ICE (exit 1 total); resultados versionados em stabilization-results.json. Audit 19 vulnerabilidades, nenhuma atualização automática. Tentativa inicial a11y falhou por renderer indisponível; reiniciado e teste passou. Não houve usuários reais em redes separadas, instalador Windows, assinatura ou aprovação de produção. Recursos e pendências em STABILIZATION.md. Sem push/merge; reserva liberada ao entregar.

Entrega STABILIZE-001: conteúdo em `f9df3e8`, branch fix/stabilization-2026-11-05, candidato 2.0.0-rc.1. 14 scripts aprovados e media-transport bloqueado, build/Electron/pacote Linux verificados. Reserva liberada; este é o registro documental posterior. Nenhum push, merge ou declaração de produção.


## SECURITY-002 — 05/11/2026

05/11/2026 · Codex/OpenAI · SECURITY-002 · fix/security-hardening-2026-11-05 · base 7bede05, recuperação recovery/pre-security-hardening-2026-11-05. Trabalho solicitado após checklist de pendências. Bibliotecas existentes atualizadas por advisories; sem trocar shadcn/Tailwind/motores. Arquivos: package/lock, vite.config, scripts/dev-renderer, electron/main/security, src/lib/signalingValidation/webrtcEngine, testes desktop/Electron/chat-drafts/signaling, README e docs. npm ci limpo, npm ls, build, audit, suite e empacotamento executados. Resultado final: audit 0; 15 scripts passaram, transporte bloqueou por ICE; pacote Linux também passou abertura/interface/CSP/mic sintético/reload/sandbox. Falhas intermediárias e avisos documentados em SECURITY_UPDATE.md. Proposta de backend, tabelas/rotas/permissões/migração/testes em BACKEND_PROPOSAL, conforme escolha explícita do mantenedor. Não foram implementados backend/global ACL/arquivos/GIFs. Próximos passos dependem de revisão de contratos; matriz física permanece indisponível. Sem push/merge nesta tarefa; reserva liberada ao entregar.

Entrega SECURITY-002: commit de conteúdo `2f898b9`, candidato 2.0.0-rc.2. Instalação limpa/build/audit/empacotamento verificados; 15 testes passaram e 1 bloqueou por ICE; pacote Linux abriu com interface e CSP. Backend próprio proposto para revisão conforme escolha do mantenedor, não implementado. Reserva liberada; sem push/merge ou declaração de produção.


## BRAND-001 — 05/11/2026 — Codex/OpenAI

Branch feat/compact-bars-logo-2026-11-05, base cb7b93f. Barras compactadas (32px titlebar, 60/56px sala, ~32px chamada); subtítulo removido e estado de maximização sincronizado com Electron. Build e testes compact-bars/window-controls/desktop-security/electron-smoke/redesign-smoke/media-smoke passaram localmente. Arraste e aparência real maximizada/restaurada exigem desktop gráfico. Logo/PNG/ICO ainda pendentes do arquivo original solicitado: tentativa generativa alterou arte e não foi integrada. Ler COMPACT_BARS.md para arquivos, evidências e retomada. Trabalho das barras pronto para revisão; não declarar integração da logo concluída. Reserva da identidade permanece aguardando entrada, sem mudanças de motores/backend. Sem push/merge.

BRAND-001: barras em commit `7fd816d`; arquivo original da logo ainda necessário para concluir PNG/ICO e integração. Build e sete scripts locais passaram. Não declarar testes físicos de janela/arraste ou renderização da logo. Alterações locais preservadas, sem push.


## BRAND-002 — 05/11/2026 — Codex/OpenAI

Branch feat/official-logo-2026-11-05, base 9b58863. SVG oficial recebido e preservado byte a byte; fundo já transparente, branco central faz parte da arte. Exportados nove PNGs e ICO multiresolução; integrados à titlebar/rail, BrowserWindow e builder Windows/Linux. Build, official-logo, compact-bars, window-controls, electron-smoke e empacotamento Linux passaram localmente; logo também carregou no executável Linux. Windows/tray/arraste físico não aprovados. Detalhes/arquivos em OFFICIAL_LOGO.md. Pendência de arquivo de BRAND-001 resolvida; reserva liberada ao concluir revisão local. Sem push/merge nesta etapa.

BRAND-002 entregue em `8cd560e`; SVG oficial preservado, PNG/ICO e integração concluídos. Empacotamento final Linux e logo no executável verificados. Reserva liberada; nenhum push/merge.

## CHAT-UI-003 — 05/11/2026 — Codex/OpenAI

Branch fix/chat-toolbar-rendering-2026-11-05, base 27eb0fe (PR #10 integrado). Barra permanente do chat removida do JSX; pesquisa sob demanda no cabeçalho, fixadas/atividades no menu da sala e densidade persistida em Configurações > Aparência. Estado visual separado por sala e limitado a 20 entradas, sem alterar WebRTC. Usuário confirmou que a sequência numérica era mensagem legítima; preservada integralmente. Regressão com 7000 dígitos verificou preservação e quebra de linha sem overflow. Tests chat-toolbar/chat-smoke passaram. Suite completa foi executada; compact-bars revelou quebra do status em largura intermediária após novo ícone de pesquisa, corrigida por nowrap do subtítulo; reteste registrado ao concluir. Transporte continua bloqueado por ICE, sem simulação de aprovação física. Anexo 3.0 recebido e reafirmado; próximo escopo em WORKSPACE_3_PLAN.md, com diagnóstico de quedas como prioridade máxima.


## BRAND-003 — nova logo oficial — 05/11/2026

Codex/OpenAI · branch feat/workspace-3-2026-11-05 · base eb8f1fc. O mantenedor confirmou o SVG de duas partes como a nova logo oficial, substituindo a marca circular anterior. Fonte preservada em public/brand/logo.svg, azul-marinho #29256B e turquesa #12C9BD. mark.svg ajusta somente margens transparentes para leitura em 20px; paths e cores idênticos. Exportador gera nove PNGs transparentes e ICO com sete resoluções. Integração anterior BrowserWindow/builder preservada, sem instalar biblioteca.

Arquivos: public/brand/*, scripts/export-brand.cjs, src/components/OfficialLogo.tsx, tests/official-logo.cjs, tests/electron-smoke.cjs e documentação. Testes executados: tsc, npm run build, official-logo, compact-bars e electron-smoke passaram. Verificados hash/fidelidade dos paths/cores, transparência e tamanhos PNG, frames PNG do ICO, renderização 20px nos temas Clássico/Moderno Roxo e build Electron. Uma primeira comparação de tags falhou por serialização equivalente <path/> versus <path></path>; teste normalizado e reexecutado com passe.

Limitações: instalador/ícone do Windows, bandeja e arraste físico não testados; Tray não implementado. A marca anterior está no histórico Git. A versão 2.0.0-rc.2 continua inalterada. Esta entrega de identidade não conclui a estabilização de voz ou as demais fases WORKSPACE-3; alterações em andamento preservadas separadamente. Sem push/merge.


## WORKSPACE-3 A/B/F — 05/11/2026 — Codex/OpenAI

Branch feat/workspace-3-2026-11-05, base 8cd3dff. Diagnóstico estruturado local e limitado, relatório sem conteúdo/IDs/endereço, recuperação limitada/cancelável e preservação da voz durante perda isolada do DataConnection. Correções baseadas em caminho reproduzível, sem afirmar causa das quedas do usuário. Push-to-talk opcional com foco (F8/F9/F10), teste local de microfone e limpeza de recursos; stack/mixagem/Soundboard preservados. Arquivos/limites e critérios em VOICE_RECOVERY.md. Testes call-recovery, audio-tools, media-engine e build/tsc passaram nas execuções iniciais; suíte final ainda em execução ao registrar esta fase. Hardware/ICE/TURN e atalho global não aprovados. Sem backend ou mudança de versão; commit de conteúdo será registrado no fechamento.


## WORKSPACE-3 C/D/E — 05/11/2026 — Codex/OpenAI

Branch feat/workspace-3-2026-11-05, sobre ac501cc. Sidebar existente refinada, sem recriar aplicativo: pesquisa, favoritas locais/recentes separados, indicador real de não lidas da sala ativa, painel compacto de voz e rodapé de perfil em uma linha com tooltips/estados reais. Resize/collapse/Sheets, temas e opções detalhadas do dock preservados. useShallow evita subscrição do sidebar a micLevel e outros estados sem uso. Arquivos: LeftSidebar.tsx, index.css e workspace-sidebar.cjs; documentação em WORKSPACE_3_STATUS.md. workspace-sidebar passou localmente, incluindo teclado/mobile/persistência/temas. Sem contadores de outras salas ou DM falsos. Demais dependências externas estão explicitadas no status.


## WORKSPACE-3 — fechamento local — 05/11/2026 — Codex/OpenAI

Branch feat/workspace-3-2026-11-05. Commits de conteúdo: eb8f1fc (limpeza do chat, sem motor), 8cd3dff (nova logo oficial), ac501cc (diagnóstico/recuperação/áudio), bed3859 (sidebar/painel/rodapé). Fonte, PNGs/ICO, componentes, testes e limites por fase em WORKSPACE_3_STATUS.md e VOICE_RECOVERY.md. main não alterada; nenhum push/merge nesta tarefa. Tags locais de recuperação preservadas. Reservas liberadas para revisão.

Resultado final EXECUTADO: npm run build e tsc passaram; npm test executou 23 scripts, 22 passaram e media-transport ficou BLOCKED por ausência de candidatos ICE locais. O runner terminou exit 1 pelo bloqueio, sem falhas funcionais restantes nessa execução. Logs em build/test-logs e resumo em build/test-results.json são artefatos locais ignorados. A primeira suíte teve uma falha no fixture de call-recovery: a reconstrução esgotada removia sessões antigas como esperado e o cenário seguinte presumiu que havia um canal de chat. Fixture passou a estabelecer novo canal antes de verificar saída independente da voz; teste isolado e suíte completa repetidos com passe. A comparação de tags SVG também foi normalizada/reexecutada conforme BRAND-003. Não omitir essas tentativas na retomada.

Pacote Linux local preparado com electron-builder --linux --dir e Electron45 instalado. Executável dist-package/linux-unpacked/cbshub abriu/recarregou e passou electron-smoke com logo, CSP, preload sandboxed e captura sintética. Pacote não publicado/assinado. Avisos preexistentes: customResolver/freeze, bundle JS ~695,75kB (gzip ~204,73kB), metadata author e referências repetidas no empacotamento; sem alteração de dependências nesta entrega. Não foi reexecutado npm audit: a última auditoria zero é evidência da fase SECURITY-002, não uma nova execução.

Pendente/manual: chamadas reais em dois computadores/redes e vários participantes, ICE/STUN/TURN, suspensão/recuperação real, dispositivos físicos, vídeo/tela/Soundboard simultâneos, consumo de CPU/memória sob carga, Windows/ícones/arraste físicos, leitor de tela e revisão fina de contraste. Não declarar que todas as quedas foram corrigidas ou que o aplicativo está pronto para produção. Versão de desenvolvimento permanece 2.0.0-rc.2; selecionar próximo rc conforme VERSIONING.md antes de distribuir novo candidato. Backend próprio continua proposta para revisão; contas, ACL/salas globais, sincronização entre dispositivos, DM, anexos/pastas/GIFs e notificações do SO não implementados nesta entrega. Sem interfaces falsas.

Próximo responsável: revisar os commits separados, coletar relatório Configurações > Diagnóstico durante uma queda real e executar os gates da matriz de WORKSPACE_3_STATUS.md. No PTT usar F8/F9/F10 com foco; não confundir com atalho global. Favoritos/remoção/restauração de salas são locais; dados históricos existentes preservados.


## Publicação autorizada — WORKSPACE-3 — 05/11/2026

Codex/OpenAI · branch feat/workspace-3-2026-11-05 · conteúdo até a512aa8. Usuário autorizou envio ao Git nesta tarefa. Push da branch efetuado com sucesso; main intacta, sem force push, merge ou release. Este registro documental acompanha a publicação. Checkout estava limpo antes do envio. Testes não reexecutados nesta tarefa de publicação: evidência anterior permanece build aprovado, 22 testes aprovados e 1 BLOCKED por ICE, além de smoke do pacote Linux. Matriz física/Windows/backend continuam pendentes conforme WORKSPACE_3_STATUS.md.

## DESKTOP-004 A/B — 05/11/2026 — Codex/OpenAI
Branch feat/desktop-refinement-2026-11-05, base 29e60c1. Auditoria/planejamento em DESKTOP_REFINEMENT_PLAN.md. Corrigido critério que confundia reconnect() sem confirmação open com sinalização saudável. Handshake pendente >12s é reconstruído com limite/backoff existentes; online reinicia imediatamente a tentativa; estado local não é atribuído a participante remoto. Enlace explicitamente rotulado como observação entre peers. Arquivos mediaState/webrtcEngine/CallStatus e adapters dos testes. tsc/build e call-recovery/media-engine passaram, incluindo abertura travada, preservação de captura e mídia sintética. Áudio/vídeo real após reconexão continua pendente de ICE/dispositivos; não alegar correção de todas as quedas.

## DESKTOP-004 Tray — 05/11/2026 — Codex/OpenAI
Branch feat/desktop-refinement-2026-11-05. Electron usa single-instance lock, bandeja com logo oficial, Abrir/Encerrar e restauração por clique/activate. X oculta sem destruir renderer/captura; before-quit permite encerramento real. Novo IPC somente leitura validado pelo renderer principal. Em headless a criação nativa de Tray abortou por Gtk sem display; adicionada detecção de capacidade antes de instanciar, usando minimizar como fallback seguro. Sem bandeja disponível não se esconde uma janela irrecuperável. Build/tsc, tray-lifecycle (captura sintética ativa após fechar/restaurar), window-controls e desktop-security passaram. Menu/ícone Windows e desktop gráfico ainda manuais; headless não comprova bandeja física.

## DESKTOP-004 — identidade local antes de open — 05/11/2026
Codex/OpenAI · feat/desktop-refinement-2026-11-05. O teste do palco detectou captura ativa com cards vazios antes de Peer.id ser confirmado. Atualizações do participante local agora resolvem a identidade já registrada na sala, sem aguardar sinalização externa. Corrige presença de voz/mute/câmera/fala no estado local pendente, sem falsificar abertura da rede. tsc/build e desktop-refinement passaram após correção; transporte remoto continua não verificado. Arquivo webrtcEngine.ts.

## DESKTOP-004 — cards proporcionais — 05/11/2026
Codex/OpenAI · feat/desktop-refinement-2026-11-05. callGrid calcula colunas/linhas e dimensões 16:9 pela área disponível; ResizeObserver acompanha palco/janela com cleanup. Cards/avatar acompanham altura em vez de mínimo fixo de 140px; palco muito pequeno mantém rolagem. Spotlight/webcam/tela e controles preservados; overlay de transmissão agora aparece em hover/foco em vez de ocultar vídeo permanentemente. Arquivos CallStagePanel/UserCallCard, useElementSize, callGrid e tokens CSS. desktop-refinement passou tamanhos 220/360/490 e atribuição de qualidade por peer; build/tsc passaram. Vídeo/tela entre computadores continuam pendentes.

## DESKTOP-004 — configurações integradas e novos temas — 05/11/2026
Codex/OpenAI · feat/desktop-refinement-2026-11-05. Perfil e Studio reutilizam formulários/validações existentes dentro de um único Dialog de configurações; recorte de avatar também inline nesse contexto. Navegação central por settingsNavigation e grupos de abas nomeados. Fechar/Escape cancela prévia de tema; salvar/cancelar perfil não cria modal encadeado. Sakura Dream e Velvet Nocturne adicionados sem remover presets anteriores ou mudar JSON v1; cores, estados semânticos, menus/modais e título serifado local do Velvet por tokens. profile-smoke, studio-smoke, theme-validation (9 presets/8 grupos), desktop-refinement (4 temas/contraste WCAG dos novos/uma janela/persistência) passaram. Primeiras tentativas expuseram seletores ambíguos/fluxos que presumiam fechamento do modal; atualizados para escopo correto e reexecutados. Arquivos SettingsModal, settingsNavigation, ProfileDialog/Provider/AvatarCrop, StudioDialog/Provider/theme, App e CSS. Sem mudança de autenticação/backend ou nova biblioteca.

## DESKTOP-004 — logo animada e reconexão — 05/11/2026
Codex/OpenAI · feat/desktop-refinement-2026-11-05. AnimatedLogo preserva os paths/cores da logo confirmada, com clip-path, pausa/escala discreta e desaparecimento em loop; respeita movimento reduzido do SO/Studio. BootSplash acompanha inicialização real da sala/histórico/efeitos, sem atraso artificial. ConnectionScreen exige perda sustentada após conexão anterior e não bloqueia voz observada connected ou falha isolada de peer; oferece histórico local/cancelamento e encerrar chamada. desktop-refinement passou overlay controlado, preservação de captura, ausência de bloqueio com enlace saudável, cancelamento e reduced motion. Sem promessa de mídia remota real/boot físico de Windows; logo anterior de arcos não foi restaurada.

## DESKTOP-004 — Efeitos Sonoros e corte — 05/11/2026
Codex/OpenAI · feat/desktop-refinement-2026-11-05. Motor/protocolo Soundboard preservados; interface renomeada Efeitos Sonoros. Importação e edição de arquivos mostram waveform, início/fim, duração, prévia local e aplicação explícita. Original retido em originalAudioBlob (campo aditivo), gravação IndexedDB atômica existente e exclusão do original exige confirmação. Limites: 5 MB por blob, 120s, dois canais/96kHz; saída WAV PCM16 até 5 MB, corte mínimo 0,05s. Sintetizados embutidos continuam editáveis em metadados; corte de waveform é para arquivos importados, sem inventar arquivo original para um sintetizador.
Prévia usa player local separado, respeita áudio silenciado, para/libera src e URL ao fechar/trocar intervalo; não chama stopAll nem troca pipeline de chamada. Cache decodificado do ID editado é invalidado após gravação bem-sucedida, sem parar fonte já tocando. audio-trim passou duração WAV, original preservado, reedição/reload, cache invalidado, arquivo/intervalos/tamanho inválidos rejeitados e captura ativa durante edição. Primeira asserção de cache ocorreu antes da transação terminar; corrigida para aguardar conclusão real da gravação e repetida. Build/tsc passaram. Sem avaliação auditiva física ou medição de pico de memória sob carga.

## DESKTOP-004 — navegação e ações preservadas — 05/11/2026
Codex/OpenAI · feat/desktop-refinement-2026-11-05. Rail ganhou ação real de entrar/adicionar sala com foco no campo existente; painel de voz mostra qualidade observada por enlace e participante. Nomenclatura de efeitos atualizada em dock/menu/atividades, preservando dados, protocolo e nomes de funções. Sidebar/favoritos/unread da sala ativa, barras compactas e toolbar removida já existiam e foram mantidos. Regressões chat-smoke/chat-toolbar/media-smoke passaram na rodada final até este registro; números legítimos e conteúdo de mensagens não foram removidos. Campos/capacidades locais continuam locais, sem DM ou exclusão global falsos.

## DESKTOP-004 — consolidação final e seletores — 05/11/2026
Codex/OpenAI · feat/desktop-refinement-2026-11-05. Ações comuns de voz ficam na sidebar; dispositivos e opções completas são revelados sob demanda. Com sidebar recolhida/mobile, dock completo retorna; com palco minimizado e sem sidebar, desligar permanece no cabeçalho. A ação Configurações de voz abre a aba correta. Medidor de microfone isolado e seletores rasos em configurações/cabeçalho evitam renderizar os editores a cada atualização de nível/telemetria sem uso; sem alegar ganho percentual de CPU. Build/tsc e testes desktop-refinement/media-smoke/compact-bars/electron-smoke/studio-smoke passaram nas execuções. Probe extra confirmou dock/desligar acessíveis com sidebar recolhida, palco minimizado e 390px, mantendo captura sintética ativa. Ao liberar área dos cards, altura pode estabilizar no limite de largura 16:9: teste agora exige crescimento inicial, não redução e proporção correta, em vez de esticar vídeo. Cancelar tema embutido também descarta o nome digitado, bug reproduzido e regressão adicionada. Última nomenclatura da UI ajustada a Efeitos Sonoros.

## DESKTOP-004 — origem da telemetria — 05/11/2026
Codex/OpenAI · feat/desktop-refinement-2026-11-05. Revisão final encontrou FPS 60 e RTT 18/20 como defaults do HUD legado, além de snapshot global potencialmente atribuído a outro spotlight. Removidos defaults presumidos; falta de amostra vira indisponível, resolução de saída é identificada como meta configurada e bitrate/perda têm flags de medição. Amostras carregam sourcePeerId/direction/observedLinkPeerId; HUD exige correspondência com participante focado e diagnóstico explica origem/enlace. Observer de recepção acompanha o foco; produtor de outra tela não rouba o observador nem sobrescreve o foco. Gerações descartam stats assíncronas antigas; rede desconhecida não conta como ciclo bom do ABR. Primeira normalização de foco escreveu usando closure obsoleta e foi detectada pelo teste A/B; substituída por leitura do estado atual sem reescrever seleção. Build/tsc, stream-telemetry (adapters/clock), media-engine e desktop-refinement passaram. ABR completo por par e comprovação física continuam pendentes; não foi prometido mapa simultâneo de todos os streams.
