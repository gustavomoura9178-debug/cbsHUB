# DESKTOP-007 — ajustes desktop e notificações

06/11/2026 (America/Sao_Paulo) · Codex/OpenAI · branch fix/native-notifications-call-stability-2026-11-06 · base 1a9d3e9 (PR anterior integrado). Candidato 2.0.0-rc.6, sem novas dependências.

## Comportamento entregue

- Splash com duração mínima de 5 segundos a cada abertura/reload, por pedido explícito que substitui a diretriz antiga de não atrasar. Preparação e timer correm simultaneamente; se dados demorarem mais, aguarda ambos. A interface principal só monta depois; titlebar e controles de janela permanecem disponíveis. Cleanup cancela timer e callbacks obsoletos.
- Controles do palco permanentemente visíveis e centralizados, sem botão de expandir/ocultar opções, hover ou popover que esconda o dock. No spotlight, o dock fica em sua própria linha, deixando a largura das miniaturas disponível. Seletores de dispositivos continuam nos menus existentes.
- Diagnóstico da transmissão movido do header da sala para a região no-drag da titlebar, com ícone, tooltip e nome acessível, sem texto “Conexão” ou número no gatilho. Conteúdo diagnóstico preservado.
- Clique na sala atual não reinicia sessão: guarda na sidebar e proteção por slug no motor antes de leaveRoom, enquanto o Peer atual existe e não foi destruído. Recuperação explícita continua em retryConnection. Trocar de sala conserva o comportamento anterior.

## Efeitos Sonoros: causa e proteção

Inspeção mostrou arquivos sendo decodificados diretamente no AudioContext da chamada, cache limitado apenas a 24 arquivos e ausência de limite de preparações simultâneas. Arquivos comprimidos podem ocupar muito mais RAM depois da decodificação. Estes são riscos concretos corrigidos; sem o arquivo que disparou a queda e sem reprodução física, não é possível afirmar que sejam a única causa do relato.

A reprodução agora reutiliza a validação de áudio existente: até 5 MB, metadados de até 120 s, dois canais e 96 kHz; decodificação em contexto separado do pipeline de voz. Limites adicionais: 48 MB por buffer, cache total de 64 MB, duas decodificações/preparações e até oito efeitos ativos. Volume não finito recebe valor seguro. Erros/cancelamento liberam o nó do efeito; não fecham o microfone, o AudioContext da voz, PeerJS ou a sala. O fluxo continua mixando o efeito no stream existente: não transmite Blob pelo WebSocket nem recria a chamada para tocar um som. Sons antigos fora dos limites são recusados; dados originais não são apagados.

## Notificações nativas

Electron Notification, com appUserModelId consistente com o builder. IPC restrito ao renderer principal, esquema de campos fechado, limites de texto, deduplicação de até 200 IDs, cadência de um alerta por segundo, no máximo dez notificações retidas e validade de 30 s. XML de toast escapa caracteres de título/corpo. API preload ganha notifyNative/onNotificationActivated (12 métodos no total), sem IPC genérico nem execução de URLs/código fornecido pelo remetente.

Mensagens: somente texto recebido validado e persistido, novo no histórico atual. Histórico sincronizado, edições, mensagens bloqueadas e duplicatas não geram alertas. O alerta é suprimido quando a janela está visível e focada; o conteúdo mostrado limita-se ao nome e trecho do texto, portanto pode aparecer na central de notificações do SO. Mensagens continuam persistidas mesmo se notificações forem indisponíveis/silenciadas pelo Windows.

Chamadas: o aplicativo usa voz por sala, não ligação direta entre contas. Uma transição de participante conhecido de fora da voz para dentro da voz, quando você ainda não está na chamada, gera “Chamada na sala”. Snapshot inicial de uma chamada antiga não toca convite retroativo. Windows usa toast XML com ação foreground “Atender”; macOS usa action nativa, e clique no alerta também restaura a janela e tenta atender. O callback é consumido uma vez e revalida sala, geração, sessão, presença em voz, bloqueio e estado local. Convites expirados, de sala anterior ou de quem saiu não iniciam chamada. Não foi implementado iniciar com Windows, chamada direta/DM ou serviço push fora do processo Electron.

Entrega visual e ação do toast no Windows NÃO foram testadas neste Linux. Dependem do suporte/configuração de notificações do SO e identificação/atalho da instalação. Testes IPC usam apresentação nativa simulada; não equivalem a aprovação Windows.

## Arquivos e validação

UI: App, CallControls, CallStagePanel, LeftSidebar, RoomTopBar, StreamDiagnostics, TitleBar. Serviços: soundboardEngine, webrtcEngine, nativeNotifications; Electron main/preload/notifications e contrato cbshub.d.ts. Novas regressões: desktop7.cjs, native-notifications.cjs, notification-ipc.cjs. Fixtures existentes de dock e quantidade de métodos preload atualizados para a nova especificação. Documentação e versão registradas separadamente.

EXECUTADO: `npm run build` (TypeScript/Vite/Electron) aprovado; `npm test`: 36 scripts, 35 aprovados, um bloqueado e nenhuma falha restante. Exit 1 decorre do bloqueio de `media-transport.cjs`, não representa aprovação integral. Regressão suplementar do atendimento válido consumido uma vez aprovada. Empacotamento Linux com `npx --no-install electron-builder --linux --dir -c.electronDist=node_modules/electron/dist` e smoke do executável com `CBSHUB_TEST_EXECUTABLE=/workspace/cbsHUB/dist-package/linux-unpacked/cbshub node tests/electron-smoke.cjs` aprovados. Renderer parado antes de empacotar. Evidência consolidada em [desktop-007-results.json](desktop-007-results.json). Nenhuma dependência mudou; npm ci/audit não repetidos nesta fase. Testes novos cobrem timer mínimo, ausência do workspace antes de 5 s, diagnóstico na titlebar, controles expostos, identidade de Peer/microfone preservada ao reabrir sala, áudio inválido/oversized, convites válidos consumidos uma vez e obsoletos recusados, mensagem nova, validação/escape XML e IPC real Electron com transporte de notificação simulado.

Pendências: executar Windows instalado com notificações habilitadas (mensagens em segundo plano, botão Atender, DND/expiração/troca de sala e remetente saindo); repetir queda relatada com arquivo original e dois dispositivos reais; confirmar áudio nos dois sentidos, efeitos e reconexão. ICE continua bloqueado neste Chromium por política administrada disable_non_proxied_udp, sem tentativa de contorno. Não declarar versão pronta para produção.

## Entrega e colaboração

Commits de conteúdo: 4361de2 (áudio), 05ff793 (notificações/sala) e 1573a6f (interface/regressões). Documentação/versão em commit posterior identificável pelo Git. Tag local de recuperação `recovery/pre-desktop7-2026-11-06`, base 1a9d3e9. Fetch final confirmou origin/main nessa mesma base; não houve merge nem alteração da principal. Reservas liberadas para revisão. Envio da branch autorizado explicitamente pelo mantenedor; nenhum instalador Windows/release estável publicado.
