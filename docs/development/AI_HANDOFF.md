> Atualização atual: **2.0.0-rc.2 / SECURITY-002**. Leia [SECURITY_UPDATE.md](SECURITY_UPDATE.md). Estados anteriores são históricos.

> Estado atual em 05/11/2026: candidato **2.0.0-rc.1**, estabilização STABILIZE-001. Consulte [STABILIZATION.md](STABILIZATION.md). As seções anteriores abaixo são históricas.

# Passagem entre pessoas e agentes de IA

Data: 05/11/2026 (America/Sao_Paulo). Responsável: Codex/OpenAI.
Branch: `audit/cbshub-v2-2026-11-05`. Base auditada: `5deab40aa1629a975dc72588b658569b21494c23`.

## Leitura obrigatória antes de cada tarefa

Leia este arquivo, ACTIVE_WORK, PROJECT_STATUS, KNOWN_ISSUES, ROADMAP, ARCHITECTURE, ACTIVITY_LOG, CHANGELOG e `../PROJECT_AUDIT.md`. Consulte o SDD_CBSHUB_V2.md e PROGRESS.md para intenção/histórico; a implementação e evidências recentes prevalecem sobre afirmações de conclusão antigas. Não existe arquivo SDD.md neste checkout.

## Regras permanentes do trabalho

- Preservar shadcn/ui/Radix como base, Tailwind e stack adotada; mudança de biblioteca requer justificativa e aprovação.
- Não recriar o app nem misturar redesign com correções de protocolo/mídia; proteger chat, voz, vídeo e Soundboard.
- Não descartar mudanças, não executar reset/clean destrutivo, não fazer force push ou escrever diretamente em main.
- Cada tarefa cloud já é isolada; usar checkout existente, sem criar worktree salvo solicitação explícita.
- Nunca registrar teste não executado como aprovado. Distinguir inspeção estática, probe com mídia sintética e teste real entre máquinas.

## Preflight de colaboração

```sh
cd /workspace/cbsHUB
git status --short --branch
git branch -avv
git log -8 --oneline
git ls-remote --heads origin
```

Inspecione diffs tracked/untracked e ACTIVE_WORK antes de editar. Se precisar comparar com trabalho remoto, faça fetch sem resetar arquivos e compare commits/diffs com a base combinada. Listar branches não prova ausência de PRs ou trabalho ainda não publicado. Consulte a outra pessoa quando a sobreposição não puder ser resolvida pela documentação; não presuma propriedade sobre alterações dela.

Crie uma branch `audit/`, `fix/`, `feat/` ou `docs/` para a tarefa e registre responsável, objetivo, commit base, arquivos reservados, dependências, critérios de aceite e status. ACTIVE_WORK é um acordo documental, não um lock distribuído: em clones distintos, sincronize a reserva antes de tocar arquivos compartilhados. Se a mesma área já estiver reservada, coordene a divisão antes de editar. Atualize o log durante bloqueios relevantes.

Ao terminar: revisar diff, executar checks adequados, atualizar todos os documentos afetados, fazer commit apenas dos arquivos próprios e transferir a tarefa para revisão. Push/merge por fluxo revisado; não publicar ou integrar silenciosamente o trabalho da outra pessoa. Não há autorização nesta fase para push.

## Registro mínimo de entrega

```text
Data/hora (America/Sao_Paulo):
Responsável/pessoa e agente:
Tarefa e status:
Branch e commit base:
Commit(s) de entrega:
Arquivos modificados:
Funcionalidades implementadas / documentação somente:
Testes executados: comando, cenário, resultado, contagens quando existirem:
Testes falhos / não executados / limitações:
Pendências e dependências:
Informações para a outra IA / reservas liberadas:
```

O hash de um commit não pode estar no próprio conteúdo sem mudar esse hash. Registre o commit de conteúdo no log em um commit posterior de passagem; identifique este último pelo histórico Git. Não invente hashes nem deixe “testado” sem contexto.

## Entrega atual e ponto de recuperação

Base segura: `5deab40aa1629a975dc72588b658569b21494c23`.
Branch: `audit/cbshub-v2-2026-11-05`.
Tag local: `recovery/pre-audit-2026-11-05`.
Bundle: `/workspace/cbshub-onboarding/pre-audit-2026-11-05.bundle`, verificado e contendo histórico completo disponível.
Commit de conteúdo: 724abeaec50df76bffecb3dcd5e48a8ad6d163ba.

Nenhum push ocorreu. A tag/bundle e os scripts externos são locais ao ambiente; não pressupor que a outra pessoa os possui. Para inspecionar recuperação sem sobrescrever trabalho: `git show recovery/pre-audit-2026-11-05`; se o checkout for perdido, verificar bundle e clonar para um diretório novo. Não aplicar reset --hard para “restaurar” uma árvore que tenha trabalho novo.

## Como continuar

Recomendação: R1/K01, com tarefa separada de correção do preload. O merge de configuração concatena `formats` em ES+CJS; ambas saídas apontam ao mesmo .cjs. Não confundir sucesso em uma build de produção com solução. Depois cobrir lifecycle/isolamento/mídia e matriz R3.

Setup local verificado: `ELECTRON_GET_USE_PROXY=1 npm ci --legacy-peer-deps --cache /workspace/cbshub-onboarding/npm-cache --no-audit --no-fund`; `npm run build`.
No cloud: `node /workspace/cbshub-onboarding/dev.mjs` para renderer e Electron headless separado. O helper preserva configuração de renderer, mas não recompila Electron automaticamente; main/preload exigem nova build/restart. Com DISPLAY, o script original npm run dev existe, com K01 pendente.

Scripts e resultados auxiliares: `/workspace/cbshub-onboarding/audit-smoke.cjs`, `smoke-results.json`, `npm-audit.json`, `install.sh`. Foram usados perfis/dados sintéticos isolados. Esses arquivos não constituem suite versionada. Os documentos registram a evidência essencial para outro clone.

Cloud: install_script/start_skill/rede salvos em rascunho, ainda sem publicação. PeerJS bloqueado na instância auditada; não solicitar token GitHub (leitura Git funcionou) nem credenciais TURN para testes locais. Não abrir nova tarefa de redesign como se a matriz multipar estivesse aprovada.

## Entrega mais recente — REDESIGN-001

Branch `feat/workspace-redesign-2026-11-05`, base `recovery/pre-redesign-2026-11-05`. Commit UI: a29e4ca. Ler REDESIGN_REVIEW.md, DESIGN_SYSTEM.md e tests/README.md antes de continuar. O usuário autorizou o redesign após a auditoria, antecipando o gate recomendado; não declarar R3 aprovado. Motores, dependências e última otimização de áudio da outra IA preservados. Sem push/merge. Próxima ação é revisão/validação de mídia e correções delimitadas, sem avançar para personalização.


## Atualização — STUDIO-001 — 05/11/2026

STUDIO-001 usa branch feat/cbshub-studio-2026-11-05, base 08f0c51 (PR #1 integrado). Ler STUDIO.md antes de alterar formato/provider. Preferências de layout migradas para cbshub-studio-v1; motores e dados de chat/Soundboard intactos. Não adicionar sync P2P de preferências como se fosse backend autenticado. Sem perfis nesta etapa. Commit de conteúdo: 19d316f.


## Atualização — PROFILE-001 — 05/11/2026

PROFILE-001 · feat/user-profiles-2026-11-05 · 7a88783 · base 03217b8. Ler PROFILES.md antes de modificar identidade, perfil público e gates de interação. Não enviar objeto UserProfile privado pelo transporte. Não tratar clientId local como autenticação de conta. Mantenedor escolheu local/P2P e backend depois. Nenhum push/merge desta tarefa.


## Atualização — CHAT-002 — 05/11/2026

CHAT-002 · feat/chat-v2-2026-11-05 · b74272e · base 206dc46. Ler CHAT_2.md antes de alterar journal, tombstones, ACK e sync. Banco novo de operações não substitui dados antigos. Não trocar estados explícitos por toggles em v2. Backend ausente; recuperação de operações depende do ator disponível ou journal já local. Sem garantia global/servidor. Soundboard preservado.


## Atualização — MEDIA-001 — 05/11/2026

MEDIA-001 · feat/media-experience-2026-11-05 · base 6a72051 · commit de conteúdo será registrado abaixo após criação. Ler MEDIA_EXPERIENCE.md antes de tocar mídia. Preservar handles separados de envio/recebimento, gerações de captura, gate de participação e mute do mic antes do Soundboard. Não voltar a anunciar boost de 200% na reprodução direta. Perfil/chat/Studio continuam local/P2P. Testes de handlers usam adapters; tentativa de WebRTC local ficou sem candidatos ICE e não comprova chamada remota. Próxima ação: revisão e matriz física, sem alegar aprovação de transporte. Sem push/merge nesta etapa.

Atualização do mantenedor: publicação da branch autorizada após executar os testes disponíveis. Build e dez scripts de teste passaram; media-transport foi executado e está bloqueado por ausência de candidatos ICE. Publicação não equivale a aprovação da matriz física ou merge.

Commit de conteúdo MEDIA-001: `de8a914`. Dez scripts passaram e um teste de transporte ficou bloqueado (não aprovado). Alterações preparadas para publicação na branch `feat/media-experience-2026-11-05` conforme autorização do mantenedor; main não modificada. Este registro é o commit documental posterior, identificável pelo histórico Git.

## VISUAL-002 — 05/11/2026 — Codex/OpenAI

Branch feat/visual-fixes-2026-11-05, base d046d66 (mídia integrada PR #5). Recuperação recovery/pre-visual-fixes-2026-11-05. Referências recebidas: Clássico preto/compacto/sidebar tradicional e Moderno com navegação e membros; Moderno agora roxo. Preservados shadcn/Radix e Tailwind, sem bibliotecas novas.

Alterações: src/chat/activities.ts separa últimos 50 eventos em memória por sala; webrtcEngine não grava nem envia ChatMessage de reprodução, ignora novos eventos de clientes antigos no recebimento de chat/sync; ChatPanel filtra registros antigos por type sem apagá-los e mostra atividades separadas. Áudio/metadata P2P preservados. Temas Clássico e Moderno Roxo em theme.ts, seleção persistente nas configurações e CSS compacto; temas salvos antigos permanecem até seleção explícita. Sidebar com controles por ícone, participantes no Clássico e remoção local confirmada/recuperável. Remoção local aprovada explicitamente pelo mantenedor; não afeta outros participantes, mensagens ou arquivos. Ao remover sala ativa, captura é encerrada e o app não retorna automaticamente à sala no reinício; entrada explícita libera essa pausa. AlertDialog local composto dos primitivos shadcn/Radix Dialog existentes, role alertdialog e foco inicial em cancelar.

AvatarCrop integra seleção de PNG/JPEG/WebP até 20 MB, verificação de assinatura e decodificação, limites de 40 MP/10000 px por lado após decodificar, enquadramento quadrado com zoom e eixos, saída 512px WebP com redução automática de qualidade até limite existente de 100000 caracteres. Bitmap/URL liberados. Banner mantém processamento anterior (2 MB). Sem upload remoto ou validação de backend: infraestrutura segue ausente conforme autorização local/P2P. Decodificação depende do navegador; não há medição de pico de memória ou teste EXIF em celulares físicos.

Testes executados: npm run build e tsc passaram (avisos de bundle e preload permanecem); theme-validation 8 grupos, visual-fixes (temas/persistência/sem registros Soundboard/remoção local após reload), profile-smoke (inclui recorte/persistência), media-engine (WebAudio real sintético e adapters), studio-smoke, redesign-smoke, chat-smoke, chat-drafts e chat-model passaram. Testes atualizados para novos presets/recorte e ausência de eventos na conversa; ambiguidades de seletores corrigidas. Tentativas iniciais falharam por índices de preset/expectativa de cor e dupla submissão do recorte; corrigidas e reexecutadas.

Pendências: validação visual fina contra as capturas, acessibilidade completa, imagens de celulares com EXIF e memória sob carga; chamadas, som e tela entre dois dispositivos físicos continuam NÃO testados nesta instância (ICE/rede cloud já bloqueados na fase anterior). Não declarar reprodução remota, captura real do SO, exclusão global ou autorização no servidor como aprovadas. Exclusão global depende de backend autenticado e política de retenção. Documentação de fases anteriores é histórica: modos normal/compacto não recolocam eventos no histórico nesta fase. Atividades transitórias não persistem; eventos antigos permanecem intactos no banco. Reserva liberada para revisão ao concluir. Nenhum push/merge nesta tarefa.

Entrega VISUAL-002: commit de conteúdo `27d6c15`; reserva liberada, branch limpa para revisão. tsc e teste visual-fixes passaram após inclusão da confirmação AlertDialog. Uma execução em HMR expirou ao procurar preset; após reiniciar helper e usar módulos estáveis passou. Nenhum push/merge.


## STABILIZE-001 — 05/11/2026

Branch fix/stabilization-2026-11-05, base 89dc1bb; recuperação recovery/pre-stabilization-2026-11-05. Ler STABILIZATION.md, VERSIONING.md e README antes de continuar. Não reintroduzir lib/formats no preload (merge concatena ES/CJS). IPC exige renderer principal; captura não deve cair na primeira tela quando fonte inválida. Rodar npm run build, servidor npm run dev:renderer e npm test. Bloqueio ambiental também gera exit 1, com classificação BLOCKED. Sem push/merge ou tag estável nesta tarefa. Artefatos ignorados locais não são compartilhados automaticamente.

Entrega STABILIZE-001: conteúdo em `f9df3e8`, branch fix/stabilization-2026-11-05, candidato 2.0.0-rc.1. 14 scripts aprovados e media-transport bloqueado, build/Electron/pacote Linux verificados. Reserva liberada; este é o registro documental posterior. Nenhum push, merge ou declaração de produção.


## SECURITY-002 — 05/11/2026

SECURITY-002 em fix/security-hardening-2026-11-05, base 7bede05. Ler SECURITY_UPDATE.md e BACKEND_PROPOSAL.md. Usuário escolheu proposta de backend próprio para revisão; não instalar/publicar serviço como se os contratos já estivessem aprovados. Preservar modo local/dados. Node >=22.12; Electron runtime lazy pode exigir install.js/proxy. Override de minimatch só cobre >=7 <11: não substituir versões de API antiga usadas por glob/asar. Renderer test helper filtra novos plugins Electron :dev/:prod. Nenhum push/merge autorizado nesta tarefa.

Entrega SECURITY-002: commit de conteúdo `2f898b9`, candidato 2.0.0-rc.2. Instalação limpa/build/audit/empacotamento verificados; 15 testes passaram e 1 bloqueou por ICE; pacote Linux abriu com interface e CSP. Backend próprio proposto para revisão conforme escolha do mantenedor, não implementado. Reserva liberada; sem push/merge ou declaração de produção.


## BRAND-001 — 05/11/2026 — Codex/OpenAI

Branch feat/compact-bars-logo-2026-11-05, base cb7b93f. Barras compactadas (32px titlebar, 60/56px sala, ~32px chamada); subtítulo removido e estado de maximização sincronizado com Electron. Build e testes compact-bars/window-controls/desktop-security/electron-smoke/redesign-smoke/media-smoke passaram localmente. Arraste e aparência real maximizada/restaurada exigem desktop gráfico. Logo/PNG/ICO ainda pendentes do arquivo original solicitado: tentativa generativa alterou arte e não foi integrada. Ler COMPACT_BARS.md para arquivos, evidências e retomada. Trabalho das barras pronto para revisão; não declarar integração da logo concluída. Reserva da identidade permanece aguardando entrada, sem mudanças de motores/backend. Sem push/merge.

BRAND-001: barras em commit `7fd816d`; arquivo original da logo ainda necessário para concluir PNG/ICO e integração. Build e sete scripts locais passaram. Não declarar testes físicos de janela/arraste ou renderização da logo. Alterações locais preservadas, sem push.


## BRAND-002 — 05/11/2026 — Codex/OpenAI

Branch feat/official-logo-2026-11-05, base 9b58863. SVG oficial recebido e preservado byte a byte; fundo já transparente, branco central faz parte da arte. Exportados nove PNGs e ICO multiresolução; integrados à titlebar/rail, BrowserWindow e builder Windows/Linux. Build, official-logo, compact-bars, window-controls, electron-smoke e empacotamento Linux passaram localmente; logo também carregou no executável Linux. Windows/tray/arraste físico não aprovados. Detalhes/arquivos em OFFICIAL_LOGO.md. Pendência de arquivo de BRAND-001 resolvida; reserva liberada ao concluir revisão local. Sem push/merge nesta etapa.

BRAND-002 entregue em `8cd560e`; SVG oficial preservado, PNG/ICO e integração concluídos. Empacotamento final Linux e logo no executável verificados. Reserva liberada; nenhum push/merge.

## CHAT-UI-003 — 05/11/2026

Chat reorganizado sem tocar webrtcEngine. Testes chat-toolbar/chat-smoke e build passaram; suite completa executada e compact-bars corrigido/reexecutado com passe após ajustar subtítulo responsivo. Números são mensagem legítima conforme confirmação do usuário, sem remoção/migração de dados. Estado UI em chat/viewState, por sala e limitado; densidade usa chave antiga. Próxima etapa adicional explicitamente pedida: WORKSPACE_3_PLAN.md. Nova logo enviada em SVG no chat em 05/11/2026 substitui a marca de arcos; integrar em commit próprio.


## BRAND-003 — nova logo oficial — 05/11/2026

Codex/OpenAI · branch feat/workspace-3-2026-11-05 · base eb8f1fc. O mantenedor confirmou o SVG de duas partes como a nova logo oficial, substituindo a marca circular anterior. Fonte preservada em public/brand/logo.svg, azul-marinho #29256B e turquesa #12C9BD. mark.svg ajusta somente margens transparentes para leitura em 20px; paths e cores idênticos. Exportador gera nove PNGs transparentes e ICO com sete resoluções. Integração anterior BrowserWindow/builder preservada, sem instalar biblioteca.

Arquivos: public/brand/*, scripts/export-brand.cjs, src/components/OfficialLogo.tsx, tests/official-logo.cjs, tests/electron-smoke.cjs e documentação. Testes executados: tsc, npm run build, official-logo, compact-bars e electron-smoke passaram. Verificados hash/fidelidade dos paths/cores, transparência e tamanhos PNG, frames PNG do ICO, renderização 20px nos temas Clássico/Moderno Roxo e build Electron. Uma primeira comparação de tags falhou por serialização equivalente <path/> versus <path></path>; teste normalizado e reexecutado com passe.

Limitações: instalador/ícone do Windows, bandeja e arraste físico não testados; Tray não implementado. A marca anterior está no histórico Git. A versão 2.0.0-rc.2 continua inalterada. Esta entrega de identidade não conclui a estabilização de voz ou as demais fases WORKSPACE-3; alterações em andamento preservadas separadamente. Sem push/merge.


## WORKSPACE-3 A/B/F — 05/11/2026 — Codex/OpenAI

Branch feat/workspace-3-2026-11-05, base 8cd3dff. Diagnóstico estruturado local e limitado, relatório sem conteúdo/IDs/endereço, recuperação limitada/cancelável e preservação da voz durante perda isolada do DataConnection. Correções baseadas em caminho reproduzível, sem afirmar causa das quedas do usuário. Push-to-talk opcional com foco (F8/F9/F10), teste local de microfone e limpeza de recursos; stack/mixagem/Soundboard preservados. Arquivos/limites e critérios em VOICE_RECOVERY.md. Testes call-recovery, audio-tools, media-engine e build/tsc passaram nas execuções iniciais; suíte final ainda em execução ao registrar esta fase. Hardware/ICE/TURN e atalho global não aprovados. Sem backend ou mudança de versão; commit de conteúdo será registrado no fechamento.


## WORKSPACE-3 C/D/E — 05/11/2026 — Codex/OpenAI

Branch feat/workspace-3-2026-11-05, sobre ac501cc. Sidebar existente refinada, sem recriar aplicativo: pesquisa, favoritas locais/recentes separados, indicador real de não lidas da sala ativa, painel compacto de voz e rodapé de perfil em uma linha com tooltips/estados reais. Resize/collapse/Sheets, temas e opções detalhadas do dock preservados. useShallow evita subscrição do sidebar a micLevel e outros estados sem uso. Arquivos: LeftSidebar.tsx, index.css e workspace-sidebar.cjs; documentação em WORKSPACE_3_STATUS.md. workspace-sidebar passou localmente, incluindo teclado/mobile/persistência/temas. Sem contadores de outras salas ou DM falsos. Demais dependências externas estão explicitadas no status.


## WORKSPACE-3 — fechamento local — 05/11/2026 — Codex/OpenAI

Branch feat/workspace-3-2026-11-05. Commits de conteúdo: eb8f1fc (limpeza do chat, sem motor), 8cd3dff (nova logo oficial), ac501cc (diagnóstico/recuperação/áudio), bed3859 (sidebar/painel/rodapé). Fonte, PNGs/ICO, componentes, testes e limites por fase em WORKSPACE_3_STATUS.md e VOICE_RECOVERY.md. main não alterada; nenhum push/merge nesta tarefa. Tags locais de recuperação preservadas. Reservas liberadas para revisão.

Resultado final EXECUTADO: npm run build e tsc passaram; npm test executou 23 scripts, 22 passaram e media-transport ficou BLOCKED por ausência de candidatos ICE locais. O runner terminou exit 1 pelo bloqueio, sem falhas funcionais restantes nessa execução. Logs em build/test-logs e resumo em build/test-results.json são artefatos locais ignorados. A primeira suíte teve uma falha no fixture de call-recovery: a reconstrução esgotada removia sessões antigas como esperado e o cenário seguinte presumiu que havia um canal de chat. Fixture passou a estabelecer novo canal antes de verificar saída independente da voz; teste isolado e suíte completa repetidos com passe. A comparação de tags SVG também foi normalizada/reexecutada conforme BRAND-003. Não omitir essas tentativas na retomada.

Pacote Linux local preparado com electron-builder --linux --dir e Electron45 instalado. Executável dist-package/linux-unpacked/cbshub abriu/recarregou e passou electron-smoke com logo, CSP, preload sandboxed e captura sintética. Pacote não publicado/assinado. Avisos preexistentes: customResolver/freeze, bundle JS ~695,75kB (gzip ~204,73kB), metadata author e referências repetidas no empacotamento; sem alteração de dependências nesta entrega. Não foi reexecutado npm audit: a última auditoria zero é evidência da fase SECURITY-002, não uma nova execução.

Pendente/manual: chamadas reais em dois computadores/redes e vários participantes, ICE/STUN/TURN, suspensão/recuperação real, dispositivos físicos, vídeo/tela/Soundboard simultâneos, consumo de CPU/memória sob carga, Windows/ícones/arraste físicos, leitor de tela e revisão fina de contraste. Não declarar que todas as quedas foram corrigidas ou que o aplicativo está pronto para produção. Versão de desenvolvimento permanece 2.0.0-rc.2; selecionar próximo rc conforme VERSIONING.md antes de distribuir novo candidato. Backend próprio continua proposta para revisão; contas, ACL/salas globais, sincronização entre dispositivos, DM, anexos/pastas/GIFs e notificações do SO não implementados nesta entrega. Sem interfaces falsas.

Próximo responsável: revisar os commits separados, coletar relatório Configurações > Diagnóstico durante uma queda real e executar os gates da matriz de WORKSPACE_3_STATUS.md. No PTT usar F8/F9/F10 com foco; não confundir com atalho global. Favoritos/remoção/restauração de salas são locais; dados históricos existentes preservados.
