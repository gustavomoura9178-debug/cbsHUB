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

## MEDIA-001 — em execução

05/11/2026 · Codex/OpenAI · feat/media-experience-2026-11-05 · base 6a72051. Preflight: Chat 2 integrado pelo PR #4; árvore limpa, sem reservas ativas ou alterações adicionais no remoto. Recuperação recovery/pre-media-experience-2026-11-05. Reserva: controles/palco/dispositivos, ciclo de vida de mídia no motor, Soundboard/persistência, testes e docs. Preservar PeerJS, pipeline de áudio, chat e shadcn/Tailwind. Aceite: build, regressões e mídia sintética local; dois dispositivos físicos e redes distintas exigem validação manual. Rede cloud não libera PeerJS externo.


## Atualização — MEDIA-001 — 05/11/2026

MEDIA-001 concluído para revisão; reserva liberada. Branch feat/media-experience-2026-11-05; base 6a72051. Ver MEDIA_EXPERIENCE.md para arquivos, testes reais e matriz pendente. Commits serão identificados no ACTIVITY_LOG após criação. Sem trabalho concorrente conhecido; main intacta.

Atualização do mantenedor: publicação da branch autorizada após executar os testes disponíveis. Build e dez scripts de teste passaram; media-transport foi executado e está bloqueado por ausência de candidatos ICE. Publicação não equivale a aprovação da matriz física ou merge.

Commit de conteúdo MEDIA-001: `de8a914`. Dez scripts passaram e um teste de transporte ficou bloqueado (não aprovado). Alterações preparadas para publicação na branch `feat/media-experience-2026-11-05` conforme autorização do mantenedor; main não modificada. Este registro é o commit documental posterior, identificável pelo histórico Git.

## VISUAL-002 — ativo
05/11/2026 · Codex · feat/visual-fixes-2026-11-05 · base d046d66. Sem alterações locais prévias; mídia integrada PR #5. Reserva: temas, eventos de som/chat, sidebar, avatar e testes/docs. Remoção de sala somente local aprovada pelo usuário; backend depois. Recuperação recovery/pre-visual-fixes-2026-11-05.

## VISUAL-002 — 05/11/2026 — Codex/OpenAI

Branch feat/visual-fixes-2026-11-05, base d046d66 (mídia integrada PR #5). Recuperação recovery/pre-visual-fixes-2026-11-05. Referências recebidas: Clássico preto/compacto/sidebar tradicional e Moderno com navegação e membros; Moderno agora roxo. Preservados shadcn/Radix e Tailwind, sem bibliotecas novas.

Alterações: src/chat/activities.ts separa últimos 50 eventos em memória por sala; webrtcEngine não grava nem envia ChatMessage de reprodução, ignora novos eventos de clientes antigos no recebimento de chat/sync; ChatPanel filtra registros antigos por type sem apagá-los e mostra atividades separadas. Áudio/metadata P2P preservados. Temas Clássico e Moderno Roxo em theme.ts, seleção persistente nas configurações e CSS compacto; temas salvos antigos permanecem até seleção explícita. Sidebar com controles por ícone, participantes no Clássico e remoção local confirmada/recuperável. Remoção local aprovada explicitamente pelo mantenedor; não afeta outros participantes, mensagens ou arquivos. Ao remover sala ativa, captura é encerrada e o app não retorna automaticamente à sala no reinício; entrada explícita libera essa pausa. AlertDialog local composto dos primitivos shadcn/Radix Dialog existentes, role alertdialog e foco inicial em cancelar.

AvatarCrop integra seleção de PNG/JPEG/WebP até 20 MB, verificação de assinatura e decodificação, limites de 40 MP/10000 px por lado após decodificar, enquadramento quadrado com zoom e eixos, saída 512px WebP com redução automática de qualidade até limite existente de 100000 caracteres. Bitmap/URL liberados. Banner mantém processamento anterior (2 MB). Sem upload remoto ou validação de backend: infraestrutura segue ausente conforme autorização local/P2P. Decodificação depende do navegador; não há medição de pico de memória ou teste EXIF em celulares físicos.

Testes executados: npm run build e tsc passaram (avisos de bundle e preload permanecem); theme-validation 8 grupos, visual-fixes (temas/persistência/sem registros Soundboard/remoção local após reload), profile-smoke (inclui recorte/persistência), media-engine (WebAudio real sintético e adapters), studio-smoke, redesign-smoke, chat-smoke, chat-drafts e chat-model passaram. Testes atualizados para novos presets/recorte e ausência de eventos na conversa; ambiguidades de seletores corrigidas. Tentativas iniciais falharam por índices de preset/expectativa de cor e dupla submissão do recorte; corrigidas e reexecutadas.

Pendências: validação visual fina contra as capturas, acessibilidade completa, imagens de celulares com EXIF e memória sob carga; chamadas, som e tela entre dois dispositivos físicos continuam NÃO testados nesta instância (ICE/rede cloud já bloqueados na fase anterior). Não declarar reprodução remota, captura real do SO, exclusão global ou autorização no servidor como aprovadas. Exclusão global depende de backend autenticado e política de retenção. Documentação de fases anteriores é histórica: modos normal/compacto não recolocam eventos no histórico nesta fase. Atividades transitórias não persistem; eventos antigos permanecem intactos no banco. Reserva liberada para revisão ao concluir. Nenhum push/merge nesta tarefa.

Entrega VISUAL-002: commit de conteúdo `27d6c15`; reserva liberada, branch limpa para revisão. tsc e teste visual-fixes passaram após inclusão da confirmação AlertDialog. Uma execução em HMR expirou ao procurar preset; após reiniciar helper e usar módulos estáveis passou. Nenhum push/merge.

## STABILIZE-001 — ativo
05/11/2026 · Codex/OpenAI · fix/stabilization-2026-11-05 · base 89dc1bb (PR #6 integrado). Checkout limpo, sem reservas ativas. Recuperação recovery/pre-stabilization-2026-11-05. Reserva: preload/Electron, lifecycle/performance pontuais, testes e documentação. Preservar bibliotecas e todos os dados; não publicar produção sem matriz real.


## STABILIZE-001 — 05/11/2026

STABILIZE-001 concluído para revisão; reserva liberada. Branch fix/stabilization-2026-11-05, base 89dc1bb; candidato 2.0.0-rc.1. Build/pacote Linux testados; 14 scripts aprovados e 1 bloqueado. Ler STABILIZATION.md antes de integrar. Main intacta.

Entrega STABILIZE-001: conteúdo em `f9df3e8`, branch fix/stabilization-2026-11-05, candidato 2.0.0-rc.1. 14 scripts aprovados e media-transport bloqueado, build/Electron/pacote Linux verificados. Reserva liberada; este é o registro documental posterior. Nenhum push, merge ou declaração de produção.

## SECURITY-002 — ativo — 05/11/2026

Codex/OpenAI · fix/security-hardening-2026-11-05 · base 7bede05 (PR #7 integrado), checkout inicialmente limpo. Recuperação recovery/pre-security-hardening-2026-11-05. Usuário autorizou executar pendências da revisão: começar por segurança/dependências/permissões, preservando shadcn/Tailwind e motores existentes. Atualizações das bibliotecas existentes serão justificadas pelos advisories e verificadas por build/regressões. Sem substituição da stack. Backend depende da resposta à pergunta sobre serviço existente versus proposta própria; trabalho independente prossegue. Reserva: package/lock, compatibilidade build/plugins, políticas Electron, testes e docs.


## SECURITY-002 — 05/11/2026

SECURITY-002 concluído para revisão, reserva liberada. Branch fix/security-hardening-2026-11-05, base 7bede05, candidato 2.0.0-rc.2. Segurança: audit 0 e políticas/perfis P2P reforçados. Backend próprio: proposta pronta, aguardando revisão do mantenedor; nenhuma implementação de servidor ativa. Pendências físicas e demais etapas em SECURITY_UPDATE.md/BACKEND_PROPOSAL.md.

Entrega SECURITY-002: commit de conteúdo `2f898b9`, candidato 2.0.0-rc.2. Instalação limpa/build/audit/empacotamento verificados; 15 testes passaram e 1 bloqueou por ICE; pacote Linux abriu com interface e CSP. Backend próprio proposto para revisão conforme escolha do mantenedor, não implementado. Reserva liberada; sem push/merge ou declaração de produção.

## BRAND-001 — ativo — 05/11/2026

Codex/OpenAI · feat/compact-bars-logo-2026-11-05 · base cb7b93f (PR #8 integrado). Checkout limpo; sem reservas concorrentes. Reserva: titlebar, RoomTopBar, barra de chamada, tokens de altura, estado da janela/IPC, testes/docs e assets oficiais quando fornecidos em arquivo. Referências visuais recebidas; geração de transparência alterou arte e foi descartada. Solicitado PNG/SVG original para preservar identidade exata. Sem mudança de motores de voz/chat ou backend. Recuperação recovery/pre-compact-bars-2026-11-05.


## BRAND-001 — 05/11/2026 — Codex/OpenAI

Branch feat/compact-bars-logo-2026-11-05, base cb7b93f. Barras compactadas (32px titlebar, 60/56px sala, ~32px chamada); subtítulo removido e estado de maximização sincronizado com Electron. Build e testes compact-bars/window-controls/desktop-security/electron-smoke/redesign-smoke/media-smoke passaram localmente. Arraste e aparência real maximizada/restaurada exigem desktop gráfico. Logo/PNG/ICO ainda pendentes do arquivo original solicitado: tentativa generativa alterou arte e não foi integrada. Ler COMPACT_BARS.md para arquivos, evidências e retomada. Trabalho das barras pronto para revisão; não declarar integração da logo concluída. Reserva da identidade permanece aguardando entrada, sem mudanças de motores/backend. Sem push/merge.

BRAND-001: barras em commit `7fd816d`; arquivo original da logo ainda necessário para concluir PNG/ICO e integração. Build e sete scripts locais passaram. Não declarar testes físicos de janela/arraste ou renderização da logo. Alterações locais preservadas, sem push.
