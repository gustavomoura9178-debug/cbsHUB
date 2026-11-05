# BRAND-001 — barras compactas / identidade oficial

05/11/2026 · Codex/OpenAI · feat/compact-bars-logo-2026-11-05 · base cb7b93f (PR #8 integrado). Recuperação recovery/pre-compact-bars-2026-11-05. Checkout inicial limpo e reservas anteriores encerradas.

## Implementado para revisão

- Titlebar: token de altura 32px, sem subtítulo; nome cbsHUB preservado, controles com região no-drag e superfície de arraste existente.
- Cabeçalho: alvo 60px desktop / 56px compacto, nome em uma linha e status em outra; breadcrumb decorativo removido, ícone e padding menores. Conexão/latência, ação de voz, membros e menu mantidos. Status também permanece no layout móvel.
- Barra de chamada: alvo 32px, informações de participantes/fala com truncamento e ações iconográficas com nome acessível. Expandir/reduzir/minimizar preservados.
- Janela: getWindowState e assinatura de cbs:window-state-changed no preload, com unsubscribe; estado do botão reflete eventos nativos em vez de toggle local presumido. Seis métodos anteriores preservados, dois novos métodos aditivos. Dados recebidos reconstruídos com isMaximized boolean.
- TitleBar assina somente as preferências que usa, evitando rerender por atualizações de microfone/participantes.

Arquivos: src/index.css; src/components/{TitleBar,RoomTopBar,CallStagePanel}.tsx; src/types/cbshub.d.ts; electron/main.ts e preload.ts; tests/desktop-security.cjs, compact-bars.cjs e window-controls.cjs. Motores de chat/voz/vídeo/Soundboard e preferências de temas não foram reescritos.

## Logo — pendência de entrada, não entregue

O usuário forneceu referência raster na conversa. Uma tentativa de remoção generativa do branco alterou geometria/cores e foi descartada; **nenhum resultado alterado foi integrado ao aplicativo**. Solicitado arquivo PNG/SVG original para preservar a identidade exatamente. Não foram criados ícones genéricos nem configurados caminhos para arquivos inexistentes.

Após receber o original: preparar transparência preservando arte, proporções e cores; exportar PNGs 16/20/24/32/48/64/128/256/512 e ICO multiresolução; integrar imagem de 20px na titlebar, ícone BrowserWindow e icon do electron-builder; verificar nos dois temas e no pacote. O app não tem sistema Tray atualmente: não foi adicionado comportamento de bandeja ou minimizar para tray nesta tarefa.

## Testes realmente executados

- npm run build: TypeScript, renderer/main/preload passaram. Avisos preexistentes de bundle, customResolver e freeze continuam.
- compact-bars: passou titlebar 32px, cabeçalho 60px desktop e <=64px em viewports 390/768/1280; barra de chamada <=34px; Clássico/Moderno Roxo; menus; entrada/saída sintética; expandir/reduzir; ausência de overflow; propriedades CSS drag/no-drag.
- window-controls: passou solicitação IPC de maximizar/minimizar/fechar, consulta inicial e atualização do botão por eventos de estado. Eventos de estado foram enviados controladamente no probe. Não equivale a maximização/arraste físico em Windows.
- desktop-security, electron-smoke, redesign-smoke e media-smoke: passaram nas regressões locais. Electron de produção carregou UI/CSP, entrou/saiu da chamada com dispositivo sintético e recarregou.

Limites: ambiente Electron headless não fornece gerenciador de janelas para validar arraste e aparência real maximizada/restaurada. Esses cenários devem ser verificados num desktop Windows/Linux real. Sem chamadas entre dispositivos físicos. Renderização da logo/ICO não testada, pois os recursos oficiais ainda não foram integrados.

Uma tentativa de pointer click após maximizar headless falhou por geometria da janela; probe de IPC usa click DOM controlado para minimizar/fechar e confirma handlers/evento de fechamento, sem declarar arraste físico. A página se encerra antes de retornar o evaluate de fechar: teste foi ajustado para aguardar o evento real de encerramento. Capturas foram refeitas aguardando desmontar o modal, evitando imagens durante animação.

Estado: barras disponíveis para revisão local; tarefa BRAND-001 aguarda o arquivo original para concluir a identidade visual. Sem push/merge nesta etapa.
