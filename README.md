# cbsHUB

Aplicativo Electron de comunicação P2P com React, TypeScript, shadcn/ui e Tailwind CSS.

Versão de revisão: **2.0.0-rc.5**. Não há aprovação para produção. Leia [a conferência atual do hotfix](docs/development/HOTFIX_ACCEPTANCE.md) e [a revisão desktop anterior](docs/development/DESKTOP_REFINEMENT.md) e [a política de versões](docs/development/VERSIONING.md).

## Instalação e execução

Requer Node >=22.12 (Electron 45). Testado neste ambiente com Node 24.22.1 e npm 11.9.0. Requer acesso aos registries e ao download do Electron; preserve certificados e configurações de proxy da sua organização.

```sh
npm ci --legacy-peer-deps
node node_modules/electron/install.js
npm run dev
```

Electron 45 baixa o runtime sob demanda; o comando install.js acima permite prepará-lo antes de executar os testes. No cloud, prefixe esse comando com ELECTRON_GET_USE_PROXY=1.

O lockfile atual exige `--legacy-peer-deps`; não foi refeito nem houve atualização incidental de dependências. No ambiente cloud com proxy, use `ELECTRON_GET_USE_PROXY=1 npm ci --legacy-peer-deps`. `npm run dev` requer sessão gráfica para abrir Electron.

```sh
npm run build
```

Gera renderer em `dist/` e main/preload em `dist-electron/`. Para abrir a build, execute `npx --no-install electron .` numa sessão gráfica. Não sirva o diretório do projeto inteiro em uma rede pública.

## Testes

Os testes de interface usam Playwright instalado no host e Chromium em `/usr/bin/chromium`, disponíveis no ambiente cloud preparado. Não são dependências da aplicação. Outro ambiente deve disponibilizar essas ferramentas ou adaptar os caminhos de teste.

```sh
npm run build
npm run dev:renderer
```

Mantenha esse renderer em um terminal e, em outro:

```sh
npm test
```

O comando executa todos os scripts `tests/*.cjs`, salva logs em `build/test-logs` e resultados em `build/test-results.json`. Bloqueio ambiental também resulta em exit 1, identificado como `BLOCKED`, sem declarar suite integralmente aprovada. Não editar fontes durante a execução dos probes: hot reload pode duplicar singletons usados pelos imports dinâmicos. Reinicie o renderer após modificar módulos centrais.

Os testes Electron headless usam `--no-sandbox` para o processo de teste no container; isso não é recomendação de configuração para distribuição. A preferência do renderer permanece `sandbox: true` e é verificada no teste.

## Rede e dados

PeerJS Cloud sinaliza as conexões; áudio/vídeo usam WebRTC. Para redes diferentes, NAT/firewalls podem exigir TURN. `.env.example` descreve configuração opcional; nunca versione credenciais reais. Esta instância cloud continua sem comprovação de transporte ICE e não representa teste entre dispositivos físicos.

Não existe backend autenticado, conta de servidor ou sincronização global. Histórico e sons usam IndexedDB; temas/perfis/preferências usam localStorage. Não limpe o perfil do navegador/Electron para atualizar ou testar persistência; use perfis efêmeros nos testes. A remoção de sala é local, não exclui dados de outros participantes. Arquivos/pastas compartilhados e GIFs não estão implementados; importação local de sons e imagens não equivale a esses recursos.

## Empacotamento

Configuração original de Windows NSIS/portable preservada: `npm run package`. Instaladores Windows exigem build e testes em ambiente apropriado; não foram produzidos ou aprovados nesta fase.

Pacote Linux de revisão produzido neste ambiente:

```sh
npm run build
npx --no-install electron-builder --linux --dir -c.electronDist=node_modules/electron/dist
```

Resultado: `dist-package/linux-unpacked/`. Distribua o diretório completo, não somente o arquivo `cbshub`: recursos e bibliotecas adjacentes são necessários. Abertura headless e reload foram testados; áudio físico, captura do SO e instalação em outro computador não foram aprovados.


### Revisão local WORKSPACE-3

A marca oficial atual está em `public/brand/logo.svg` (símbolo azul-marinho/turquesa); PNG/ICO e exportador reproduzível documentados em `public/brand/README.md`. Pesquisa do chat no cabeçalho, fixadas/atividades no menu da sala e densidade em Configurações > Aparência.

Configurações > Diagnóstico permite copiar estados recentes da chamada sem conteúdo ou endereços de rede. Configurações > Áudio inclui teste local de microfone e PTT opcional (F8/F9/F10, somente com foco). Favoritos são locais. Ler `docs/development/WORKSPACE_3_STATUS.md` e `VOICE_RECOVERY.md` para testes e limitações; este trabalho não declara versão estável nem garante recuperação em todas as redes.


### Revisão desktop — DESKTOP-004

Configurações integra Perfil e Studio; Aparência oferece Clássico, Moderno Roxo, Sakura Dream e Velvet Nocturne, mantendo presets e temas anteriores. X mantém o Electron em segundo plano (ou minimizado quando a bandeja não existe); para encerrar, use Encerrar no menu da bandeja. PTT continua limitado ao foco do aplicativo.

Efeitos Sonoros inclui corte de arquivos importados, waveform/prévia local e original preservado. O palco adapta cards à área; controles comuns ficam na sidebar, com dispositivos/opções sob demanda. Logo animada acompanha inicialização real e reconexão sustentada, sem atraso artificial.

Relatório, arquivos, testes e limitações em [DESKTOP_REFINEMENT.md](docs/development/DESKTOP_REFINEMENT.md). Backend/DM/anexos/sincronização global e notificações de mensagens do SO não são oferecidos nesta revisão. Transporte real e bandeja Windows ainda requerem matriz física.
