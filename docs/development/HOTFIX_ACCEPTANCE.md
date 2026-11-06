# HOTFIX-006 — conferência dos oito requisitos

06/11/2026 UTC · Codex/OpenAI · branch `fix/hotfix-acceptance-gaps-2026-11-06` · base `16afa14` (merge do PR #13 pelo mantenedor). A árvore estava limpa. A tag `recovery/pre-acceptance-gaps-2026-11-06` preserva o conteúdo anterior (`08b092e`, idêntico à base quanto aos arquivos). Candidato `2.0.0-rc.5`; nenhuma dependência nova ou substituída. Não houve alteração no motor PeerJS/WebRTC, IPC ou bibliotecas visuais nesta revisão.

## Conferência e mudanças

| Requisito | Já existente no rc.4 | Correção desta revisão / aceite restante |
| --- | --- | --- |
| Cards responsivos | Grid medido por ResizeObserver, proporção 16:9, gap adaptativo e redimensionador | Spotlight ainda tinha piso de altura e miniaturas 128×80 fixas. Removidos esses limites: área de miniaturas agora também usa geometria medida e footer proporcional. No mobile, controles ocupavam toda a largura e deixavam zero espaço aos cards; as mesmas ações ficam em popover compacto nesse modo. |
| Configurações | Perfil/Studio embutidos, temas em Aparência, rascunhos conservados e descarte inline | Faltava a seção Identidade das Mensagens. Agora oferece avatares no modo confortável e cores dos autores, preferências locais persistentes, sem alterar nome/conteúdo/identidade de outros usuários. |
| Splash | Logo oficial, máscaras, preparo real, fundo do tema, movimento reduzido | O atraso de 120 ms da parte inferior reduzia a pausa conjunta para aproximadamente 244 ms. Keyframes próprios passam a compartilhar 364 ms totalmente revelados, com formação atrasada da parte ciano e desaparecimento superior primeiro. |
| Bandeja | Ocultar/restaurar/encerrar, aviso persistido, instância única e fallback minimizar | Preservado. Windows e captura física em segundo plano continuam sem aceite manual. |
| Efeitos Sonoros | Nome visível, importação/reedição com waveform, original e intervalo preservados | Preservado, sem mudanças de pipeline ou banco. |
| Status individuais | Qualidade observada do enlace remoto por peerId | Card local não tinha indicador próprio; sidebar usava o booleano global de recuperação, inclusive em falha só de outro participante. Novo LocalConnectionBadge usa sinalização/presença locais e não copia RTT remoto. Nenhum ping individual de internet é inventado. |
| Reconectando | Tela persistente com logo, cancelamento, espera de descoberta/mídia e supressão de falha isolada remota | Preservado e usado no teste real de animação; não reintroduzido fechamento por simples peer.open. |
| Recuperação infinita | ACK de diretório, atividade RTP nova, retries limitados, gerações/cancelamento e reconstrução de sessões | Motor rc.4 preservado e submetido novamente à regressão. Audição após queda em dois dispositivos continua exigindo ambiente físico adequado. |

## Contratos e acessibilidade

`cbshub-message-identity-v1` armazena somente versão 1 e dois booleanos (`showAvatars`, `colorNames`). Leitura rejeita versão/tipos inválidos; falha ao gravar não muda o estado em memória. Avatares respeitam a densidade compacta existente. Nomes não são anonimizados; a cor só é aplicada se for HEX válido com contraste >=4,5 contra a cor de mensagens do tema, caso contrário utiliza a cor semântica do tema. Imagens/gradientes/hover exigem revisão visual adicional; essa checagem não certifica contraste sobre toda imagem personalizada. Preferências de apresentação são imediatas, como a densidade, e não modificam mensagens históricas no banco.

Indicador local descreve sinalização e presença, não diagnostica a qualidade da internet. Indicadores remotos continuam descrevendo o enlace WebRTC observado; mute/câmera continuam informações anunciadas pelo participante. O card local não recebe RTT do amigo. Sidebar usa o mesmo componente local. Labels acessíveis permanecem disponíveis quando cards pequenos reduzem o texto visual.

O spotlight usa o redimensionador existente sem trocar o mecanismo de arraste. Vídeo principal conserva object-contain. O popover de dispositivos reutiliza shadcn/Radix e CallControlDock, sem copiar ações ou adicionar Dialog dentro de Dialog. Não foram instalados componentes.

## Arquivos

- Identidade: `src/chat/viewState.ts`, `src/chat/MessageRow.tsx`, `src/components/SettingsModal.tsx`, `tests/message-identity.cjs`.
- Chamada: `CallStatus.tsx`, `UserCallCard.tsx`, `LeftSidebar.tsx`, `CallStagePanel.tsx`, `CallControls.tsx`, `src/index.css`, `tests/workspace-sidebar.cjs`.
- Regressão integrada: `tests/acceptance-gaps.cjs`; metadados: package.json/lock e README. Fonte SVG e assets oficiais intactos.
- Colaboração: este relatório, ACTIVE_WORK, ACTIVITY_LOG, PROJECT_STATUS, CHANGELOG, KNOWN_ISSUES, AI_HANDOFF, ROADMAP, ARCHITECTURE e VERSIONING.

## Testes e evidências

Executado em 06/11/2026 UTC:

- `npm run build` (inclui tsc): PASSED. Bundle JS ~719,38 kB/gzip ~212,73 kB. Permanecem avisos conhecidos customResolver/freeze, chunk >500 kB e boot-theme.js clássico copiado de public.
- `npm test`: 33 scripts, **32 PASSED, 1 BLOCKED**, zero falhas restantes. Exit 1 pelo bloqueio de media-transport sem candidatos ICE, não aprovação integral de transporte. Resumo: hotfix-006-results.json; logs locais ignorados em build/test-logs.
- `tests/acceptance-gaps.cjs`: PASSED; repetido com verificação adicional do popover mobile (mute e opções de câmera), também PASSED. Inclui identidade/persistência/contraste, separação local/remoto, seis cards proporcionais, pausa conjunta e movimento reduzido.
- `tests/message-identity.cjs`: PASSED; persistência/reinício, versão/tipos/JSON inválidos, quota e rollback de estado.
- Regressões existentes de chat, perfis, Studio, áudio/corte, câmera/tela, rede controlada, telemetria, segurança desktop, janela e bandeja/fallback: PASSED no escopo automatizado descrito nos próprios testes. Não são provas de captura física/Windows.
- Empacotamento Linux com electron-builder --linux --dir e Electron instalado: PASSED; executável rc.5 em dist-package/linux-unpacked/cbshub, diretório completo necessário para distribuir. Smoke desse executável: PASSED (startup/reload, preload sandboxed, logo/CSP e captura sintética). Sem Windows ou binários publicados.
- `git diff --check`: PASSED. Npm ci/audit não foram repetidos nesta etapa; dependências não mudaram. A auditoria zero de produção do HOTFIX-005 permanece evidência histórica, não nova execução.

Commits de conteúdo: b527927 (identidade das mensagens) e a544853 (spotlight/estado local/animação/testes). Fechamento de versão/documentação em commit posterior rastreável por git log. Nenhum arquivo de motor de rede foi alterado.

O teste integrado mede seis cards no spotlight a 180/400 px e em largura de 390 px; exercita o popover com mute e seleção de câmera; verifica isolamento entre estado local/remoto e sidebar; grava preferências e recarrega o histórico; testa cores com contraste suficiente e insuficiente; amostra ambos os paths da animação durante a pausa e movimento reduzido. Mídia/câmera usam fontes sintéticas; não equivalem a dispositivos físicos.

As primeiras tentativas revelaram falta de espaço para cards no mobile (corrigida no layout), uso de import direto do ReactDOM incompatível com a serialização do Vite (fixture passou a usar a tela de reconexão real) e comparação literal de inset(0px) versus inset(0px 0px 0%) (fixture normaliza valores equivalentes, sem relaxar a exigência de máscara totalmente aberta).

## Limitação ambiental confirmada

O arquivo administrado `/etc/chromium/policies/managed/misc.json` contém `WebRtcIPHandling: disable_non_proxied_udp`; a configuração de rede oferece proxy HTTP, sem grants de TCP privado/UDP para WebRTC. Isso é compatível com o bloqueio de candidatos ICE observado em media-transport. A política não foi alterada nem contornada. Não alegar recuperação física com base nos adapters de teste. Não há Windows nem dois dispositivos reais acessíveis nesta sessão.

## Roteiro de aceite manual — não executado

Usar dois dispositivos A/B com perfis separados, microfones reais e a mesma sala; preferencialmente redes diferentes. Registrar versão/commit, SO, topologia de rede, horário, passos, esperado/observado e diagnóstico sanitizado de Configurações > Diagnóstico. Não limpar dados existentes para atualizar.

1. Confirmar áudio nos dois sentidos, câmera simultânea, tela e Efeitos Sonoros; variar palco/grid/spotlight e alternar temas.
2. Em A, desconectar a rede por poucos segundos e retornar. Verificar indicadores locais/remotos, desaparecimento da tela somente com recuperação e audição A→B/B→A; repetir com mute/deafen já ativos.
3. Repetir com perda prolongada até esgotar tentativas, recuperação manual, falha de sinalização e perda ICE, distinguindo cada cenário. Cancelar/sair durante a tentativa deve impedir retorno involuntário à voz. Conferir participantes duplicados e diagnóstico.
4. Em B, sair da sala; A não deve receber bloqueio global atribuído a uma queda local. Reentrar não pode duplicar mídia/listeners.
5. No Windows, usar X durante chamada: observar primeiro aviso, ícone/menu, áudio e mensagens em segundo plano; restaurar a mesma janela. Abrir segunda instância e encerrar pela bandeja. Repetir primeiro fechamento após reiniciar para conferir persistência do aviso.
6. Salvar/cancelar rascunhos de perfil/tema entre abas, reiniciar preferências, importar/recortar/reeditar/cancelar áudio e verificar o original salvo. Navegar por teclado e testar leitor de tela/contraste/movimento reduzido.

Status desta matriz: PENDENTE. Só promover a estável após evidências e revisão/autorização do mantenedor. Não há merge automático nesta tarefa.
