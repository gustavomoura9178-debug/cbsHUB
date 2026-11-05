# Regressão de interface

`node tests/redesign-smoke.cjs` executa interações no Chromium contra o renderer em `127.0.0.1:5173` (iniciar com o helper cloud descrito em AI_HANDOFF). Requer Playwright disponível no host e `/usr/bin/chromium`; ambos já existem no ambiente preparado. Nenhuma dependência da aplicação foi adicionada. Para outro ambiente, preparar essas ferramentas externamente antes de rodar.

Cobre resize/limites/persistência, collapse, painel de membros, menu, diagnóstico sem métricas inventadas, mensagem offline, três viewports e Sheets/Escape. Bloqueia destinos externos e usa perfil efêmero e mídia sintética. Não valida comunicação remota. Capturas são gravadas em `/workspace/cbshub-onboarding`.

Os probes de persistência/mixagem/Electron usados na auditoria permanecem em `/workspace/cbshub-onboarding/audit-smoke.cjs`; resultados resumidos nos documentos compartilhados. Não existe script npm test nem CI. A integração futura de testes em CI está pendente de R2a, com avaliação das dependências necessárias.

# Studio

`node tests/theme-validation.cjs`: usa o TypeScript já instalado para carregar o modelo e validar oito grupos de segurança/contraste/roundtrip. Não requer navegador.

`node tests/studio-smoke.cjs`: usa os mesmos pré-requisitos de Playwright/Chromium e servidor local. Exercita preview/rollback, persistência, biblioteca, JSON, cores, fundo raster/gradiente, layout, acessibilidade e móvel. Perfis efêmeros e destinos externos bloqueados. Não testa backend nem chamadas entre máquinas. Arquivo de exemplo versionado em docs/themes/dark-modern.cbshub.json; especificação em docs/development/STUDIO.md.
