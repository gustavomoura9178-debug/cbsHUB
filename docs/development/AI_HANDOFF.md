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
