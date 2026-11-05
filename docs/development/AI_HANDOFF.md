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
