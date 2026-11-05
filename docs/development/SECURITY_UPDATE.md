# Segurança e proposta de backend — SECURITY-002

05/11/2026 · Codex/OpenAI · branch fix/security-hardening-2026-11-05 · base 7bede05 (PR #7 integrado). Checkout inicial limpo; recuperação recovery/pre-security-hardening-2026-11-05. Candidato **2.0.0-rc.2**, sem release de produção.

## Entregue

Atualizadas as mesmas bibliotecas: Electron 33 → 45.2.3, electron-builder 25 → 26.18.0, Vite 5 → 8.3.6, plugin React 4 → 6.2.1 e plugin Electron 0.28 → 1.2.0. Esbuild 0.28.2 declarado diretamente porque o plugin renderer existente o importa e não podia mais depender do hoisting da versão antiga do Vite. Não houve troca de React/shadcn/Tailwind/Zustand/PeerJS nem reconstrução dos motores.

Override limitado a `minimatch@>=7 <11` para a linha corrigida 11.0.1+, resolvida em 11.0.4. Mantidas as versões antigas com API de função necessárias a glob/asar/dir-compare. Instalação limpa com npm ci verificou a árvore; npm ls e empacotamento Linux passaram. macOS universal ainda exige teste na plataforma-alvo.

`npm audit` final: **zero vulnerabilidades conhecidas**, antes 19 (1 crítica, 13 altas, 5 moderadas). Isto representa o banco de advisories no momento da consulta, não ausência de risco ou aprovação de produção. Dependências transitivas depreciadas ainda existem.

Produção recebe CSP: scripts da aplicação/blob de Worklet, estilos inline necessários aos tokens, imagens/fontes/mídia locais, conexões de sinalização PeerJS explícitas; objetos/frames/base/formulários externos bloqueados. Desenvolvimento continua com HMR local e não é endpoint público de produção.

Electron concede apenas capacidades usadas (mídia, captura, fullscreen e escrita sanitizada no clipboard), somente no renderer principal e origem esperada. Demais permissões são negadas. Escolha de captura inválida limpa pendência anterior; falha na enumeração de telas recusa a captura, sem fallback automático. Permissões do SO continuam necessárias.

Presença P2P agora passa por allowlist: identidade vinculada à sessão, nickname/cor limitados, flags booleanas e campos conhecidos. Campos privados/desconhecidos não são mesclados. Pacote com nickname inválido não entra no estado nem pode provocar erro de renderização. Isto não autentica contas: o modelo local/P2P continua.

Servidor de testes atualizado para excluir os novos plugins :dev/:prod de Electron ao servir somente renderer. Config usa URL de módulo, sem __dirname. Versão rc.1 e seu pacote permanecem históricos; não foram publicados novamente com conteúdo diferente.

## Testes executados

- npm ci --legacy-peer-deps: instalação limpa passou. Electron 45 tem download lazy; install.js executado com proxy para preparar runtime.
- npm run build: passou, com preload CJS único e CSP. Renderer ~676 kB minificado / ~200 kB gzip; medição de build, não benchmark de experiência.
- npm test: **15 scripts aprovados, 1 bloqueado por ICE**. Resultado em security-002-results.json. Exit 1 total preservado; bloqueio não vira passe.
- desktop-security: origens, links, IPC, capacidades e CJS/CSP passaram.
- electron-smoke foi fortalecido: espera a interface renderizada, verifica bloqueio real de script inline pela CSP, entra/sai da voz com dispositivo sintético, verifica preload/sandbox e reload. Passou com Electron atualizado.
- signaling-validation: rejeição de presença malformada, mudança de identidade e campos desconhecidos/privados passou.
- Chat, Studio, perfis, layout, acessibilidade, captura sintética e Soundboard: regressões passaram.
- electron-builder --linux --dir com distribuição Electron instalada: pacote gerado com sucesso. Prova somente da plataforma Linux; sem assinatura/Windows/macOS.

Falhas intermediárias corrigidas: plugin renderer não encontrava esbuild; runtime Electron lazy ainda não baixado; override inicial de minimatch não estava corretamente resolvido na árvore antiga; helper de testes ainda filtrava nome antigo do plugin; teste de rascunho tinha seletor ambíguo entre feed e compositor. Nenhuma dessas tentativas foi registrada como passe antes da correção.

## Avisos e limites

Plugin renderer preservado ainda usa customResolver depreciado para Vite 9 e opção Rollup freeze ignorada pelo Vite 8. Build e regressões passaram, mas a compatibilidade futura desse plugin precisa ser acompanhada. Aviso de bundle >500 kB permanece. Não foram ocultados avisos nem atualizado Vite para 9.

Não testados: usuários reais em redes separadas, microfones/câmeras físicos, permissão de captura real do SO, hotplug, 3–6 participantes, macOS/Windows, assinatura, instalação e leitor de tela completo. ABR/stats de tela por par e testes de fotos EXIF/memória continuam pendentes. CSP/backend/tokens precisarão ser ampliados de forma explícita quando houver domínio autorizado para o backend.

## Backend e recursos ainda ausentes

O mantenedor escolheu **propor backend próprio para revisão**. Proposta concreta em BACKEND_PROPOSAL.md: arquitetura, tabelas, rotas, sessões, ownership, WebSocket, migração opt-in e testes de aceite. Não foi implementado/publicado servidor, nem inventadas credenciais ou reserva de nomes.

Contas, sincronização global, exclusão global de salas, arquivos/pastas e GIFs seguem a sequência da proposta. Dependem da revisão dos contratos e depois da infraestrutura; não estão marcados como implementados. Preservar modo local e dados atuais durante a migração. A matriz física continua sendo gate independente para estabilidade de comunicação.

Artefato local: `/workspace/cbshub-onboarding/cbshub-2.0.0-rc.2-linux-x64.tar.gz`. SHA-256: `7b24315fbbc26bb15a8e43d32f7673d3ebfbd3b24ee9083aaaf6fdf86de74d12`. Pacote Linux atualizado também passou no teste Electron com interface, CSP, chamada sintética, reload e sandbox. Arquivo fora do Git; não é release público.
