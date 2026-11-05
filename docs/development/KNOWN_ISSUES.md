# Problemas conhecidos

Data: 05/11/2026 (America/Sao_Paulo). Responsável: Codex/OpenAI.
Branch: `audit/cbshub-v2-2026-11-05`. Base auditada: `5deab40aa1629a975dc72588b658569b21494c23`.

P1 = resolver/validar antes de implementar redesign; P2 = corrigir em tarefa delimitada; P3 = melhoria. “Reproduzido” significa executado nesta auditoria; “estático” significa caminho de código identificado, sem teste remoto que comprove o sintoma.

| ID | Prioridade / evidência | Problema, localização e impacto | Próxima validação |
| --- | --- | --- | --- |
| K01 | P1 / reproduzido | `vite.config.ts:35` + merge de `vite-plugin-electron`: formatos ES e CJS escrevem `preload.cjs`. Dev gerou import/export em .cjs e Electron rejeitou. Produção passou em outra execução, portanto build verde não elimina colisão. | Fixar uma única saída CJS por configuração suportada; repetir dev, produção e reload; verificar seis métodos IPC. Não foi corrigido. |
| K02 | P1 / risco estático | `App.tsx:17`, `main.tsx` StrictMode e `webrtcEngine.ts:119,1203`: inicializações assíncronas de sala/microfone sem cancelamento ou identificação de geração. Effects dev repetem, chamadas rápidas podem continuar depois de leaveRoom. | Duplo mount, troca rápida de sala/dispositivo e teardown durante getUserMedia/IndexedDB; contar peers/tracks/contextos. |
| K03 | P1 / estático | `webrtcEngine.ts:553,573,588`: casts de SignalingPacket sem validação runtime; chat_sync_request aceita roomId arbitrário, sem verificar sala da sessão. Pode retornar histórico local de outra sala a um par conectado. Resposta pode substituir o feed ativo sem conferir sala. | Dois perfis/salas, pacote de sala divergente e payload inválido; negar sem ler dados de outra sala. Sem teste de exploração realizado. |
| K04 | P1 / estático | `webrtcEngine.ts:860` cria AudioContext/source locais não registrados na sessão; teardown cancela interval mas não tem referência para fechar esse ctx. `SettingsModal.tsx:76` obtém stream de permissão e não para tracks. | Abrir/fechar modal e entrar/sair de chamadas várias vezes, medir tracks/contexts vivos. |
| K05 | P1 / estático | `setupLocalMicrophone` captura e engole erro; `joinVoiceCall` marca inVoiceCall mesmo sem microfone. `leaveVoiceCall` não encerra captura local/pipeline. Há aquisição automática no App antes de entrar em voz. | Negar permissão e retirar dispositivo; saída da voz deve ter semântica explícita de captura e estado. |
| K06 | P1 / risco estático | `session.webcamCall` e `session.screenCall` guardam um único handle para entrada/saída; `stopScreenShare` fecha handles da sessão sem distinguir direção. Webcam é enviada só a quem está na voz ao ligar; peer_state_sync só reenvia tela, não webcam. | Webcam bidirecional, entrada tardia, dois compartilhamentos simultâneos; encerrar um sem interromper o outro. |
| K07 | P2 / estático | `webrtcEngine.ts:1322` mantém um único timer ABR e o substitui para cada destinatário; receiverStats e telemetry também globais. O último par sobrescreve os demais. | 3 participantes, perdas diferentes e foco alternado; ABR/stats por stream/par. |
| K08 | P2 / estático | `webrtcEngine.ts:799,854,1290` limita HTMLAudioElement.volume a 1; slider/store aceitam 2. Sem GainNode de reprodução, 200% não amplifica além do volume original. | Sinal com mesma entrada em 100% e 200%; reconciliar implementação e contrato sem reintroduzir atraso. |
| K09 | P2 / reproduzido | `SettingsModal.tsx:128` envia peer_state_sync via sendData, mas `webrtcEngine.ts:982` só trata nickname/speaking. Zero broadcasts no probe; cor só muda localmente até outro envio de estado. | Alterar avatar e observar segundo peer sem mudar outra opção. |
| K10 | P2 / reproduzido | `storageDb.ts:346` só alterna favorito se registro já existir. `loadAllClips` não grava defaults nativos. Favorito de som nativo em perfil novo não muda; favorito customizado passou. | Persistir override nativo e testar reload, mantendo presets. |
| K11 | P2 / estático | Sync exclui IDs conhecidos, então não reconcilia reações alteradas offline. Merge de reações usa união sem tombstones; toggle não é idempotente. `saveMessageBatch` limita retorno a 500 mas não apaga registros antigos no banco nesse caminho. | Reconexão após reação/removal, pacote duplicado e batches sucessivos >500. |
| K12 | P2 / estático | Deafen só atualiza elementos de voz. Vídeos de tela em `UserCallCard.tsx:210` e `CallStagePanel.tsx:253` não consultam isDeafened. Sons já iniciados mantêm rota local e preview também ignora deafen (`soundboardEngine.ts:185,210`). | Ativar deafen durante tela com áudio e WAV longo; definir e testar semântica de silenciar toda saída. |
| K13 | P2 / estático | VAD a cada 45ms chama broadcast mesmo sem transição; remoto a 50ms, limiar -42dB, sem hangover. SDD pede -48dB/180ms/speakingLevel/VoiceAvatar, ausentes. Stores amplas + persist podem causar trabalho frequente. | Medir pacotes/renders e calibrar sem prometer “neural”: implementação é gate + noiseSuppression do browser. |
| K14 | P2 / estático | main envia `cbs:window-state-changed`, mas preload não expõe assinatura e TitleBar mantém boolean local. Mudança via SO pode dessincronizar botão maximizar/restaurar. | Maximizar/restaurar por SO e pela UI. |
| K15 | P2 / revisão estática | `sandbox:false`, ausência de CSP explícita, setWindowOpenHandler/will-navigate e validação de origem/argumentos IPC. contextIsolation=true/nodeIntegration=false são preservados. Não é prova de exploração. | Revisar trust boundaries/navegação/permissões antes de distribuição, sem quebrar captura/preload. |
| K16 | P1 para distribuição / audit executado | npm audit: 19 dependências sinalizadas, 1 crítica (tar transitivo), 13 altas, 5 moderadas; diretas incluem Electron, electron-builder e Vite. Nem todo advisory é explorável neste fluxo. | Analisar alcance e preparar atualização aprovada em branch separada, incluindo regressões de mídia e empacotamento. |
| K17 | P2 / ambiente reproduzido | npm ci padrão rejeita resolução de peers do lockfile; --legacy-peer-deps instala sem reescrever. Node/npm não fixados e npmrc ausente. | Formalizar toolchain/opção em tarefa futura; onboarding já salva comando compatível. |
| K18 | P3 / estático | Documentos antigos mencionam tailwind.config.js/tailwindcss-animate, 200% real e conclusão total; pacote diz 1.0.0, UI 2.0. Timer, sidebar toggle e VoiceAvatar pendentes. | Conciliar documentação/versionamento com comportamento verificado; não gerar configuração Tailwind 3. |
| K19 | P2 / revisão estática | Botões sem nome acessível, cards div apenas clicáveis, cores fixas, hsl(var(--primary)) com token HSL completo, tema dark fixo. Avatar/Badge disponíveis não usados. | Auditoria de teclado/contraste/tamanhos; consolidar gradualmente nos primitivos existentes durante redesign. |
| K20 | P2 / risco estático | MAX_ROOM_PEERS limita somente diretório. Conexões duplicadas podem retornar sem fechar conn; eleição/mídia não possuem teste de stress/glare. | 3–6 perfis, 7º membro, entradas simultâneas e queda do beacon. |
| K21 | P2 / observado | Feed oculto offline, mas compositor aceita e salva localmente sem confirmação remota. Um teste de visibilidade expirou embora estado/IndexedDB contivessem a mensagem. | Definir indicação de entrega/offline; preservar histórico e testar retomada de rede. |

## Bloqueios do ambiente, separados de defeitos

- E01: `0.peerjs.com:443` retornou CONNECT 403; domínio salvo no rascunho, ainda não aplicado/publicado. HTTP permitido não basta para mídia P2P/STUN/TURN.
- E02: não há DISPLAY nem dispositivos físicos de teste. Electron/Chromium headless funcionaram; voz real, loopback, GPU/4K60 e Windows não foram verificados.
- E03: TURN opcional ausente; placeholders de `.env.example` não são credenciais. Não é requisito para build ou smoke local.

Nenhum desses problemas foi corrigido em código nesta fase. Não usar `npm audit fix --force`, remover asserts, ocultar erros ou substituir bibliotecas para produzir um status verde.

## Atualização — REDESIGN-001

K21 parcialmente tratado na apresentação: histórico local agora permanece visível offline, com aviso no compositor; entrega remota continua sem confirmação. K19 recebeu foco/nomes/teclado e tokens na camada visual, mas auditoria completa de acessibilidade ainda não foi executada. Demais problemas de motor/build/dependências permanecem. CPU/GPU explicitamente indisponíveis na telemetria; não há coleta ou valores simulados.


## Atualização — STUDIO-001 — 05/11/2026

Studio: sem backend de sincronização; transferir JSON manualmente. LocalStorage pode exceder quota com imagens; gravação falha com aviso e export continua disponível. Cálculo AA cobre pares sólidos, não certifica fundos compostos. Dados locais inválidos usam padrão seguro. Sem validação completa de leitor de tela/Windows/mídia real. Aviso de bundle >500kB e K01 permanecem.
