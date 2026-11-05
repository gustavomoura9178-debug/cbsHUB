# Regressão de interface

`node tests/redesign-smoke.cjs` executa interações no Chromium contra o renderer em `127.0.0.1:5173` (iniciar com o helper cloud descrito em AI_HANDOFF). Requer Playwright disponível no host e `/usr/bin/chromium`; ambos já existem no ambiente preparado. Nenhuma dependência da aplicação foi adicionada. Para outro ambiente, preparar essas ferramentas externamente antes de rodar.

Cobre resize/limites/persistência, collapse, painel de membros, menu, diagnóstico sem métricas inventadas, mensagem offline, três viewports e Sheets/Escape. Bloqueia destinos externos e usa perfil efêmero e mídia sintética. Não valida comunicação remota. Capturas são gravadas em `/workspace/cbshub-onboarding`.

Os probes de persistência/mixagem/Electron usados na auditoria permanecem em `/workspace/cbshub-onboarding/audit-smoke.cjs`; resultados resumidos nos documentos compartilhados. Existe `npm test` para descobrir os scripts `.cjs`, gravar logs em build/test-logs e resultados em build/test-results.json. Status BLOCKED também gera exit 1 e nunca significa teste aprovado. CI permanece pendente de ambiente equivalente.

# Studio

`node tests/theme-validation.cjs`: usa o TypeScript já instalado para carregar o modelo e validar oito grupos de segurança/contraste/roundtrip. Não requer navegador.

`node tests/studio-smoke.cjs`: usa os mesmos pré-requisitos de Playwright/Chromium e servidor local. Exercita preview/rollback, persistência, biblioteca, JSON, cores, fundo raster/gradiente, layout, acessibilidade e móvel. Perfis efêmeros e destinos externos bloqueados. Não testa backend nem chamadas entre máquinas. Arquivo de exemplo versionado em docs/themes/dark-modern.cbshub.json; especificação em docs/development/STUDIO.md.

# Perfis

`node tests/profile-validation.cjs` executa sete grupos de validação/projeção com o TypeScript existente. `node tests/profile-smoke.cjs` usa Playwright/Chromium e renderer local, dois contextos isolados e ponte de pacotes através do handler real. Exercita edição/persistência, upload raster, cancelamento, visão remota/privacidade, bloqueio e permissões. Não comprova sinalização/ICE pela internet nem autorização em backend. Ver docs/development/PROFILES.md.

# Chat 2.0

`node tests/chat-model.cjs`: sete grupos de autorização local, operações idempotentes, tombstone, ordenação e segurança.
`node tests/chat-smoke.cjs`: dois contextos e ponte local através dos handlers reais; envio/ACK, edição/exclusão, resposta/pin/reação, reconexão lógica, Soundboard, busca e paginação.
`node tests/chat-drafts.cjs`: rascunhos por sala, erro de disco injetado/retry, retenção, janela limitada e não lidas.
Requer os mesmos pré-requisitos de navegador/renderer. Reinicie o helper dev após modificar store/motor para evitar módulos duplicados do HMR nos imports dinâmicos dos probes. O teste de perfis aguarda readiness da sala antes de inserir sua sessão sintética. Limitações de autorização/recuperação P2P em docs/development/CHAT_2.md.

# Voz, vídeo e Soundboard (MEDIA-001)

`node tests/media-smoke.cjs`: captura sintética, permissão/erros, controles, troca/rollback de dispositivos, biblioteca e liberação após sair.
`node tests/media-engine.cjs`: WebAudio real com sinais sintéticos e adapters de chamada/stats para testar canais independentes, entrada tardia, recuperação e teardown. Não equivale a transmissão pela rede.
`node tests/media-transport.cjs`: tenta RTCPeerConnections locais entre dois contextos, com adapter de sinalização; falha explicitamente se não houver candidatos ICE. **Bloqueado nesta instância, não aprovado.** Não usar como evidência de dois dispositivos físicos.

Mesmos pré-requisitos dos demais probes; iniciar renderer e reiniciar depois de alterações em módulos centrais para evitar HMR durante testes. Não modificar fontes enquanto um probe roda. Matriz física e resultados em `docs/development/MEDIA_EXPERIENCE.md`.

# Estabilização

Use `npm run build`, `npm run dev:renderer` (terminal separado) e `npm test`. O runner versionado registra logs/resultados em build/; bloqueio não é aprovação e retorna exit 1. Novos probes: desktop-security (origens/argumentos/CJS), electron-smoke (runtime/reload/sandbox) e stabilization-a11y (foco/Tab/Escape/reduced motion). O teste Electron aceita CBSHUB_TEST_EXECUTABLE para validar pacote Linux. Relatório atual: docs/development/STABILIZATION.md.

# SECURITY-002

Electron 45 baixa o runtime sob demanda: preparar com `node node_modules/electron/install.js` antes dos testes (cloud: ELECTRON_GET_USE_PROXY=1). Node mínimo 22.12; ambiente testado Node 24.22.1. Novo signaling-validation valida presença P2P malformada. Electron smoke agora verifica interface carregada, CSP efetiva e entrada/saída da voz com captura sintética, além de preload/sandbox/reload. Resultados atuais em docs/development/SECURITY_UPDATE.md.


## WORKSPACE-3

`call-recovery.cjs`: adapters e relógio controlado para perda/substituição de dados preservando voz, estados transitórios/falhas, limites/cancelamento e falha de reconstrução da sinalização; relatório sanitizado, cópia/limpeza e teardown. Não comprova ICE remoto.

`audio-tools.cjs`: captura de teste local e cleanup de diálogo; WebAudio sintético real mede PTT/release/edição/blur/silêncio manual/Soundboard independente e persistência. Sem teste de hardware ou atalho global.

`workspace-sidebar.cjs`: favoritos/busca/persistência, não lidas da sala ativa, painel/rodapé de voz, temas, collapse/viewports e navegação por teclado no mobile.

`chat-toolbar.cjs`: ações sob demanda, pins/eventos/densidade, histórico/estado vazio e mensagem numérica legítima de 7000 caracteres preservada sem overflow. `official-logo.cjs`: fonte/hash e fidelidade dos paths/cores no mark derivado, PNGs transparentes, frames ICO e renderização nos dois temas.


## DESKTOP-004

`desktop-refinement.cjs`: editores integrados em um Dialog, quatro temas/contraste/persistência, cards em três alturas, webcam/tela sintéticas/spotlight, qualidade por peer, tela de reconexão/cancelamento e movimento reduzido. Ações comuns não se repetem permanentemente no dock.

`audio-trim.cjs`: WAV sintético, waveform, corte/prévia, original preservado, reedição/IndexedDB/reload, cache após transação, limpeza de player, arquivo/intervalos/tamanho inválidos e captura ativa. Sem qualidade auditiva física ou transporte remoto.

`tray-lifecycle.cjs`: Electron headless, fechar preserva captura/renderer, activate restaura mesma janela, segundo processo não cria outra instância e app.quit encerra. Sem Tray físico nesse ambiente; criação GTK é evitada quando headless e X minimiza como fallback. Windows/menu/ícone reais ficam pendentes.


`stream-telemetry.cjs`: nenhum FPS/RTT presumido, flags para métricas ausentes, associação A/B ao spotlight, troca do observer para o peer focado, rejeição de resultado assíncrono antigo e ausência de ramp-up ABR com rede desconhecida. Adapters não são transporte real. Após npm test, parar renderer antes de empacotar: arquivos HTML gerados em dist-package podem provocar reload do Vite e invalidar sessões de teste.
