# Regressão de interface

`node tests/redesign-smoke.cjs` executa interações no Chromium contra o renderer em `127.0.0.1:5173` (iniciar com o helper cloud descrito em AI_HANDOFF). Requer Playwright disponível no host e `/usr/bin/chromium`; ambos já existem no ambiente preparado. Nenhuma dependência da aplicação foi adicionada. Para outro ambiente, preparar essas ferramentas externamente antes de rodar.

Cobre resize/limites/persistência, collapse, painel de membros, menu, diagnóstico sem métricas inventadas, mensagem offline, três viewports e Sheets/Escape. Bloqueia destinos externos e usa perfil efêmero e mídia sintética. Não valida comunicação remota. Capturas são gravadas em `/workspace/cbshub-onboarding`.

Os probes de persistência/mixagem/Electron usados na auditoria permanecem em `/workspace/cbshub-onboarding/audit-smoke.cjs`; resultados resumidos nos documentos compartilhados. Não existe script npm test nem CI. A integração futura de testes em CI está pendente de R2a, com avaliação das dependências necessárias.

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
