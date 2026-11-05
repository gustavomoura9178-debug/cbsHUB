# DESKTOP-004 — revisão desktop cbsHUB

05/11/2026 · Codex/OpenAI · branch feat/desktop-refinement-2026-11-05 · base 29e60c1 (PR #11). Checkout inicial limpo; origin/main conferida novamente e permaneceu na mesma base. Recuperação local: recovery/pre-desktop-refinement-2026-11-05. Candidato técnico **2.0.0-rc.3**, conforme VERSIONING.md; “3.0” continua sendo a direção de produto, não uma declaração de release estável.

## Auditoria e decisões preservadas

Arquitetura React/TypeScript, Tailwind, shadcn/Radix, Zustand, Electron e PeerJS mantida. Nenhuma biblioteca substituída ou dependência acrescentada. As entregas anteriores de chat, perfis, Studio, chamadas e efeitos foram reaproveitadas. A descrição antiga de arcos no anexo é histórica: vale a logo nova de duas partes confirmada pelo mantenedor (#29256B/#12C9BD). A mensagem numérica é legítima e permanece intacta. Não há backend de contas/salas/arquivos: BACKEND_PROPOSAL.md continua proposta para revisão.

## Entregas por fase

| Pedido | Implementação nesta revisão | Evidência / limite |
| --- | --- | --- |
| Auditoria/diagnóstico | Documentos e branches conferidos; diagnóstico existente preservado | Plano em DESKTOP_REFINEMENT_PLAN.md; campos limitados e sem conteúdo privado |
| Reconexão | Exige Peer.open; sinalização pendente >12s entra na reconstrução limitada; retorno online reinicia fila de tentativas | call-recovery com relógio/adapters; áudio/vídeo real após perda de rede ainda não aprovado |
| Identidade/qualidade | Participante local atualizado mesmo antes de Peer.id ficar disponível; badge explica que RTT/perda são do enlace entre dois peers | desktop-refinement e media-engine; sem “ping absoluto da internet do participante” |
| Tray | Single-instance por perfil userData; X oculta, clique/activate restaura mesma janela, Abrir/Encerrar; ícone oficial | tray-lifecycle comprova renderer/captura ativos e segundo processo sem segunda janela. Tray nativo de Windows ainda manual |
| Fallback desktop | Em headless não instancia Tray/GTK; sem bandeja, X minimiza em vez de ocultar janela sem acesso | Primeira tentativa em headless abortou em GTK; guard por capacidade e regressões adicionados |
| Sidebar/rodapé | Rail com entrar/adicionar real; qualidade por participante no painel; ações comuns concentradas na sidebar | Busca/favoritos/unread/resize/collapse/Sheet existentes mantidos; sem DM ou contadores fictícios de outras salas |
| Ações avançadas | Dock completo sob “Dispositivos e opções” quando a sidebar oferece controles comuns; completo quando recolhida/mobile | Evita repetição permanente; mantém dispositivos, efeitos e demais opções. Cabeçalho mantém desligar se necessário com palco minimizado e sidebar ausente |
| Chat/barras | Toolbar permanente já removida, busca sob demanda/pins/menu/atividades/densidade preservados; titlebar 32px e sala 56–60px | chat-toolbar, chat-smoke, compact-bars; conteúdo não foi migrado/apagado |
| Cards | Grade usa largura/altura real e proporção 16:9; avatar escala; área pequena rola; ResizeObserver com cleanup | Tamanhos 220/360/490, webcam/tela sintéticas, spotlight e retorno à grade |
| Configurações | Perfil, recorte de avatar e Studio embutidos no mesmo Dialog; navegação central e abas nomeadas | profile-smoke/studio-smoke/desktop-refinement. Sem modais encadeados nesses editores |
| Temas | Quatro destaques: Clássico, Moderno Roxo, Sakura Dream e Velvet Nocturne; presets anteriores preservados (9 no total) | Persistência/preview/cancelamento/JSON v1 e contraste dos novos presets validados |
| Marca/splash | Paths originais animados por clip-path; pausa/escala/disparo progressivo; loading acompanha trabalho real sem espera artificial | Movimento reduzido do SO/Studio respeitado; inicialização com cache pode ser breve |
| Reconectando | Tela temática só após perda sustentada e conexão anterior; não cobre enlace de voz saudável ou erro isolado | Cancelar volta ao histórico local; encerrar chamada acessível; estado efetivo volta automaticamente quando disponível |
| Efeitos Sonoros | Nome na UI, waveform, início/fim, duração, prévia local, aplicação explícita e reedição | audio-trim valida WAV, original, cache, persistência, limites e captura ativa |
| Chat/sync | Auditoria confirma CRUD/respostas/pins/menções/busca/drafts/typing/unread/links seguros já existentes | DM, anexos/arquivos/pastas/GIFs, notificações de mensagens do SO e sync global não foram criados como UI falsa |
| Segurança/performance | IPC getter restrito, sandbox/contextIsolation/CSP preservados, caches/timers/listeners/URLs limitados e liberados | Testes desktop/security/lifecycle; audit 0 nesta execução. Sem benchmark de CPU/GPU/memória física |

## Temas e configurações

Temas usam o mesmo modelo restrito JSON v1. Novos presets não exigem migração nem removem biblioteca salva. Sakura usa superfícies claras e rosa/lavanda, texto #55445A e contraste de botão 4,81:1; Velvet usa carvão/vinho, marfim, dourado e títulos Georgia local, com botão 6,88:1. Os seis pares textuais medidos de ambos os novos presets atingem 4,5:1. Isto não certifica toda a aplicação WCAG: leitor de tela, transparência/imagens personalizadas, estados de componentes e avaliação visual física ainda precisam de revisão.

Tokens também controlam superfícies de menus, modais, estados de conexão, splash e tela de reconexão. O editor deixou de impor sua paleta escura fixa. Troca sem remontar engines. A verificação visual após terminar a transição confirmou Sakura com superfície rgb(250,220,232)/texto rgb(85,68,90), e Velvet rgb(37,29,36)/texto rgb(232,220,199). Capturas iniciais durante transição não devem ser tomadas como estado final de cor.

Studio.begin agora abre Configurações > Aparência. ProfileProvider.edit abre Configurações > Perfil; visualização rápida de participantes permanece. Salvar/cancelar editores não empilha janelas; fechar/Escape descarta prévia de tema. A ação de voz abre explicitamente a aba Áudio. Não usar as antigas suposições de teste “salvar fecha o modal inteiro”.

## Edição de áudio e segurança dos dados

Arquivos até 5 MB, duração finita até 120s, até dois canais/96kHz. Saída WAV PCM16 até 5 MB; intervalos inválidos, menores que 0,05s e saídas maiores são rejeitados antes da gravação. Metadados são verificados antes de decodificar. originalAudioBlob é aditivo e mantém a entrada; clientes antigos continuam lendo audioBlob. Não há migração destrutiva. Aplicar corte altera somente o rascunho; salvar usa transação existente do IndexedDB. Excluir som e original exige confirmação.

Prévia é player local separado: não entra no pipeline de voz nem executa stopAll. Respeita áudio silenciado, pausa e remove src ao desmontar/trocar intervalo, revoga URL, fecha AudioContext após decodificar e invalida somente o cache do efeito salvo. Efeitos sintetizados embutidos mantêm metadados/volume/categoria/favoritos; waveform/corte refere-se a arquivos importados, sem fingir um arquivo original para sintetizadores.

## Testes, reprodução e limites

Iniciar renderer de testes com `npm run dev:renderer`; executar `npm run build` e `npm test`. Testes cloud requerem Playwright disponível no host, Chromium em /usr/bin/chromium e Electron instalado. Eles não são automaticamente portáveis para Windows. `npm ci` não foi repetido: dependências/lock de resolução não mudaram, somente metadados de versão; instalação anterior permanece válida.

Resultado final: npm run build/tsc passaram; npm test executou 27 scripts, 26 PASSED e media-transport BLOCKED por ausência de candidatos ICE (exit 1 pelo bloqueio, nenhuma falha funcional restante nessa execução). npm audit foi executado nesta revisão e retornou zero ocorrências. Build final: JS ~708,58kB (gzip ~209,73kB), CSS ~92,59kB. Avisos customResolver/freeze/bundle e metadata author/referências repetidas no builder permanecem. Commits registrados em ACTIVITY_LOG.md/PROJECT_STATUS.md. O runner gera build/test-results.json e build/test-logs, ignorados pelo Git; BLOCKED também causa exit 1. media-transport continua sem candidatos ICE nesta instância, não representa passe. Empacotamento Linux: `npx --no-install electron-builder --linux --dir -c.electronDist=node_modules/electron/dist`; executável local em dist-package/linux-unpacked/cbshub. Não existe instalador Windows aprovado nesta entrega.

Regressões novas: desktop-refinement.cjs, audio-trim.cjs, tray-lifecycle.cjs; demais scripts adaptados à integração/nomenclatura. Tentativas iniciais revelaram identidade local ausente, seletores duplicados em abas/rascunho, premissa antiga de fechar configurações ao salvar e asserção de cache antes do commit da transação. Causas e reexecuções constam no diário; resultados não foram inventados.

## Pendências e revisão

- Mídia após reconexão em dois computadores reais, redes separadas, STUN/TURN, suspensão, troca física de dispositivos e várias pessoas; a infraestrutura cloud bloqueia a comprovação de ICE.
- Bandeja/menu/ícone Windows, arraste/maximização reais e comportamento do gerenciador de janelas. Headless comprova fallback/ciclo do processo, não um clique físico na bandeja.
- Medição de CPU/GPU/memória e reprodução auditiva sob carga; caches limitados e testes de cleanup não equivalem a benchmark. ABR/telemetria de tela por par permanece pendente.
- Backend/identidade autenticada/ACL/salas globais, DM e anexos persistentes dependem da proposta aprovada e de migração. Notificações de mensagens do SO permanecem pendentes; não são oferecidas como recurso implementado. Criar/remover/restaurar recentes continua local por decisão anterior.
- Leitor de tela e revisão de contraste completa, imagens EXIF/memória e plataformas alvo.

Revisar commits independentes e depois executar matriz física; nenhuma declaração de produção pronta. Disponibilização da branch para revisão atende a entrega solicitada; não autoriza release, force push ou merge em main.


## Telemetria e refinamentos finais

Removidos defaults fictícios 60 FPS / 18–20ms dos produtores de telemetria de tela. Falta de amostra fica indisponível, bitrate/perda possuem flags de medição e resolução de saída é rotulada Meta (configuração). Cada amostra informa sourcePeerId, observedLinkPeerId e direction; o HUD exige origem igual ao participante focado e o diagnóstico explica qual enlace foi observado. O observador de recepção acompanha o foco; uma nova tela de outro participante não o rouba. Gerações impedem resultado assíncrono de PC antigo de substituir dado atual; rede desconhecida não conta como ciclo bom do ABR. stream-telemetry.cjs cobre esses casos com adapters/clock; não comprova transporte físico. O ABR ainda não é um controlador independente por todos os pares simultâneos: esse trabalho continua pendente de baseline físico, sem atribuir estatísticas de um peer a outro.

Medidor de áudio foi isolado e cabeçalho/configurações assinam somente campos necessários; não renderizam os editores a cada atualização de micLevel. Não foi prometido ganho percentual de CPU. Cancelar tema inline descarta também o nome digitado, com reprodução/regressão específica. O teste de cards aceita o limite de largura 16:9 em vez de exigir que o vídeo estique indefinidamente. Probe adicional verificou ações em sidebar recolhida, palco minimizado e 390px com captura sintética preservada.

Persistência dos testes pressupõe IndexedDB/localStorage disponíveis. O fallback de memória anterior, quando o banco não abre, continua transitório e não equivale a durabilidade após reinício; não há garantia de sincronização global.


## Resultado e retomada

Build final/tsc, 27 scripts (26 aprovados/1 bloqueado por ICE), audit zero e smoke do executável Linux final concluídos. Testes/versão/docs são o commit posterior aos commits funcionais até f9c5513. Código por fase e responsáveis no diário; reservas liberadas em ACTIVE_WORK. Detalhamento de arquivos em DESKTOP_REFINEMENT_FILES.md. Não há autorização de merge/release nem evidência suficiente para produção.
