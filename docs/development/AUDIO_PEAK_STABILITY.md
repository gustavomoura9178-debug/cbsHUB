# AUDIO-008 — áudio alto/agudo e permanência na chamada

06/11/2026 (America/Sao_Paulo) · Codex/OpenAI · branch `fix/audio-peak-stability-2026-11-06` · base `0d7a750` (PR #15 integrado) · candidato `2.0.0-rc.7`.

## Relato, evidência e limite da conclusão

O mantenedor relata que um efeito alto ou grito agudo o retira da sala da ligação, sem fechar o aplicativo. Não há gravação/log do incidente nem teste com o dispositivo físico dele. A inspeção confirmou um caminho concreto: `rawMicStream.track.onended` chamava `leaveVoiceCall("microphone_ended")`, encerrando voz e mídias de todos os pares. Um evento de término da captura pode vir do dispositivo/driver/permissão; não prova que a frequência/volume foi a causa. Nenhuma condição de volume no código de WebRTC foi encontrada mandando sair da sala.

Também foi confirmado que os efeitos contornavam o compressor vocal e entravam diretamente no destino WebRTC; o ganho do microfone vinha depois do compressor. Assim, a soma podia ultrapassar a faixa nominal. A proteção de decodificação rc.6 não cobria essa soma nem o comportamento de término da captura.

## Correção

- `audioPeakGuard.ts`: proteção final de picos de amostras, curva de ganho unitário até ±0,98 e corte nos extremos, sem atraso de lookahead ou troca de stream. Aplicada após a soma de microfone/efeitos antes do destino WebRTC e ao retorno local dos efeitos. Não normaliza volume percebido; saturação extrema pode distorcer. Não transforma nível alto em falha de conexão.
- `audioPipeline.ts`: valida ganhos finitos, protege a soma; noise gate respeita sampleRate real, canais de saída e amostras finitas. Erro do processador usa listener explícito para desconectar apenas o gate e continuar pelos filtros/compressor/ganho/mute/proteção, mantendo a mesma trilha enviada. Libera Blob URL mesmo se addModule falha, fecha porta do worklet no cleanup. Registra falhas sem gravar conteúdo do áudio.
- `soundboardEngine.ts`: protege o retorno local e valida ganho mestre/prévia. Limites de tamanho, cache e concorrência rc.6 preservados; arquivos salvos não são alterados.
- `webrtcEngine.ts`: captura interrompida não chama leaveVoiceCall. Tenta readquirir o dispositivo selecionado e substituir a trilha via replaceTrack, mantendo sala, pares, recepção, vídeo e tela. Uma tentativa automática por janela de 10 s, acionada por ended, sem timer/loop de retry. Se falha ou ocorre nova interrupção rápida, permanece em voz e informa erro; o usuário pode selecionar novamente o microfone. Eventos de captura antiga/troca em andamento são ignorados. Saída explícita/troca de sala cancela aquisição tardia pelas gerações existentes. Uma nova entrada manual em voz reinicia o orçamento de recuperação.
- `callDiagnostics.ts`: eventos `microphone_interrupted`, `microphone_recovery` e `audio_processor_error`, além de microphone_ready/error existentes, no relatório limitado a 200 eventos. Sem áudio, caminhos de arquivos ou identificação de dispositivo.

## Verificação

Nova regressão `tests/audio-peak-stability.cjs`: renderização OfflineAudioContext de 7 kHz nos ganhos 0,1/1/16, preservando sinal normal e limitando o alto; injeção simultânea nos caminhos de microfone/efeitos, arquivo PCM forte de 6,5 kHz, ganho não finito, sessão/trilha preservadas; erro do worklet injetado; interrupção de captura com substituição da trilha em sender simulado; repetição rápida, falha getUserMedia e saída explícita durante captura pendente. Áudio sintético e sender RTP simulado não equivalem a chamada entre duas máquinas.

EXECUTADO: build/TypeScript rc.7 aprovado. Suíte consolidada de 37 scripts: **36 aprovados, um bloqueado (media-transport/ICE), zero falhas restantes**. `npm test` foi interrompido pela indisponibilidade do ambiente após 29 resultados; os oito restantes foram executados após retomada com o mesmo código congelado. Exit consolidado 1 representa o bloqueio, não aprovação integral. O novo teste de picos/captura passou na rodada consolidada, incluindo injeção simultânea em voz/efeitos. Evidências em [audio-008-results.json](audio-008-results.json). Pacote Linux gerado com `npx --no-install electron-builder --linux --dir -c.electronDist=node_modules/electron/dist`, após parar o renderer. Não foram atualizadas bibliotecas/dependências; npm ci/audit não repetidos.

## Validação necessária no dispositivo afetado

Instalar a revisão e repetir o cenário com o arquivo original em volume de reprodução habitual, sem precisar provocar gritos. Verificar permanência na sala, áudio nos dois sentidos, mute/deafen, câmera/tela e seleção de microfone. Se houver nova queda, abrir Diagnóstico na barra de título e exportar o relatório: eventos de microfone/processador versus media_failed/media_timeout/signaling ajudam a localizar a causa. Enviar o arquivo do efeito e o relatório se o problema persistir; a análise atual não comprova o gatilho no hardware do usuário.

A política Chromium `WebRtcIPHandling=disable_non_proxied_udp` continua impedindo candidatos ICE neste ambiente. Não contornar. Windows, driver físico, entrega de notificações e mídia real entre dispositivos não foram validados nesta tarefa. Não declarar produção nem correção definitiva do incidente sem esse aceite.

## Entrega para revisão

Conteúdo/teste em `2166a62`; documentação e versão em commit posterior, na branch `fix/audio-peak-stability-2026-11-06`. Main conferida em `0d7a750` e preservada. Arquivos de implementação listados acima; README, package/lock, ACTIVE_WORK, ACTIVITY_LOG, AI_HANDOFF, PROJECT_STATUS, CHANGELOG, KNOWN_ISSUES, ARCHITECTURE, ROADMAP e VERSIONING atualizados. Nenhuma alteração das fixtures antigas permaneceu. Reservas liberadas após fechamento. Sem merge, force push ou release estável.

Smoke do executável Linux rc.7 EXECUTADO e aprovado: `CBSHUB_TEST_EXECUTABLE=/workspace/cbsHUB/dist-package/linux-unpacked/cbshub node tests/electron-smoke.cjs`. Verificou abertura/reload, preload sandboxed, recusa de captura inválida e entrada/saída de voz sintética. Não valida instalação/driver Windows nem mídia física.
