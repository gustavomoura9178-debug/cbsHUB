> Estado atual: **HOTFIX-006 · 2.0.0-rc.5 · 06/11/2026 UTC**. Leia [HOTFIX_ACCEPTANCE.md](HOTFIX_ACCEPTANCE.md). Registros anteriores são históricos; testes físicos permanecem pendentes.

> Estado atual: **HOTFIX-005 · 2.0.0-rc.4 · 06/11/2026 UTC**. Leia [HOTFIX_STABILITY.md](HOTFIX_STABILITY.md). Registros anteriores são históricos; candidato para revisão, sem aprovação de produção.

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


## BRAND-003 — nova logo oficial — 05/11/2026

Codex/OpenAI · branch feat/workspace-3-2026-11-05 · base eb8f1fc. O mantenedor confirmou o SVG de duas partes como a nova logo oficial, substituindo a marca circular anterior. Fonte preservada em public/brand/logo.svg, azul-marinho #29256B e turquesa #12C9BD. mark.svg ajusta somente margens transparentes para leitura em 20px; paths e cores idênticos. Exportador gera nove PNGs transparentes e ICO com sete resoluções. Integração anterior BrowserWindow/builder preservada, sem instalar biblioteca.

Arquivos: public/brand/*, scripts/export-brand.cjs, src/components/OfficialLogo.tsx, tests/official-logo.cjs, tests/electron-smoke.cjs e documentação. Testes executados: tsc, npm run build, official-logo, compact-bars e electron-smoke passaram. Verificados hash/fidelidade dos paths/cores, transparência e tamanhos PNG, frames PNG do ICO, renderização 20px nos temas Clássico/Moderno Roxo e build Electron. Uma primeira comparação de tags falhou por serialização equivalente <path/> versus <path></path>; teste normalizado e reexecutado com passe.

Limitações: instalador/ícone do Windows, bandeja e arraste físico não testados; Tray não implementado. A marca anterior está no histórico Git. A versão 2.0.0-rc.2 continua inalterada. Esta entrega de identidade não conclui a estabilização de voz ou as demais fases WORKSPACE-3; alterações em andamento preservadas separadamente. Sem push/merge.


## WORKSPACE-3 — fechamento local — 05/11/2026 — Codex/OpenAI

Branch feat/workspace-3-2026-11-05. Commits de conteúdo: eb8f1fc (limpeza do chat, sem motor), 8cd3dff (nova logo oficial), ac501cc (diagnóstico/recuperação/áudio), bed3859 (sidebar/painel/rodapé). Fonte, PNGs/ICO, componentes, testes e limites por fase em WORKSPACE_3_STATUS.md e VOICE_RECOVERY.md. main não alterada; nenhum push/merge nesta tarefa. Tags locais de recuperação preservadas. Reservas liberadas para revisão.

Resultado final EXECUTADO: npm run build e tsc passaram; npm test executou 23 scripts, 22 passaram e media-transport ficou BLOCKED por ausência de candidatos ICE locais. O runner terminou exit 1 pelo bloqueio, sem falhas funcionais restantes nessa execução. Logs em build/test-logs e resumo em build/test-results.json são artefatos locais ignorados. A primeira suíte teve uma falha no fixture de call-recovery: a reconstrução esgotada removia sessões antigas como esperado e o cenário seguinte presumiu que havia um canal de chat. Fixture passou a estabelecer novo canal antes de verificar saída independente da voz; teste isolado e suíte completa repetidos com passe. A comparação de tags SVG também foi normalizada/reexecutada conforme BRAND-003. Não omitir essas tentativas na retomada.

Pacote Linux local preparado com electron-builder --linux --dir e Electron45 instalado. Executável dist-package/linux-unpacked/cbshub abriu/recarregou e passou electron-smoke com logo, CSP, preload sandboxed e captura sintética. Pacote não publicado/assinado. Avisos preexistentes: customResolver/freeze, bundle JS ~695,75kB (gzip ~204,73kB), metadata author e referências repetidas no empacotamento; sem alteração de dependências nesta entrega. Não foi reexecutado npm audit: a última auditoria zero é evidência da fase SECURITY-002, não uma nova execução.

Pendente/manual: chamadas reais em dois computadores/redes e vários participantes, ICE/STUN/TURN, suspensão/recuperação real, dispositivos físicos, vídeo/tela/Soundboard simultâneos, consumo de CPU/memória sob carga, Windows/ícones/arraste físicos, leitor de tela e revisão fina de contraste. Não declarar que todas as quedas foram corrigidas ou que o aplicativo está pronto para produção. Versão de desenvolvimento permanece 2.0.0-rc.2; selecionar próximo rc conforme VERSIONING.md antes de distribuir novo candidato. Backend próprio continua proposta para revisão; contas, ACL/salas globais, sincronização entre dispositivos, DM, anexos/pastas/GIFs e notificações do SO não implementados nesta entrega. Sem interfaces falsas.

Próximo responsável: revisar os commits separados, coletar relatório Configurações > Diagnóstico durante uma queda real e executar os gates da matriz de WORKSPACE_3_STATUS.md. No PTT usar F8/F9/F10 com foco; não confundir com atalho global. Favoritos/remoção/restauração de salas são locais; dados históricos existentes preservados.


## DESKTOP-004 — entrega de revisão — 05/11/2026 — Codex/OpenAI

Branch feat/desktop-refinement-2026-11-05, base 29e60c1 (PR #11 integrado). Candidato **2.0.0-rc.3**, package/lock consistentes; nenhuma dependência nova/substituída. Código até f9c5513, seguido deste fechamento de testes/versão/docs. Escopo/arquivos/limites em DESKTOP_REFINEMENT.md. Commits: cf21349 (abertura real/reconexão), 7a408f6 (Tray/processo), c2264b3 (identidade local antes de open), 4e1c735 (cards), 322c5c0 (configurações/temas), 8274ad9 (logo/loading), 5a749f6 (corte de efeitos), c5994f2 (navegação), 9a5164a (controles/seletores) e f9c5513 (origem de telemetria).

EXECUTADO: npm run build/tsc passaram; npm test executou **27 scripts: 26 PASSED, 1 BLOCKED (media-transport, ausência de candidatos ICE locais)**. Exit 1 do runner corresponde ao bloqueio, não a um passe de transporte nem a falha funcional restante nessa execução. npm audit executado nesta revisão: zero ocorrências. Empacotamento Linux final e electron-smoke com executável dist-package/linux-unpacked/cbshub passaram (startup/reload, logo, CSP, preload isolado e captura sintética). Build JS ~708,58kB/gzip ~209,73kB; avisos preexistentes de customResolver/freeze/bundle e author/referências do builder permanecem. Logs/resumo/pacote são artefatos locais ignorados, não instalador Windows publicado. npm ci não foi repetido porque a resolução de dependências não mudou. Empacotar depois de parar renderer: HTML gerado em dist-package pode provocar reload do Vite e interferir nos testes.

Regressões cobrem temas/contraste/persistência/cancelar, editores dentro de um Dialog, avatar/banner e privacidade local/P2P, chat/drafts/CRUD/sync por ponte, áudio sintético/efeitos/PTT/dispositivos, captura e streams, cards/spotlight, controles mobile/recolhidos, backoff e geração de sessão, processo/segunda instância/fallback desktop, telemetria sem números presumidos e origem do enlace. Testes entre computadores reais NÃO foram executados. As tentativas com falha e correções de fixtures/código estão nos registros acima; não apresentar somente uma compilação como evidência de reconexão real.

Pendências: ICE/STUN/TURN e áudio/vídeo depois de queda em duas máquinas/redes; suspensão e troca física de dispositivos; bandeja/menu/ícone Windows e janelas físicas; leitor de tela/contraste completo e benchmark de CPU/GPU/memória sob carga. ABR independente por todos os pares continua pendente; origem do HUD/foco e ausência de medição já foram corrigidas. Backend/contas/ACL/salas globais, DM/anexos/arquivos/pastas/GIFs continuam dependentes de revisão/infraestrutura. Notificações de mensagens do SO também permanecem pendentes. Remoção/restauração/favoritos de salas são locais por decisão anterior. Fallback de memória de banco indisponível não é durabilidade após reinício. Não declarar produção pronta.

Para outra IA: ler DESKTOP_REFINEMENT.md antes de editar. Studio.begin e ProfileProvider.edit abrem abas de configurações; não remontar StudioDialog global ou recriar os editores. API preload tem 9 métodos, getter getDesktopState restrito ao renderer principal. X preserva renderer/captura; before-quit libera encerramento. PTT continua com foco e ganho antes da entrada de efeitos. originalAudioBlob é aditivo/local e não deve ser descartado silenciosamente. Telemetria precisa de sourcePeerId/direction/observedLinkPeerId/flags; não reintroduzir FPS/RTT defaults nem publicar resultado de PC antigo. Medidor é isolado; não voltar a assinar micLevel nos editores/header. Preservar logo nova e mensagem numérica legítima. Próximo gate: revisão da branch e matriz física, sem merge automático.

## HOTFIX-005 — revisão rc.4 — 06/11/2026 UTC

Codex/OpenAI · hotfix/stability-desktop-2026-11-05, base b8983d6. Oito áreas integradas por correções incrementais sobre DESKTOP-004. Rede: e573b61; bandeja: be773a3; cards/estados/splash: 6194b4a; configurações: df71b48; corte: f489dd3; fixture Studio: 3ad21b0. Resultados consolidados e lista de arquivos em HOTFIX_STABILITY.md; metadados de versão seguem VERSIONING.md. Não confundir tráfego RTP confirmado no teste controlado com audição real. Não há aprovação de produção, Windows ou transporte entre máquinas.

Resultado final EXECUTADO — HOTFIX-005: build/tsc PASSED; suíte 31 scripts, 30 PASSED/1 BLOCKED (media-transport sem candidatos ICE locais), nenhuma falha restante; exit 1 é o bloqueio. Resumo em hotfix-005-results.json. npm audit --omit=dev: zero vulnerabilidades reportadas. Pacote Linux rc.4 e smoke do executável passaram. Renderer foi parado antes de empacotar. Windows, audição real em dois dispositivos após queda, captura física e revisão assistiva permanecem manuais. Nenhuma aprovação de produção ou publicação de binário.

## HOTFIX-006 — 06/11/2026 UTC — Codex/OpenAI

Branch fix/hotfix-acceptance-gaps-2026-11-06, base 16afa14 (PR #13 já integrado). Candidato rc.5; conteúdo b527927 e a544853, seguido do fechamento documental. Corrigidas lacunas reais: identidade das mensagens em Aparência com persistência e contraste, estado de sinalização/presença local no próprio card/sidebar, miniaturas spotlight proporcionais e pausa conjunta de 364 ms da logo. Motor de rede, bancos, IPC, arte e stack preservados. Relatório por requisito/arquivos: HOTFIX_ACCEPTANCE.md.

EXECUTADO: build/tsc PASSED; suíte 33 scripts, 32 PASSED/1 BLOCKED por ICE (exit 1); zero falhas restantes. Teste integrado adicional dos controles compactos PASSED. Pacote e smoke Linux rc.5 PASSED. Evidências em hotfix-006-results.json. Windows, audição bidirecional em dispositivos físicos após queda e revisão assistiva não executados. Sem produção aprovada ou merge automático.
