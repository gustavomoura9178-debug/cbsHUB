# Diagnóstico e recuperação de voz — WORKSPACE-3 A/B/F

05/11/2026 · Codex/OpenAI · feat/workspace-3-2026-11-05 · base 8cd3dff (logo nova), contendo CHAT-UI-003 eb8f1fc. Sem troca de stack, bibliotecas ou backend. Ler MEDIA_EXPERIENCE.md, SECURITY_UPDATE.md e BACKEND_PROPOSAL.md para limites anteriores. Esta revisão não afirma que a causa das quedas no computador do usuário foi identificada.

## Evidência e correção A/B

O fluxo anterior `DataConnection.close → handlePeerDisconnected → closeBlockedMedia` encerrava a voz mesmo com RTCPeerConnection connected. Agora a sessão de mídia é preservada durante perda de dados. Após 15s de tolerância, mídia ainda connected permanece; se a mídia não está saudável e os dados não voltaram, a sessão remota é removida. Uma conexão de dados substituta reutiliza a sessão existente; callbacks de conexões antigas são ignorados. Assim não se perdem handlers/streams de voz durante recuperação do chat. A ausência de sinalização não fornece presença global confiável.

`RTCPeerConnection.disconnected` tem tolerância de 8s, amostrada a cada 2s, em vez de ser tratada como falha definitiva. failed ou estabelecimento >30s fecha a conexão de mídia afetada e tenta recriar a chamada via PeerJS. O watchdog de estado funciona mesmo com getStats rejeitado ou pendente; nunca inventa RTT/perda/jitter. Não há restartIce avulso: a negociação continua com PeerJS, que controla suas ofertas/SDP. Sem TURN operacional verificado, há redes em que recuperar não será possível.

Recuperação de sinalização/dados: backoff exponencial com jitter ±20%, base 1s, teto-base 15s, máximo 8 tentativas. Voz: bases 500ms/1500ms conforme ordenação dos peers, mesmo teto/jitter, máximo 6 tentativas consecutivas; conexão connected reinicia o contador. Estado sincronizado não ultrapassa o limite. Tentar novamente reinicia limites; cancelar limpa timers de retry, preservando a chamada que ainda funciona. Fechar o Peer inesperadamente não executa leaveRoom: tenta reconstruir sinalização preservando captura, microfone/áudio e intenção de voz. PeerJS pode já ter fechado suas conexões nesse evento, por isso não há promessa de áudio ininterrupto.

Handshake de dados tem timeout de 10s; gerações de sala e identidade da conexão impedem callbacks antigos de afetarem a nova sala. Saída manual fecha streams, contextos e timers de mídia, preservando chat. Saída da sala limpa também dados/retries e invalida callbacks. Eventos online/offline solicitam recuperação; lacunas de timers >15s são registradas como timer_gap, sem afirmar suspensão física do SO. Retirada do microfone registra microphone_ended e exige nova seleção/entrada.

## Diagnóstico A

Configurações > Diagnóstico: estados atuais, RTT/perda/jitter disponíveis, até 200 eventos em memória, sessão UUID local, duração da chamada, tentativas, encerramentos conhecidos, copiar relatório e limpar. Peer IDs são substituídos por aliases par-N (até 1000). Exportação permite apenas campos/estados/motivos conhecidos e números finitos; mensagens, áudio, vídeo, SDP, IPs, URLs, tokens e credenciais não entram no relatório. Histórico não persiste no reinício e não é enviado a um servidor. Não é log de auditoria autenticado.

## Áudio F

Push-to-talk opcional local, desativado por padrão, preferências persistentes e tecla F8/F9/F10. Funciona somente com foco no aplicativo, fora de campos de edição e sem modificadores. Keyup, blur, aba oculta, saída da voz e cleanup liberam o ganho. O silêncio manual sempre prevalece. O gate atua no ganho de microfone já existente, antes da entrada separada do Soundboard, sem recriar pipeline/cortar sons. Indicadores de fala usam o gate real. Não implementado atalho global Electron, explicitamente opcional na especificação.

Teste de microfone separado: inicia somente por clique, mostra nível sem reproduzir nem enviar áudio. Para ao fechar/trocar aba, trocar dispositivo, entrar em chamada ou parar. Resposta tardia de getUserMedia é invalidada por geração e encerra tracks. Durante chamada, utiliza-se o VU existente. Análise limitada a aproximadamente 12,5 atualizações/s, sem processamento pesado adicional em chamadas. Supressão/gate, eco, ganho automático, dispositivos e volume por participante existentes foram preservados. Não foram medidos CPU/memória de hardware real.

## Arquivos e regressões

Motor/estado: src/lib/{webrtcEngine,mediaState,callDiagnostics,voicePreferences}.ts; hook usePushToTalk; App; componentes CallStatus, CallDiagnosticsPanel, MicrophoneTest e SettingsModal. Testes novos call-recovery.cjs e audio-tools.cjs; media-engine.cjs existente cobre mixagem, volume, câmera/tela sintéticas e teardown.

Execuções locais iniciais: call-recovery, audio-tools e media-engine passaram. call-recovery usa adapters e relógio controlado; não transmite mídia por ICE. audio-tools mede WebAudio real com fonte sintética, cobre tecla/release/edição/blur/silêncio/Soundboard e captura local. Build/tsc passaram. Resultado da suíte final registrado em ACTIVITY_LOG e PROJECT_STATUS após execução; não considerar todos os testes aprovados com base apenas neste documento.

Critérios externos ainda abertos: dois dispositivos reais e redes separadas, perda/troca de rede, suspensão real, TURN/STUN, troca/desconexão física de microfone, câmera/tela do SO e qualidade auditiva prolongada. Sem essas evidências, não declarar todas as quedas corrigidas ou produção pronta.

Reversão: alterações de voz ficam em commit próprio, separado da limpeza do chat e da nova identidade. Reverter o commit em branch de trabalho restaura o motor anterior sem migração de mensagens/perfis/temas. Preferências novas são chaves locais separadas; nunca remover dados antigos ao reverter.
