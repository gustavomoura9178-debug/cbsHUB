# Chat 2.0 — CHAT-002

05/11/2026 · Codex/OpenAI · branch `feat/chat-v2-2026-11-05` · base `206dc46` (perfis integrados pelo PR #3).

## Funcionalidades e interface

TextChatSection passa a compor ChatPanel, MessageRow e SafeMarkdown. Mantém Zustand, DataConnection, IndexedDB, shadcn/Radix, Tailwind, perfis e os popovers de emoji/Soundboard existentes. Nenhuma dependência nova. Não há mudança de áudio/vídeo, autenticação, Electron ou Studio.

Envio em tempo real, edição/exclusão pelo autor, resposta por ID, reações, @menções conhecidas, digitação, não lidas, fixadas pelo autor, busca local, separadores de data, agrupamento em até cinco minutos, copiar conteúdo/código, menus de ações por botão e clique direito. Compositor expansível, Enter/Shift+Enter/IME, modo compacto/confortável e integração da densidade do Studio. Cliques em avatar/menção abrem o perfil. Fixar não cria poderes de moderação: cada participante só fixa suas próprias mensagens.

Rascunhos de texto são persistidos por sala em `cbshub-chat-draft:<slug>`; a mudança de sala remonta somente a interface de chat, não os motores. A referência de resposta pertence ao envio atual e não é persistida como parte do rascunho. Falha de gravação mantém o texto e exibe erro, permitindo reenviar. Mensagens armazenadas offline entram na recuperação da conexão. O estado “Recebida por um participante” exige ACK após persistência no receptor; não significa lida por todos ou entrega a uma conta/servidor. Sem ACK a mensagem permanece salva localmente. Edição/pin/reação confirmam gravação local, sem prometer ACK de todos os pares.

Busca cobre conteúdo/autor das últimas 500 mensagens disponíveis localmente. A janela renderiza no máximo 100 registros, com anteriores/seguintes em passos de 50; código tem altura/scroll limitados. Isso evita renderizar milhares de elementos, sem instalar um virtualizador para um histórico já limitado. Seletores e memo isolam o painel de atualizações de VU meter/telemetria e de presença de fala. O carregamento de sala limpa a lista anterior, evita aplicar resultado de outra sala e mescla histórico com envios que ocorreram durante a leitura inicial.

## Soundboard

Três opções locais persistentes: eventos normais, compactos ou somente no painel Atividades. O painel mostra os últimos 50 eventos disponíveis; ocultar o evento do feed não remove sons, mixagem ou transmissão. Busca/retenção/bloqueios continuam aplicáveis. O modo compacto/confortável também tem preferência local. Sons favoritos e demais funções do Soundboard permanecem no motor existente.

## Conteúdo seguro

SafeMarkdown produz elementos React, nunca HTML injetado. Subconjunto: negrito, itálico, tachado, código inline/cercado, citações, links e menções. HTML permanece texto; imagens/iframes/scripts não são interpretados. Não é um parser completo CommonMark. Texto tem limite de 8000 caracteres. Links aceitam apenas HTTP/HTTPS sem credenciais, com noopener/noreferrer. A prévia mostra domínio/caminho derivados da URL; não há fetch de metadados, OpenGraph, thumbnail, execução ou requisição de terceiros. Evita expor IP/atividade só por receber mensagem. Reações rejeitam chaves de protótipo; payloads e operações têm validação de tipos/sala/ator/limites.

## Persistência e protocolo

Mensagens continuam em `cbshub_local_db/messages`, sem apagar banco/clips. A leitura usa cursor reverso limitado, ordenado em apresentação por `(createdAt, id)`; gravações individuais e batches aplicam retenção de 500/sala. Erros de write em envio são propagados; envio exige armazenamento persistente disponível.

Novo banco `cbshub_chat_ledger` v1: store `operations`, chave `id`, índice `room`. Journal de até 5000 alterações por sala. Limite atingido gera erro, sem descartar operações silenciosamente. Serialização de trabalhos locais evita concorrência entre gravação/projeção. Snapshots só são regravados quando mudam. IDs deduplicam operações; ordenação `(at, id)` produz resultado estável. Reações são estados explícitos adicionar/remover, em vez de toggles não idempotentes. Exclusão grava tombstone permanente para impedir ressurreição por replay; não é apagamento criptográfico ou eliminação física de versões antigas do journal.

Contrato aditivo:

- `chat_operation`: id, roomId, messageId, actorClientId, nickname, at, kind (`edit/delete/reaction/pin`) e campos tipados content/emoji/active.
- `chat_operations_sync`: roomId e até 100 operações por pacote.
- `chat_ack`: roomId/messageId, emitido após gravação do recebimento.
- `ChatMessage`: campos opcionais replyTo, editedAt, deleted, pinned, delivery. Pacote original chat_message é preservado.

Conexão/reconexão solicita histórico, reenvia mensagens locais e publica operações do próprio ator, mesmo para IDs já conhecidos. Batches de histórico e operações verificam sala ativa, autor/sessão e limites; callbacks antigos não substituem lista de outra sala. Duplicata recebida não incrementa não lidas novamente. Handlers antigos de reação continuam para compatibilidade, mas clientes antigos não entendem edição/exclusão/pin nem oferecem a idempotência v2; todos devem atualizar para comportamento consistente.

## Permissões e limites de recuperação

O mantenedor já aprovou arquitetura local/P2P, com backend depois. Não existe backend autenticado para cumprir autorização no servidor. O receptor valida vínculo com a sessão e autor da mensagem para editar/excluir/fixar; bloqueios e permissões de reação dos perfis continuam aplicados. Isso não autentica uma pessoa nem impede recriar/forjar clientId em outro cliente. Validação de backend permanece pendente e não foi simulada.

Histórico recebido de terceiros mantém o modelo de confiança P2P já existente; não é uma fonte assinada/autoritativa. Operações de autoria só são sincronizadas pelo próprio ator. Recuperação completa de alterações requer reconectar ao autor ou já possuir o journal local. Sem autor online, um novo dispositivo pode não conhecer edições/exclusões/reação recentes de uma cópia antiga. Não existe entrega offline garantida por servidor, histórico ilimitado, revogação de cópias remotas ou relógio global. Timestamps e desempate dão ordenação determinística, sem garantir ordem causal global entre relógios distintos.

## Arquivos e verificação

Novos `src/chat/{model,ledger,SafeMarkdown,MessageRow,ChatPanel}`; wrapper TextChatSection; alterações delimitadas no protocolo/motor, ordenação de store e persistência de mensagens; CSS. Testes em `tests/chat-model.cjs`, `chat-smoke.cjs`, `chat-drafts.cjs`; pré-requisitos Playwright/Chromium e renderer em 127.0.0.1:5173 conforme tests/README.md. Reiniciar o helper dev após editar módulos centrais evita que imports dinâmicos dos probes e HMR mantenham duas instâncias do store/motor.

Resultados executados:

- 7 grupos unitários: autoria, ordem/replay, tombstone, reação/pin, sala/ator/payload, links/texto e chaves de protótipo.
- Smoke em dois contextos: envio/ACK e HTML inerte; reação repetida idempotente; exclusão de terceiro negada; edição pela UI; resposta/pin; edição offline recuperada ao reconectar logicamente; tombstone após reload; Soundboard nas atividades; rascunho/busca/janela de 100.
- Rascunhos/erros: isolamento por sala; falha de disco injetada preserva texto e permite retry; retenção de 500, janela de 100 e limpeza de não lidas.
- Regressões de perfis, Studio, navegação e core de chat/DB/áudio/Soundboard; Electron expôs API no probe local. Build executado e validado.

O transporte dos testes de dois contextos usa uma ponte local através dos handlers reais, não sinalização/ICE pela internet. Não executados: chamadas remotas reais, backend, Windows/hardware e teste de carga de rede em seis clientes. Falhas iniciais de preparação dos testes foram diagnosticadas (HMR duplicando singleton/import dinâmico e fixture de perfil antes do fim da inicialização); reinício do helper e espera de readiness corrigiram a preparação. Um erro de tipagem em ordenação de clips foi corrigido preservando o comparador original do Soundboard. Permanecem K01 do preload e aviso de bundle >500kB.
