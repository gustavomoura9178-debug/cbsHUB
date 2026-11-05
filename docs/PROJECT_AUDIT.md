# Auditoria do cbsHUB v2.0

Data: 05/11/2026 (America/Sao_Paulo). Responsável: Codex/OpenAI.
Branch: `audit/cbshub-v2-2026-11-05`. Base auditada: `5deab40aa1629a975dc72588b658569b21494c23`.

## Parecer

A estrutura de colaboração e a base de desenvolvimento local estão preparadas. O projeto pode iniciar o planejamento do redesign, mas **a implementação do redesign deve aguardar a estabilização e a validação das funções essenciais**. Não há evidência suficiente para declarar chamadas, sincronização entre máquinas ou compartilhamento 4K60 protegidos contra regressão.

Esta fase não mudou interface, motores, testes existentes, bibliotecas, manifesto ou lockfile. Foram criados somente os nove documentos solicitados no repositório. Instalação, scripts auxiliares, logs, perfis de teste e backup ficam fora dos fontes ou em diretórios já ignorados.

## Escopo e método

Inventário de todos os arquivos versionados; leitura dos documentos SDD/plano/progresso, configuração, contratos, componentes, estado e motores; rastreamento dos fluxos de chat, mídia e persistência; inspeção Git local/remota; instalação pelo lockfile; compilação; probes funcionais locais em Chromium e Electron; consulta `npm audit`. Nenhum teste entre máquinas foi executado. A análise estática identifica riscos, mas não demonstra por si só falhas de qualidade audiovisual ou exploração de vulnerabilidades.

Não foram encontrados README, AGENTS.md aplicável, CI, suite de testes, script `test`/`lint`, `components.json`, pin de Node/npm, backend próprio ou migrations de servidor. A documentação antiga afirma fases concluídas; essas afirmações não foram tratadas como resultados da auditoria atual.

## Estrutura completa por responsabilidade

| Caminho | Conteúdo e responsabilidade |
| --- | --- |
| `package.json`, `package-lock.json` | Aplicativo ESM; scripts dev/build/preview/package; dependências fixadas pelo lockfile v3; versão do pacote ainda 1.0.0 |
| `vite.config.ts`, `tsconfig.json` | React/Tailwind/Electron, alias `@`, build do main e preload, TypeScript strict sem emissão |
| `index.html`, `src/main.tsx`, `src/App.tsx` | Documento pt-BR, montagem React/StrictMode, shell, inicialização de sala/microfone e modais |
| `electron/main.ts`, `electron/preload.ts` | Janela nativa, IPC, captura desktop, ponte `window.cbsHubAPI` |
| `src/components/ui/` | 13 primitivos locais shadcn/ui/Radix, detalhados abaixo |
| `TitleBar`, `LeftSidebar`, `RoomTopBar` | Janela, salas recentes, identidade, participantes, volume e controles de chamada |
| `CallStagePanel`, `UserCallCard`, `CallControlDock` | Palco, foco, cards/webcam/tela, seleção de dispositivos, mute/deafen |
| `TextChatSection`, `EmojiPickerPopover` | Compositor, feed, reações, digitação, links, emojis e recentes |
| `SoundboardPopover`, `AddSoundDialog` | Sons nativos/customizados, busca, favorito, preview e importação |
| `SettingsModal`, `ScreenPickerModal` | Configurações, perfil, dispositivos e seleção da fonte/resolução/FPS |
| `src/store/useHubStore.ts` | Zustand: preferências serializáveis, estado de sessão, participantes, streams e chat |
| `src/lib/webrtcEngine.ts` | PeerJS, diretório beacon, mesh, DataConnections, chamadas e telemetria/ABR |
| `src/lib/audioPipeline.ts`, `sdpMunger.ts` | WebAudio, gate, filtros, mute e ajustes de SDP/bitrate |
| `src/lib/soundboardEngine.ts`, `sounds.ts` | Síntese de 8 sons, decodificação/cache e efeitos de sistema |
| `src/lib/storageDb.ts`, `utils.ts` | IndexedDB/fallback em memória; `cn` com clsx + tailwind-merge |
| `src/types/cbshub.d.ts`, `src/vite-env.d.ts` | Contratos de mídia, presença, mensagens, signaling e IPC; tipos Vite |
| `src/index.css` | Tokens dark, mapeamento Tailwind 4, estilos base, scrollbar e drag/no-drag |
| `.env.example`, `.gitignore` | Exemplos TURN e exclusão de segredos, dependências, builds e logs |
| `SDD_CBSHUB_V2.md`, `PLANO_DE_ACAO_SDD.md`, `PROGRESS.md` | Especificação e histórico anterior, preservados; contêm divergências da implementação |
| `docs/` | Auditoria e oito documentos compartilhados criados nesta fase |

Todos os componentes de produto acima estão em `src/components/*.tsx`. Artefatos `node_modules/`, `dist/`, `dist-electron/` não são fontes. Não há outro serviço de aplicação a instalar.

## Tecnologias e serviços

Frontend React 18 + TypeScript + Vite 5, Tailwind CSS 4, Radix/shadcn/ui, Lucide e Zustand. Aplicativo desktop Electron 33; electron-builder 25 configura NSIS e portable para Windows. Na instalação atual: Electron 33.4.11, Vite 5.4.21, Tailwind 4.3.4, Node 24.22.1 e npm 11.9.0. Nenhuma biblioteca foi substituída.

Não há API HTTP própria, autenticação central ou banco remoto. O main process Electron atende IPC local e não constitui um backend de salas. PeerJS usa o serviço público `0.peerjs.com:443` para sinalização. O beacon é um peer temporário da própria sala, não um servidor persistente. WebRTC transporta áudio/vídeo e DataChannel transporta chat/presença. A malha pretende atender 3–6 participantes; o limite de seis apenas corta a lista retornada pelo diretório, sem controle efetivo de admissão.

Persistência: IndexedDB `cbshub_local_db` v1, stores `messages` (índice `by_room_time`) e `soundboard_clips` (Blobs até 5 MiB). Retenção pretendida de 500 mensagens por sala. localStorage guarda `cbshub-user-preferences` e `cbshub-recent-emojis`; streams não entram em `partialize`. Histórico P2P depende de pares que ainda possuam dados locais, sem backup ou autoridade central.

## Base shadcn/ui preservada

Os componentes estão copiados no código, como é habitual no shadcn/ui; a ausência de um pacote chamado shadcn não indica ausência dessa base.

| Primitivo | Implementação/uso encontrado |
| --- | --- |
| button | Slot + CVA; variantes default/destructive/outline/secondary/ghost/link/success; amplamente usado |
| badge | CVA e tokens; disponível, sem import nos componentes atuais |
| avatar | Radix Avatar; disponível, mas avatares de produto são divs locais |
| dialog | Radix, Portal, overlay, título, descrição e botão Close; 3 modais |
| dropdown-menu | Radix, itens/checkbox/radio/submenu; seleção de câmera no dock |
| popover | Radix e Portal; volume, perfil, dispositivos, emojis e Soundboard |
| tooltip | Radix + TooltipProvider no App; não encapsula Content em Portal |
| scroll-area | Radix; sidebar e emojis; feed do chat usa div rolável |
| slider | Radix, um Thumb; volumes e ganho |
| switch | Radix; opções de áudio e captura |
| tabs | Radix; configurações, fontes, emojis e Soundboard |
| input | Input React com forwardRef, tokens e foco |
| separator | Radix; separação visual em controles e layout |

Não recriar esses primitivos nem trocar de kit visual. Algumas superfícies, avatares, badges e botões ainda usam HTML/classes locais; isso é uma oportunidade de consistência incremental, não justificativa para reconstrução. Há botões de ícone sem nome acessível explícito, previews de tela clicáveis apenas por mouse e popovers disparados por wrappers div; a auditoria completa de teclado/leitor de tela permanece pendente.

## Estilos e temas

`src/index.css` importa `tailwindcss` e `tw-animate-css`, define tokens HSL completos em `:root` e faz o mapeamento com `@theme inline`. O tema é escuro fixo (`color-scheme: dark`), sem alternância claro/escuro. Não existe `tailwind.config.js`; referências a ele e `tailwindcss-animate` nos documentos antigos estão desatualizadas.

Existem cores fixas em componentes (`bg-[#111114]`, `bg-[#141418]`, zinc/emerald etc.) e no body de `index.html`. Fallbacks `hsl(var(--primary))` duplicam `hsl()` porque o token já contém uma cor completa. Sidebar fixa de 240px; janela mínima 1100×700; responsividade parcial. `user-select: none` é global, com seleção reativada no chat. Regras de drag/no-drag preservam os controles Electron. Não houve mudança visual nesta fase.

## Funcionalidades: implementação versus evidência

| Área | O que existe | Situação verificada |
| --- | --- | --- |
| Shell e modais | Sidebar, topbar, palco, configurações shadcn | Renderer e Dialog abrir/Escape passaram |
| Chat | Composição, links, emojis, reações, digitação e histórico | Envio pelo compositor, estado/IndexedDB após reload e reação local passaram; entrega remota não testada |
| Salas | Slugs, recentes, criação aleatória, beacon e mesh | Código presente; descoberta, isolamento e recuperação remotos não validados |
| Voz | Pipeline 48kHz, filtros, gate, compressor, mute e seleção de dispositivos | Sinal sintético no pipeline validado; voz real e multipar não testadas |
| Webcam | Captura e chamadas de vídeo por par | Implementada; riscos para entrada tardia e duas direções; sem validação remota |
| Tela | Picker Electron, presets até 4K60, loopback e ABR | Código presente; captura/qualidade real e ABR multipar não validados |
| Soundboard | 8 sons, WAV/MP3/OGG e outros formatos, preview, mixagem e stopAll | 8 sons carregados; CRUD de WAV e sinal no stream com mic mudo passaram; favoritos nativos falharam |
| Desktop | Preload, controles de janela, always-on-top | API disponível em produção e no helper dev; geração do preload no dev padrão apresentou falha |
| Distribuição | electron-builder, NSIS/portable | Não empacotado nem testado no Windows |

O SDD ainda pede VoiceAvatar compartilhado, speakingLevel, hangover VAD de 180ms, timer de chamada e toggle da sidebar; não estão integralmente implementados. O código usa gate por limiar e supressão nativa do navegador: não há modelo neural/Krisp SDK, apesar dos rótulos.

## Evidências e testes executados

| Verificação | Resultado real |
| --- | --- |
| Git inicial | Limpo, branch `work`; HEAD e main remota em `5deab40`; somente main listada no remoto |
| Recuperação | Tag e bundle completos; `git bundle verify` passou |
| `npm ci` padrão | Falhou: peer `electron-builder-squirrel-windows` e transitivos ausentes do lock |
| `npm ci --legacy-peer-deps` sem ajuste Electron | Resolução avançou; download Electron falhou EAI_AGAIN por não usar o proxy |
| `ELECTRON_GET_USE_PROXY=1 npm ci --legacy-peer-deps ...` | Passou: 515 pacotes, lockfile intacto, TLS/checksums preservados |
| `npm run build` | Passou; TypeScript + renderer + main + preload; aviso JS ~610,15 kB minificado |
| `npm run dev` padrão no cloud | Electron falhou por ausência de DISPLAY; Vite encerrou com exit 0, portanto exit 0 não comprovou startup |
| Headless com artefato dev | Preload falhou com `Cannot use import statement outside a module` |
| Diagnóstico de configuração | `resolveViteConfig` resulta em formatos `["es","cjs"]`; ambos gravam `preload.cjs` |
| Nova build de produção + Electron headless | Renderer e `window.cbsHubAPI` disponíveis nesta execução; não elimina a colisão de outputs |
| Helper renderer + Electron headless com VITE_DEV_SERVER_URL | Passou: página e os seis métodos da API expostos |
| 6 grupos funcionais locais no Chromium | Passaram: renderer/8 sons; envio/persistência; modal; reações; WAV/CRUD; mixagem/stopAll |
| Probe de sinal WebAudio | RMS: mic mudo 0; WAV ~0,0548; após stopAll 0; não mede qualidade perceptiva nem transmissão |
| 2 probes de defeitos | Favorito nativo sem persistência e `sendData(peer_state_sync)` sem broadcast reproduzidos |
| `npm audit --json` | Exit 1: 19 dependências sinalizadas (1 crítica, 13 altas, 5 moderadas); não houve audit fix |
| HTTPS para PeerJS | CONNECT 403 pela política atual; P2P não validado |

As duas primeiras tentativas do smoke test esperavam ver o texto no feed offline e expiraram. Diagnóstico: o compositor salva, mas `TextChatSection` esconde o feed quando `isConnected=false`. A verificação final passou conferindo o estado e IndexedDB após reload. Isso **não** foi registrado como entrega remota bem-sucedida. Chromium usou microfone sintético e bloqueio de destinos externos; não houve mock de resultados de armazenamento/áudio. Não existe suite versionada de testes no projeto.

Logs, script de probes e JSON estão em `/workspace/cbshub-onboarding/`; evidências resumidas aqui são portáveis. Eles não foram commitados como testes do produto.

## Principais pendências e decisão de redesign

Ver [KNOWN_ISSUES](development/KNOWN_ISSUES.md) para evidência, severidade e reprodução. Bloqueadores do início de implementação visual: preload previsível; baseline real de 3 participantes com chat, voz, webcam, tela, Soundboard e saída de voz mantendo texto; tratamento dos riscos prioritários de lifecycle/isolamento; aprovação do plano de atualização de dependências.

A documentação e o [ROADMAP](development/ROADMAP.md) permitem planejar o redesign. A execução deverá ocorrer por componentes, preservando shadcn/ui, Tailwind e contratos existentes, depois do gate R3. Não há aprovação implícita para substituir bibliotecas.

## Configuração cloud e Git

Salvos no rascunho: `install_script`, `start_skill` e domínio adicional `0.peerjs.com`, preservando presets de pacotes. O rascunho exige revisão/salvamento e publicação nas configurações do ambiente. Isso não aplicou a rede atual e não prova restauração em uma nova tarefa.

TURN opcional não está configurado; as quatro variáveis VITE_METERED_* não estavam presentes. Não foram solicitadas credenciais para build/testes locais. Uma liberação HTTPS do PeerJS não autoriza automaticamente STUN/UDP/TURN ou tráfego WebRTC.

Branch de trabalho e tag de recuperação locais; nenhuma alteração ou push para main. Ver [AI_HANDOFF](development/AI_HANDOFF.md) para retomada segura e [ACTIVITY_LOG](development/ACTIVITY_LOG.md) para commits e arquivos.
