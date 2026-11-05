> Atualização atual: **2.0.0-rc.2 / SECURITY-002**. Leia [SECURITY_UPDATE.md](SECURITY_UPDATE.md). Estados anteriores são históricos.

> Estado atual em 05/11/2026: candidato **2.0.0-rc.1**, estabilização STABILIZE-001. Consulte [STABILIZATION.md](STABILIZATION.md). As seções anteriores abaixo são históricas.

# Changelog

## Não lançado — 05/11/2026

Responsável: Codex/OpenAI. Branch `audit/cbshub-v2-2026-11-05`.
Base: `5deab40aa1629a975dc72588b658569b21494c23`. Commit de documentação: `724abeaec50df76bffecb3dcd5e48a8ad6d163ba`.

### Adicionado

- Auditoria técnica de arquitetura, tecnologias, shadcn/ui, estilos, funcionalidades, Git e dependências.
- Oito documentos de desenvolvimento para estado, atividades, mudanças, roadmap, arquitetura, problemas, passagem entre IAs e reserva de tarefas.
- Branch e tag de recuperação locais; backup Git externo verificado.
- Instruções reutilizáveis de instalação e startup headless salvas na configuração cloud, com domínio PeerJS no rascunho.

### Verificado

Build e comportamento local de renderer, chat/IndexedDB, reações, Dialog e Soundboard com sinal sintético. Electron abriu em produção e com helper dev; colisão de outputs do preload no fluxo padrão foi diagnosticada. Npm audit retornou 19 dependências sinalizadas. Detalhes e falhas em ACTIVITY_LOG/PROJECT_AUDIT.

### Limitações

Sem alterações de funcionalidade ou visual; sem substituição/atualização de bibliotecas. Redesign e correções permanecem pendentes de tarefas próprias. Chamadas reais, 4K60, beacon failover e release Windows não foram validados. Documentação anterior preservada. Nenhum release ou push publicado.

## Não lançado — REDESIGN-001 — 05/11/2026

Codex/OpenAI · feat/workspace-redesign-2026-11-05 · a29e4ca. Novo workspace, sidebar ajustável/recolhível, membros opcionais, chat refinado, menus/foco, controle de voz identificado e diagnóstico organizado. Tokens grafite/verde-água e responsividade. Primitivos shadcn/Radix e Tailwind preservados, sem bibliotecas novas. Build e regressões locais passaram; mídia entre máquinas pendente. Detalhes em REDESIGN_REVIEW.md.


## Atualização — STUDIO-001 — 05/11/2026

STUDIO-001 · Codex/OpenAI · feat/cbshub-studio-2026-11-05 · 19d316f. Adicionados presets/editor/preview/library/JSON v1, imagens raster locais, layout e contraste. Slider com nome no Thumb; foco inicial de Sheet ajustado. Sem dependências novas, perfis ou backend de sincronização. Detalhes e testes em STUDIO.md.


## Atualização — PROFILE-001 — 05/11/2026

PROFILE-001 · Codex/OpenAI · feat/user-profiles-2026-11-05 · 7a88783. Perfis locais completos/editáveis, avatar/banner, status, temas de cartão, privacidade e bloqueios; projeção pública e integração P2P validadas. Sem mudança de autenticação nem dependências. Detalhes/testes/limites em PROFILES.md.


## Atualização — CHAT-002 — 05/11/2026

CHAT-002 · Codex/OpenAI · feat/chat-v2-2026-11-05 · b74272e. Chat com edição/exclusão/resposta/pin, reações idempotentes, Markdown/código/links seguros, drafts, ACK, reconciliação lógica, busca/janela limitada e três modos de eventos Soundboard. Sem dependências novas. Resultados/limites em CHAT_2.md.


## Atualização — MEDIA-001 — 05/11/2026

Controles de mídia com estados/erros e painel expandido; RTT/perda por participante; aquisição sob demanda, encerramento/rollback de capturas, handles separados de câmera/tela e reconexão com backoff. Soundboard com categorias, edição/ordem, favoritos nativos persistentes, preview isolado e preferência de eventos compartilhada com chat. Deafen aplicado às telas e sons ativos. Limite de volume individual corrigido para 100%. Sem dependências novas. Detalhes e limites em MEDIA_EXPERIENCE.md.

## VISUAL-002 — 05/11/2026 — Codex/OpenAI

Branch feat/visual-fixes-2026-11-05, base d046d66 (mídia integrada PR #5). Recuperação recovery/pre-visual-fixes-2026-11-05. Referências recebidas: Clássico preto/compacto/sidebar tradicional e Moderno com navegação e membros; Moderno agora roxo. Preservados shadcn/Radix e Tailwind, sem bibliotecas novas.

Alterações: src/chat/activities.ts separa últimos 50 eventos em memória por sala; webrtcEngine não grava nem envia ChatMessage de reprodução, ignora novos eventos de clientes antigos no recebimento de chat/sync; ChatPanel filtra registros antigos por type sem apagá-los e mostra atividades separadas. Áudio/metadata P2P preservados. Temas Clássico e Moderno Roxo em theme.ts, seleção persistente nas configurações e CSS compacto; temas salvos antigos permanecem até seleção explícita. Sidebar com controles por ícone, participantes no Clássico e remoção local confirmada/recuperável. Remoção local aprovada explicitamente pelo mantenedor; não afeta outros participantes, mensagens ou arquivos. Ao remover sala ativa, captura é encerrada e o app não retorna automaticamente à sala no reinício; entrada explícita libera essa pausa. AlertDialog local composto dos primitivos shadcn/Radix Dialog existentes, role alertdialog e foco inicial em cancelar.

AvatarCrop integra seleção de PNG/JPEG/WebP até 20 MB, verificação de assinatura e decodificação, limites de 40 MP/10000 px por lado após decodificar, enquadramento quadrado com zoom e eixos, saída 512px WebP com redução automática de qualidade até limite existente de 100000 caracteres. Bitmap/URL liberados. Banner mantém processamento anterior (2 MB). Sem upload remoto ou validação de backend: infraestrutura segue ausente conforme autorização local/P2P. Decodificação depende do navegador; não há medição de pico de memória ou teste EXIF em celulares físicos.

Testes executados: npm run build e tsc passaram (avisos de bundle e preload permanecem); theme-validation 8 grupos, visual-fixes (temas/persistência/sem registros Soundboard/remoção local após reload), profile-smoke (inclui recorte/persistência), media-engine (WebAudio real sintético e adapters), studio-smoke, redesign-smoke, chat-smoke, chat-drafts e chat-model passaram. Testes atualizados para novos presets/recorte e ausência de eventos na conversa; ambiguidades de seletores corrigidas. Tentativas iniciais falharam por índices de preset/expectativa de cor e dupla submissão do recorte; corrigidas e reexecutadas.

Pendências: validação visual fina contra as capturas, acessibilidade completa, imagens de celulares com EXIF e memória sob carga; chamadas, som e tela entre dois dispositivos físicos continuam NÃO testados nesta instância (ICE/rede cloud já bloqueados na fase anterior). Não declarar reprodução remota, captura real do SO, exclusão global ou autorização no servidor como aprovadas. Exclusão global depende de backend autenticado e política de retenção. Documentação de fases anteriores é histórica: modos normal/compacto não recolocam eventos no histórico nesta fase. Atividades transitórias não persistem; eventos antigos permanecem intactos no banco. Reserva liberada para revisão ao concluir. Nenhum push/merge nesta tarefa.


## STABILIZE-001 — 05/11/2026

Candidato 2.0.0-rc.1: preload CJS único; sandbox/IPC/navegação/captura reforçados; agrupamento linear no journal; liberação imediata de bitmap rejeitado; servidor renderer e runner de regressão versionados. Nenhuma biblioteca substituída ou atualizada. Build e pacote Linux passaram; 14 testes passaram, 1 bloqueado. Não é release de produção.


## SECURITY-002 — 05/11/2026

SECURITY-002: Electron 45.2.3, builder 26.18.0, Vite 8.3.6 e plugins compatíveis; esbuild explícito e override restrito de minimatch. CSP de produção, allowlist de capacidades, captura fail-closed e validação de presença. Novo teste de sinalização, Electron smoke ampliado e teste de rascunho desambiguado. Proposta de backend próprio adicionada. Ver SECURITY_UPDATE.md para justificativas e limites.


## BRAND-001 — 05/11/2026 — Codex/OpenAI

Branch feat/compact-bars-logo-2026-11-05, base cb7b93f. Barras compactadas (32px titlebar, 60/56px sala, ~32px chamada); subtítulo removido e estado de maximização sincronizado com Electron. Build e testes compact-bars/window-controls/desktop-security/electron-smoke/redesign-smoke/media-smoke passaram localmente. Arraste e aparência real maximizada/restaurada exigem desktop gráfico. Logo/PNG/ICO ainda pendentes do arquivo original solicitado: tentativa generativa alterou arte e não foi integrada. Ler COMPACT_BARS.md para arquivos, evidências e retomada. Trabalho das barras pronto para revisão; não declarar integração da logo concluída. Reserva da identidade permanece aguardando entrada, sem mudanças de motores/backend. Sem push/merge.


## BRAND-002 — 05/11/2026 — Codex/OpenAI

Branch feat/official-logo-2026-11-05, base 9b58863. SVG oficial recebido e preservado byte a byte; fundo já transparente, branco central faz parte da arte. Exportados nove PNGs e ICO multiresolução; integrados à titlebar/rail, BrowserWindow e builder Windows/Linux. Build, official-logo, compact-bars, window-controls, electron-smoke e empacotamento Linux passaram localmente; logo também carregou no executável Linux. Windows/tray/arraste físico não aprovados. Detalhes/arquivos em OFFICIAL_LOGO.md. Pendência de arquivo de BRAND-001 resolvida; reserva liberada ao concluir revisão local. Sem push/merge nesta etapa.

## CHAT-UI-003 — 05/11/2026

Removida a barra redundante “Conversa”, pesquisa permanente e controles duplicados. Pesquisa no cabeçalho; pins e atividades no menu da sala; densidade em Aparência com persistência. Conteúdo numérico legítimo preservado. Sem alteração do motor WebRTC nesta etapa.


## BRAND-003 — nova logo oficial — 05/11/2026

Codex/OpenAI · branch feat/workspace-3-2026-11-05 · base eb8f1fc. O mantenedor confirmou o SVG de duas partes como a nova logo oficial, substituindo a marca circular anterior. Fonte preservada em public/brand/logo.svg, azul-marinho #29256B e turquesa #12C9BD. mark.svg ajusta somente margens transparentes para leitura em 20px; paths e cores idênticos. Exportador gera nove PNGs transparentes e ICO com sete resoluções. Integração anterior BrowserWindow/builder preservada, sem instalar biblioteca.

Arquivos: public/brand/*, scripts/export-brand.cjs, src/components/OfficialLogo.tsx, tests/official-logo.cjs, tests/electron-smoke.cjs e documentação. Testes executados: tsc, npm run build, official-logo, compact-bars e electron-smoke passaram. Verificados hash/fidelidade dos paths/cores, transparência e tamanhos PNG, frames PNG do ICO, renderização 20px nos temas Clássico/Moderno Roxo e build Electron. Uma primeira comparação de tags falhou por serialização equivalente <path/> versus <path></path>; teste normalizado e reexecutado com passe.

Limitações: instalador/ícone do Windows, bandeja e arraste físico não testados; Tray não implementado. A marca anterior está no histórico Git. A versão 2.0.0-rc.2 continua inalterada. Esta entrega de identidade não conclui a estabilização de voz ou as demais fases WORKSPACE-3; alterações em andamento preservadas separadamente. Sem push/merge.
