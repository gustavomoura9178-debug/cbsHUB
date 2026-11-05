# Revisão de estabilização — STABILIZE-001

05/11/2026 · Codex/OpenAI · branch `fix/stabilization-2026-11-05` · base `89dc1bb`, PR #6 integrado. Checkout inicial limpo, reservas anteriores liberadas, recuperação local `recovery/pre-stabilization-2026-11-05`. Sem alteração direta da main, force push ou publicação de release.

**Resultado: candidato 2.0.0-rc.1 preparado para revisão. Não aprovado para produção.**

## Inventário e evidências

| Área | Estado real |
| --- | --- |
| Interface/shadcn/Tailwind | Stack preservada. Regressão de navegação, modais, resize, viewports e menus executada. |
| Temas/personalização | Sete presets, incluindo Clássico e Moderno Roxo; persistência, preview/rollback, import/export e validação executados. Sem sincronização em backend. |
| Perfis | Avatar com crop, banner, identidade e privacidade locais/P2P; persistência, edição e visualização por ponte de handlers executadas. Sem contas/username global. |
| Chat | Envio/ACK, edição, exclusão, respostas, reações, pins, busca, rascunhos e retenção executados. Dois contextos isolados, com ponte local de pacotes, não usuários reais em redes separadas. |
| Arquivos/pastas/GIFs | Compartilhamento dessas entidades não existe no modelo/protocolo/UI. Não implementado nem aprovado. Importar som/avatar é função distinta. |
| Emojis | Picker, composição e reações existem; reação e persistência cobertas nos testes de chat. Sem catálogo remoto de GIFs. |
| Voz/vídeo/tela | Implementados; captura sintética, handlers e lifecycle testados. Transporte WebRTC local tentou negociar e não recebeu candidatos ICE; mídia física e captura do SO não aprovadas. |
| Soundboard | Síntese/arquivo, retorno local, mixagem pós-mute, preview isolado, favorito/edição e eventos fora do chat verificados localmente. Sem teste auditivo remoto entre dispositivos. |
| Persistência | IndexedDB/localStorage e falhas de gravação/retry cobertos. Sem backup remoto, contas ou entrega offline global. |
| Autenticação/permissões | ClientId local e gates P2P; não há backend autenticado, ACL global ou exclusão global de sala. Modelo segue autorização local/P2P prévia do mantenedor. |
| Segurança | Validação de mensagens/perfis/temas testada; novos guards desktop/preload testados. Audit ainda aponta 19 vulnerabilidades (1 crítica, 13 altas, 5 moderadas). Não houve atualização de bibliotecas. |

## Correções realizadas

1. **K01/preload:** desabilitado o modo lib herdado do plugin no build de preload, com input Rollup e saída CJS única. Antes o merge concatenava formatos ES+CJS no mesmo caminho; agora a build emite uma vez. Preload executado em VM, Electron produção e reload, incluindo pacote Linux. Sem alteração da API de seis métodos.
2. **Desktop/K15 parcial:** renderer com sandbox ativado, IPC restrito à janela/frame principal e URL esperada; argumentos de captura e booleanos validados. Navegação para fora do renderer bloqueada; novas janelas recusadas e somente HTTP/HTTPS sem credenciais podem abrir pelo shell. Captura exige fonte selecionada e consome a escolha; fonte ausente não recai automaticamente na primeira tela. Não equivale a auditoria completa ou ausência de vulnerabilidades.
3. **Performance do journal:** agrupamento de operações passa a acrescentar em arrays, evitando copiar todo o grupo a cada operação (custo quadrático). Retenção de 500 mensagens/100 elementos DOM e 5000 operações por sala preservada. Nenhuma mudança no protocolo ou dados existentes.
4. **Memória no avatar:** bitmap de imagem rejeitada após decodificação é fechado imediatamente, em vez de permanecer até fechar editor. Limites e processamento existentes preservados. Não foi medido pico de memória do decoder com imagens de celular extremas.
5. **Reprodutibilidade:** servidor renderer e runner de testes versionados, sem dependências novas. README deixa de depender de helpers absolutos externos para repetir testes.

Arquivos de produto: `vite.config.ts`, `electron/{main,security}.ts`, `src/chat/ledger.ts`, `src/profiles/AvatarCrop.tsx`; manifesto/lock apenas para versão e comandos de execução/teste. Novos `scripts/{dev-renderer,test}.mjs` e `tests/{desktop-security,electron-smoke,stabilization-a11y}.cjs`. Documentação: README, VERSIONING, este relatório e documentos de passagem.

## Testes e resultados

Build TypeScript/Vite passou, com uma única emissão de preload. Bundle renderer ~697 kB minificado (~206 kB gzip); aviso >500 kB permanece e não foi ocultado. Nenhuma alegação de redução de bundle ou benchmark de FPS/memória.

Todos os scripts disponíveis foram executados. O runner versionado fornece logs em `build/test-logs` e resumo em `build/test-results.json`. O resultado registrado desta rodada foi **14 scripts aprovados e 1 bloqueado**, não aprovação integral da suite.

- chat-model, chat-drafts, chat-smoke: aprovação de regras, persistência, convergência lógica, limites e interface.
- profile-validation/profile-smoke: validação, crop/persistência, privacidade/bloqueio e apresentação remota por handler.
- theme-validation/studio-smoke/visual-fixes/redesign-smoke: temas, segurança de importação, persistência, layout e remoção local.
- media-engine/media-smoke: dispositivos sintéticos, falhas/rollback, mixagem WebAudio, canais independentes, captura cancelada e teardown com adapters.
- desktop-security/electron-smoke: origens, links/argumentos, CJS executável, preload sandboxed, produção e reload, argumentos de captura inválidos recusados. Pacote Linux também aberto pelo mesmo probe.
- stabilization-a11y: foco inicial em cancelar, Tab contido no diálogo, Escape e movimento reduzido do SO. Não certifica leitor de tela, todo contraste ou todos os fluxos.
- **media-transport: BLOCKED**. Chromium não ofereceu candidatos ICE; não houve comunicação entre duas pessoas reais em ambientes separados.

Uma tentativa inicial de acessibilidade falhou por renderer indisponível após reinício de configuração; foi reexecutada com servidor local e passou. `npm audit` retorna exit 1 pelas vulnerabilidades, sem audit fix/atualização automática. Bloqueios ambientais não são transformados em passes pelo runner.

## Artefato de revisão

`electron-builder --linux --dir` usando o Electron já instalado gerou `dist-package/linux-unpacked/`, versão 2.0.0-rc.1, x64. Executável e recursos devem permanecer juntos. Abertura headless/reload/preload/sandbox passaram. Não foi criado instalador Windows, nem houve assinatura, atualização automática, validação de instalação em outra máquina ou teste físico de mídia. Artefatos ignorados pelo Git; não pressupor que a outra IA os possui.

## Impedimentos e próximos passos

1. Avaliar e atualizar dependências vulneráveis em mudança revisada, preservando compatibilidade e testando mídia/empacotamento. CSP e política completa de permissões Electron ainda precisam de revisão. Sandbox e guards são mitigação parcial.
2. Executar matriz de MEDIA_EXPERIENCE em pelo menos dois dispositivos reais e depois 3–6, com redes distintas/NAT/TURN: voz/webcam/tela/áudio do SO, reconexão, entrada tardia, Soundboard, persistência e saída sem perder chat.
3. K07 (ABR/telemetria de tela globais), limites de trust de histórico P2P, perda de dados por quota/fallback local, relógios divergentes e ausência de autoridade de conta permanecem.
4. Completar auditoria de contraste sobre fundos compostos, leitor de tela, teclado em todos os menus, hotplug e imagens EXIF/memória sob carga.
5. Revisar candidato e validar instaladores na plataforma-alvo antes de autorizar 2.0.0 estável. Recursos ausentes (arquivos/pastas/GIFs/backend) exigem escopo próprio, não devem ser anunciados na release.

Arquivo local de revisão: `/workspace/cbshub-onboarding/cbshub-2.0.0-rc.1-linux-x64.tar.gz` (diretório completo Linux x64, cerca de 107 MB). SHA-256: `ae51af24e46c2be1b1e946904112ac897dc605460048b4e04a300d9723824a60`. O arquivo fica fora do Git; não é release publicado nem instalador Windows.
