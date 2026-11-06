# HOTFIX-005 — estabilidade e experiência desktop

06/11/2026 UTC · Codex/OpenAI · `hotfix/stability-desktop-2026-11-05` · base `b8983d6` (PR #12). Candidato de revisão `2.0.0-rc.4`, sem alteração de dependências. Recuperação: tag local `recovery/pre-stability-hotfix-2026-11-05`. Main preservada. Este documento complementa DESKTOP_REFINEMENT.md e VOICE_RECOVERY.md; registros anteriores permanecem históricos.

## Auditoria e diagnóstico

As oito áreas já tinham implementação parcial em DESKTOP-004. Foram preservados os componentes, streams, bancos locais, SVG oficial de dois paths, shadcn/ui, Tailwind e arquitetura P2P. Não há autenticação/ACL de servidor nesta etapa.

Foram encontrados caminhos concretos capazes de impedir recuperação: a condição antiga encerrava a tentativa quando o PeerJS abria e os canais conhecidos pareciam disponíveis, sem confirmar a descoberta ou o tráfego da mídia; o proprietário podia continuar confiando em um beacon desconectado; consultas de diretório não tinham um único ciclo com prazo/identidade explícitos. Um RTCPeerConnection `connected` também pode conter contadores antigos sem indicar retomada de áudio. São causas demonstráveis no código e em falhas controladas, não prova de que todas as quedas relatadas no computador do usuário tenham a mesma origem.

## Rede e estados

- Ciclo separado em sinalização, descoberta, mídia e falha. Diretório exige resposta válida; uma conexão de sinalização aberta sozinha não encerra recuperação.
- Beacon desconectado é reconectado; construção pendente tem watchdog de 12 s. Listener de conexões é registrado uma vez. Consulta de diretório tem timeout de 8 s, identidade/geração, fechamento idempotente, limite de participantes e IDs da sala.
- Recuperação conserva clientIds esperados, mute/deafen e captura. Não inicia voz se o usuário saiu. Reiniciar um Peer invalida callbacks antigos antes de destruí-lo.
- Fluxo de áudio é confirmado por avanço de pacotes recebidos e bytes enviados, stream remoto e estado conectado. A primeira coleta de uma conexão antiga estabelece uma nova base; contadores acumulados não bastam. Isto confirma atividade do enlace, não audição humana.
- Sem atividade de mídia confirmada após descoberta e 10 s, a sessão de áudio é reconstruída pelos retries existentes. A negociação ICE continua sob controle do PeerJS ao reconstruir a sessão; não foi adicionado restartIce avulso que contorne as ofertas/SDP da biblioteca. Os retries continuam limitados; oito tentativas globais com backoff/jitter, seis de mídia, cancelamento e ação manual. Ticks de estatística não reativam o estado infinito após esgotamento.
- Participante que efetivamente sai é retirado da espera de mídia. Cancelar/sair limpa consultas e timers e invalida callbacks obsoletos.
- Cards e sidebar exibem estado/RTT do enlace observado pelo peerId; sem métricas inventadas e sem atribuir a internet local ao outro usuário. Estado anunciado de mute/câmera continua sendo a informação enviada pelo participante. Tela completa só se aplica à interrupção local persistente, sem enlace utilizável; falha isolada remota não bloqueia o aplicativo. Ela continua durante redescoberta/mídia após o socket abrir e permite cancelar ou sair.

## Desktop e interface

- Bandeja preserva BrowserWindow, captura e chamadas. Menu inclui abrir, mostrar/ocultar, estado resumido e encerrar. Aviso na primeira ocultação tem confirmação persistida, proteção de pedidos simultâneos e encerramento do SO. IPC recebe somente dois booleanos do renderer principal. Sem bandeja disponível, continua o fallback de minimizar. Não há nova instância nem ícone duplicado.
- Grid calcula proporção 16:9 com largura, altura e gap real, removendo o piso de 80 px que causava overflow. Espaçamento adapta-se a palcos mínimos; avatar/nome/indicador reduzem com container queries. Redimensionador e spotlight preservados.
- Perfil e Aparência mantêm os editores embutidos e montados durante troca de abas. Temas Clássico, Moderno Roxo, Sakura Dream e Velvet Nocturne ficam em Aparência. Rascunhos são preservados e fechar/Escape exige descarte explícito em uma seção inline, sem outro Dialog. Preferências de aplicação imediata continuam imediatas.
- Editor de Efeitos Sonoros conserva o original e agora persiste início/fim do corte; reabrir recupera o intervalo. Alterar o intervalo exige reaplicar antes de salvar, evitando salvar áudio anterior com controles novos. Cancelar conserva o som salvo; escrita e cache continuam usando os caminhos existentes. Nomes internos não foram renomeados.
- Splash continua ligada ao preparo real, sem atraso artificial, paths oficiais intactos, pausa completa de 364 ms e preferência de movimento reduzido. Script síncrono próprio aplica apenas HEX/modo validados do tema salvo antes do React, sem executar CSS/JS fornecido pelo usuário.

## Arquivos

Rede: `src/lib/webrtcEngine.ts`, `src/lib/mediaState.ts`, `tests/hotfix-recovery.cjs`.

Desktop: `electron/main.ts`, `electron/preload.ts`, `electron/background.ts`, `src/App.tsx`, API em `src/types/cbshub.d.ts`, `tests/background-notice.cjs` e `tests/desktop-security.cjs`.

Interface: `CallStagePanel`, `CallStatus`, `ConnectionScreen`, `UserCallCard`, `SettingsModal`, `AddSoundDialog`, `SoundboardPopover`, `AudioTrimEditor`, `useElementSize`, `callGrid`, `settingsDrafts`, `ProfileDialog`, `StudioDialog`, `StudioProvider`, `src/index.css`, `index.html`, `public/boot-theme.js`. Metadados aditivos de corte no tipo SoundboardClip. Testes de navegação existentes foram ajustados para a aba Aparência; novos testes `hotfix-layout.cjs` e `boot-theme.cjs`.

## Validação e limitações

Executado no código final rc.4:

- `npm run build` (inclui TypeScript): PASSED. Renderer ~716,32 kB/gzip ~211,73 kB. Avisos preexistentes customResolver/freeze/chunk >500 kB; aviso adicional do script clássico boot-theme.js, que é copiado de public e executado antes do módulo, intencionalmente sem bundling.
- `npm test`: 31 scripts, **30 PASSED, 1 BLOCKED**, nenhuma falha restante. Exit 1 corresponde ao bloqueio de media-transport, pois Chromium não disponibilizou candidatos ICE locais. Resumo reproduzido em hotfix-005-results.json.
- Novos testes: hotfix-recovery (quedas/controladores/ACK/contadores frescos/reconstrução/limites/cancelamento), hotfix-layout (96 geometrias, seis cards em três larguras, rascunhos/descarte/remote sem overlay), background-notice (aviso único/concorrência/persistência/quit) e boot-theme (tema inicial/JSON inválido/injeção).
- Regressões aprovadas incluem chat/histórico/rascunhos por adaptadores, perfis/privacidade local/P2P, Studio/importação/contraste/reload, áudio sintético/corte/PTT/dispositivos, câmera/tela, logo, controles/teclado/layout, telemetria e ciclo de processo Electron. Nenhuma dessas provas equivale a transporte de mídia físico.
- `npm audit --omit=dev --json`: zero vulnerabilidades reportadas nas dependências de produção, executado nesta etapa.
- `git diff --check`: PASSED.
- Empacotamento `electron-builder --linux --dir -c.electronDist=node_modules/electron/dist`: PASSED. Executável rc.4 em `dist-package/linux-unpacked/cbshub`; distribuir diretório completo. `CBSHUB_TEST_EXECUTABLE=... node tests/electron-smoke.cjs`: PASSED (abertura/reload, logo, CSP, preload sandboxed e captura sintética). Sem instalador Windows, assinatura ou publicação de binário. Avisos do builder sobre author/referências duplicadas permanecem. `npm ci` não foi repetido; dependências não mudaram.

Commits de conteúdo: e573b61, be773a3, 6194b4a, df71b48, f489dd3 e 3ad21b0. Rodadas anteriores e falhas corrigidas estão em ACTIVITY_LOG.md, inclusive fixture legado e interferência de HMR; não foram ocultadas pelo resultado final. Logs locais: `build/test-results.json`, `build/test-logs/`; estes artefatos são ignorados pelo Git. Nenhum teste manual deve ser presumido a partir de um passe automatizado.

Pendente obrigatório: audição entre dois computadores/redes após queda curta/prolongada, servidor indisponível, ICE/STUN/TURN, webcam/tela após recuperação e microfones reais. O teste controlado usa adaptadores de transporte e captura sintética, sem substituir esse gate. Windows exige teste físico de ícone/menu/aviso da bandeja, fechar/restaurar durante chamada e encerramento do SO. Primeira pintura e leitor de tela também exigem revisão desktop. Sem evidência suficiente para produção.

## Integração e retomada

Revisar commits de rede separadamente dos commits visuais e de Electron. Não reintroduzir conclusão de recuperação apenas em `peer.open`, default de ping/FPS ou confirmação baseada em contadores antigos. Não remover `originalAudioBlob` nem os metadados de intervalo. API preload agora tem dez métodos. Não remontar os editores ao mudar abas. Parar o servidor de renderer antes de empacotar (HTML de saída pode provocar reload do Vite); reiniciar antes dos testes após alterações no motor para evitar módulos duplicados por HMR. Próximo gate é a matriz física, não um merge automático.
