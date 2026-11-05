# Voz, vídeo e Soundboard — MEDIA-001

05/11/2026 · Codex/OpenAI · `feat/media-experience-2026-11-05` · base `6a72051` (PR #4). Recuperação local: `recovery/pre-media-experience-2026-11-05`. Entrega para revisão; commit registrado no ACTIVITY_LOG após criação. Sem push, merge, novas bibliotecas ou alteração da autenticação.

## Comportamento entregue

Os motores PeerJS/WebRTC e WebAudio existentes continuam sendo utilizados. Não houve reconstrução de chamadas, alteração de codecs/gate/SDP ou instalação de componentes.

- Dock com estados pressionados/ocupados, menus de microfone/câmera/saída, nomes acessíveis e mensagens de erro. Saída é oferecida quando `HTMLMediaElement.setSinkId` existe; falhas são apresentadas. Soundboard usa `AudioContext.setSinkId` quando disponível, com saída padrão como limite em runtimes sem essa API.
- Palco existente com expandir/reduzir/minimizar, participantes e nomes de quem está falando; cards com qualidade individual de voz (RTT e perda), coletada a cada 2 s. Métricas ausentes são explicitamente indisponíveis; não são números fictícios de CPU/GPU.
- Volume individual passa a exibir 0–100%, coerente com `HTMLAudioElement.volume`. Preferências antigas acima de 1 são limitadas visualmente; novos ajustes salvam no intervalo válido. Não se reintroduziu o roteamento WebAudio de reprodução que a outra IA havia removido por latência.
- Captura de microfone somente ao entrar na voz, sem aquisição automática no App ou ao abrir configurações. Saída encerra tracks brutas/processadas e contexto, mantendo DataConnections/chat. Erro de permissão não marca entrada na chamada.
- Troca de microfone/câmera mantém a captura anterior até a nova estar pronta; `replaceTrack` preserva a chamada, com rollback se falhar. Capturas que terminam após saída/troca de sala são descartadas. Desconectar o microfone encerra a voz com aviso; câmera encerrada atualiza seu estado.
- Webcam e tela têm handles de entrada e saída separados; parar mídia local não fecha recebimento. Entrada tardia em voz recebe a câmera ativa. Eventos antigos de conexões substituídas não atualizam a sessão nova. Chamadas de saída exigem ambos em voz e permissões locais existentes.
- Reconexão de sinalização usa backoff de 1–15 s, reaproveitando PeerJS. Fechamento/falha de voz ou desconexão persistente por 8 s tenta nova chamada sem refazer o chat. Timers e capturas são invalidados ao sair. Validação desse fluxo é controlada/local; não há garantia de recuperação em toda rede/NAT.
- Contextos de VAD remoto são registrados e fechados. Detecção de fala tem sustentação de 180 ms; pacotes de fala e atualizações dos participantes só ocorrem nas transições. App/palco/cards usam seletores menores para reduzir rerenders provocados pelo medidor do microfone.
- Compartilhamento existente preservado: picker Electron e fallback ao seletor nativo do navegador pelo dock. Troca de fonte libera a anterior, cancelamento mantém a transmissão anterior. Presets são solicitações, não garantia de 4K/60 FPS ou áudio do sistema. Deafen é respeitado também pelos vídeos de tela, em grade e foco.

## Soundboard

Painel com shadcn Popover/Tabs/Dialog/DropdownMenu/Button/Input/Slider, tokens e Tailwind existentes. Busca, categorias livres (até 32 caracteres), favoritos, edição do nome/emoji, volume por botão, mover para o início, importação existente, exclusão de sons próprios e prévia apenas local. Sons nativos recebem registros de preferências no banco existente para que favoritos persistam; o conteúdo de síntese permanece o mesmo.

Campos aditivos `category?` e `order?` em SoundboardClip, sem novo banco/migração destrutiva. Defaults: Clássicos e Meus sons. Nome até 60 caracteres, emoji até 12. Ordem usa número antes do menor índice atual. Cache de áudio decodificado limitado a 24 entradas. `stopAll` invalida decodificações pendentes; nós de reprodução são desconectados ao terminar. Volume master/por clip é aplicado ao iniciar cada som.

Deafen muda o ganho do retorno local, inclusive sons já iniciados; não corta o envio de Soundboard aos participantes. Mute do microfone continua antes da entrada do Soundboard no destino de voz. Prévia não gera mensagem nem injeta áudio no envio. A interface informa quando reprodução é local ou enviada à chamada.

Exibição de eventos normal/compacta/somente atividades usa a mesma chave `cbshub-chat-sounds` e store compartilhado pelo ChatPanel e Soundboard. Ocultar eventos não desativa o áudio. Arquivos e organização são locais, sem sincronização de biblioteca entre dispositivos.

Permissões seguem bloqueios e privacidade de chamadas já existentes. Eventos visuais validam sessão/identidade e limites de texto. Não há administrador autenticado de sala nem ACL de Soundboard no backend. Voz e efeitos compartilham uma faixa: não é possível bloquear apenas efeitos recebidos sem também afetar a voz desse participante. O controle individual/bloqueio aplica-se ao participante.

## Arquivos e fronteiras

- `src/lib/webrtcEngine.ts`, `mediaState.ts`, `audioPipeline.ts`: lifecycle, estados, qualidade, seleção e reconexão. Processamento acústico original mantido; pipeline só acrescenta sustentação de fala e encerramento das tracks processadas.
- `src/components/{CallControlDock,CallStagePanel,UserCallCard,CallStatus,SettingsModal,ScreenPickerModal,MembersPanel}.tsx`, `src/hooks/useMediaOutput.ts`, `src/App.tsx`: interface, saída de áudio das telas, foco e assinaturas de estado.
- `src/components/SoundboardPopover.tsx`, `src/lib/{soundboardEngine,storageDb}.ts`, `src/types/cbshub.d.ts`: biblioteca e reprodução.
- `src/chat/{ChatPanel.tsx,soundPreferences.ts}`: preferência de eventos compartilhada; journal/protocolo de mensagens preservados.
- `src/store/useHubStore.ts`: limite de volume individual alinhado à reprodução.
- `tests/media-{smoke,engine,transport}.cjs`, `tests/profile-smoke.cjs`, `tests/README.md`: evidências e preparação de testes. Os imports assíncronos do probe de perfis agora são feitos antes da espera síncrona pela sessão.

## Validação e limites de evidência

| Comando/cenário | Resultado |
| --- | --- |
| `npm run build` | Passou TypeScript/Vite/Electron. Aviso de bundle >500 kB e K01 (dois outputs de preload) continuam. |
| `node tests/media-smoke.cjs` | Passou: nenhuma captura no arranque, permissão negada, entrada/câmera/mute, falha de troca preserva dispositivo, câmera substituída, preview, favorito/edição/recarga, saída liberando tracks e preservando chat, captura pendente cancelada. Dispositivos sintéticos. |
| `node tests/media-engine.cjs` | Passou: sinal WebAudio medido com mic mudo, Soundboard pós-gate, isolamento da prévia, deafen de sons ativos, stopAll; adapters de chamadas exercitam volume/stats, vídeo bidirecional independente, entrada tardia, falhas/retries e teardown. Stats e conexões são simulados; sinal de áudio é real/sintético. |
| `node tests/media-transport.cjs` | Tentado, bloqueado: Chromium não ofereceu candidatos ICE locais, conexão ficou `new`; **não passou**. Script mantém falha explícita e pode ser executado em ambiente com WebRTC disponível. Não usa PeerJS Cloud: adapter negocia SDP entre dois contextos. |
| `node tests/chat-model.cjs` | Passaram 7 grupos de validação. |
| `node tests/chat-smoke.cjs` e `node tests/chat-drafts.cjs` | Passaram envio/ACK, edição/exclusão/reação, reconciliação lógica, histórico, rascunhos, falha de disco, retenção e eventos Soundboard. Ponte local, sem rede real. |
| `node tests/profile-smoke.cjs`, `node tests/studio-smoke.cjs`, `node tests/redesign-smoke.cjs` | Passaram as regressões disponíveis de edição/persistência/privacidade, temas, layout e viewports. |
| `node tests/theme-validation.cjs`, `node tests/profile-validation.cjs` | Passaram 8 e 7 grupos, respectivamente. |

As tentativas iniciais tiveram: atributo JSX duplicado (corrigido antes da build); espera prematura do probe de recarga/perfis (corrigida com espera síncrona); adapter de transporte sem identidade porque PeerJS externo não abriu (fixture corrigida); negociação sem candidatos ICE (continua bloqueada). Não converter essas falhas em aprovação de chamadas entre máquinas.

Não foram testados: dois dispositivos físicos, saída em fone específico, hotplug real, picker Electron/OS e áudio do sistema, rede externa/NAT/TURN, queda física e reconexão, 3–6 participantes, performance perceptiva/4K60, Windows/release. A skill cloud confirmou rede restrita sem domínio PeerJS liberado. O bloqueio não foi contornado.

## Matriz obrigatória para integração de mídia

1. Dois dispositivos/perfis independentes, mesma sala: voz bilateral, indicadores, mic/câmera padrão e alternativos, negação/revogação de permissão, saída em alto-falante/fone suportado e volume individual.
2. Ambas câmeras e ambas telas simultâneas: desligar uma preserva a outra; terceiro participante entra e recebe mídias; sair da voz mantém chat; nenhuma captura após saída.
3. Soundboard nativo e arquivo importado: mic mudo, deafen durante som longo, preview sem transmissão, stopAll, volume, favorito/categoria após reiniciar e três modos de eventos.
4. Cortar rede por 5 e 30 s e restaurar; fechar/reabrir um participante; conferir recuperação de voz, câmera/tela e histórico sem duplicações. Repetir em redes diferentes/TURN quando disponível.
5. Conferir RTT/perda contra getStats e testar degradação real. ABR de tela e telemetria de recepção continuam globais (K07); não declarar adaptação individual multipar.

A entrega está pronta para revisão de código e validação manual; aprovação de integração/distribuição de mídia depende dessa matriz. Não altera dependências nem resolve K01/K16.
