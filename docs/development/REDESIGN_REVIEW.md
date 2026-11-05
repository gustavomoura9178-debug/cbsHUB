# Entrega para revisão — REDESIGN-001

05/11/2026 · Codex/OpenAI · branch `feat/workspace-redesign-2026-11-05`.
Base: `recovery/pre-redesign-2026-11-05` (2f54c07). Commit de conteúdo: a29e4ca.

## Entrega

Novo shell com rail, salas recentes e entrada por código; sidebar com resize/collapse e persistência; membros opcionais agrupados por presença em voz; cabeçalho com ações de sala; compositor e histórico offline; menus de sala/mensagem/membro, tooltips e foco; controles de voz identificados; telemetria organizada; responsividade e reduced motion. Design system documentado em DESIGN_SYSTEM.md. Sem personalização nesta fase.

## Componentes alterados

- App: composição de shell/painéis; effects de inicialização preservados.
- LeftSidebar, RoomTopBar, TitleBar: navegação e cabeçalhos reorganizados com as mesmas ações do motor.
- WorkspaceRail, MembersPanel, ParticipantAvatar, StreamDiagnostics: componentes novos que reutilizam estado e primitivos existentes.
- useWorkspaceLayout, Sheet, ResizeHandle: estado visual isolado, overlays acessíveis e resize local sem novas dependências.
- TextChatSection: compositor, tipografia, avatar, menu de mensagem, foco das ações e histórico visível offline; Enter respeita composição IME.
- CallControlDock: nomes acessíveis, grupos e tokens; dispositivos/mute/deafen/webcam/Soundboard mantêm callbacks existentes.
- CallStagePanel/UserCallCard: grid responsiva, limites de altura e foco de tela por teclado; tokens semânticos.
- Modais, emoji picker e Soundboard: adaptação de superfícies/tipografia aos tokens, sem mudança dos motores.
- ui/button, badge, dropdown-menu: uso de tokens tipográficos existentes no novo tema.
- index.css/index.html: design system e superfícies globais.

## Validação

Build TypeScript/Vite/Electron passou. Regressão local: seis grupos de renderer/chat persistente/modal/reação/CRUD WAV/mixagem com mic mudo e stopAll passaram; Electron produção expôs API nesta execução. Layout: resize teclado/limites/persistência, collapse, membros, menus/diagnóstico, mensagem offline, viewports 390/768/1024 e Sheets móveis/Escape passaram, sem pageerror. Inspeção visual desktop realizada. Teste repetível de UI em tests/redesign-smoke.cjs (pré-requisitos em tests/README.md).

Diff contra a base confirmou motores src/lib, store, tipos, Electron, configuração de build, manifesto e lockfile intactos. Última mudança de áudio da outra IA foi revisada e preservada. Remoto consultado: somente main em 5deab40; trabalho externo não publicado não é observável.

## Pendências e integração

Testes reais multipar/voz/vídeo/loopback/4K60 e Windows não executados; PeerJS permanece bloqueado pela política da instância. K01 (saídas preload), favoritos nativos e propagação da cor continuam documentados; smoke local não os corrige. CPU/GPU indisponíveis; acessibilidade completa e CI pendentes. Aviso de bundle >500kB permanece.

O pedido explícito do mantenedor autorizou executar redesign antes do gate recomendado R3; isso não aprova a matriz multipar. Revisar visual, navegação e preservação de mídia antes de integrar. Nenhum push ou merge em main foi realizado. Branch inclui commits da auditoria; revisar separadamente docs e UI. Sistema de personalização fora desta entrega.
