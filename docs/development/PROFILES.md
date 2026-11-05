# Perfis — PROFILE-001

05/11/2026 · Codex/OpenAI · feat/user-profiles-2026-11-05 · base 03217b8 (merge do Studio pelo PR #2).

## Escopo aprovado

O mantenedor escolheu continuar com identidade local/P2P e deixar backend para depois. Não há conta autenticada, API de usuário, sessão de servidor, storage remoto ou reserva global de nomes no repositório. A implementação não introduz nem altera autenticação. Nomes são validados e conflitos com perfis conhecidos na sala são rejeitados; não há garantia global, entre salas, com pares privados ou offline. A data exibida é criação do perfil local, não uma data de conta de servidor inventada.

## Interface e uso

Botão Meu perfil na navegação ou clique no avatar abre cartão rápido. Ver perfil completo abre a visualização ampliada com biografia completa, links compartilhados e data quando visível. Editar perfil abre formulário shadcn/Radix com abas Identidade, Aparência e Privacidade, prévia, Salvar e Cancelar. O fechamento descarta rascunho. Configurações e avatar local encaminham ao mesmo editor; não existem mais dois formulários concorrentes de identidade.

Identidade: nome de exibição, usuário, biografia, status/emoji, links HTTPS, avatar/banner e data local. Presença manual: Online/Ausente/Ocupado/Invisível/Offline. Invisível é enviado como Offline; o status não desconecta o transporte. Quem participa de sala, envia texto ou mídia continua observável no P2P. Não há detecção automática de ausência ou anonimato de conexão.

Aparência: cor, fundo, gradiente, borda de avatar (sem/anel/dupla), cartão suave/contornado/translúcido, tema do cartão herdado/escuro/claro. Não altera o tema global do Studio. Prévia mostra todos os campos do dono, enquanto a projeção pública respeita as opções de compartilhamento.

## Persistência e autorização local

`src/profiles/model.ts`: modelo v1, limites, URLs, imagens e projeção pública. `repository.ts`: localStorage `cbshub-profile-v1` e `cbshub-blocked-v1`, dono vinculado ao clientId da instalação, data de criação imutável no save. O provider usa o clientId atual, sem aceitar um proprietário informado por participante remoto. Dados inválidos/de outro proprietário não são sobrescritos silenciosamente; erro é apresentado. Quota/falha de gravação impede confirmação do save. LocalStorage não é criptografado e não resiste a código comprometido no próprio cliente: a segurança depende também do perfil do SO e do Electron. Backend autenticado e ACL de servidor permanecem pendentes.

Uploads são seleção de arquivo e processamento no próprio dispositivo, sem enviar arquivo a servidor. PNG/JPEG/WebP; SVG/URLs externos proibidos; limite de entrada 1 MB avatar/2 MB banner, dimensões até 8192px. Decodificação e reencodificação em WebP/PNG por canvas remove metadados e conteúdo não raster; crop 256×256 ou 960×320. Saída limitada a 100k/240k caracteres e assinatura raster validada antes de salvar/receber. Nome/dono/data/URLs/cores/enums têm validação runtime. Não há HTML, CSS ou JavaScript fornecido pelo usuário no cartão. Links permitem apenas HTTPS sem credenciais, abrem com noopener/noreferrer e são filtrados também na prévia ainda não salva.

## Compartilhamento e privacidade

Contrato aditivo `profile_update` com `PublicProfile | null` sobre DataConnection. O destinatário exige sessão conhecida e vincula o perfil ao peer da sessão; payload não escolhe proprietário/destinatário. Handshake fixa clientId por sessão e peerId deve coincidir com a conexão. Isso reduz substituição de estado na mesma sessão, mas NÃO autentica uma pessoa ou impede recriar identidade sem backend.

A projeção pública omite ownerId, controles de privacidade, bloqueios e campos desmarcados. Visibilidade Somente eu envia null. Opções para bio, links, imagens e data; links/data desativados por padrão. Perfil público recebido é reconstruído com allowlist; campos extras não são armazenados. Perfis remotos só ficam na memória da sessão; nenhuma cópia persistente de perfil remoto é criada. Diretório beacon e peer_state_sync excluem perfis, evitando retransmissão por terceiros. Peers antigos ignoram pacote novo e mostram identidade básica. Voltar à privacidade não apaga cópias que terceiros já receberam.

Nome de exibição, clientId, metadados de presença necessários e mensagens já enviados à sala continuam sendo parte da comunicação. Perfil privado não torna a sala privada. Alterações salvas atualizam nickname/cor e notificam peers conectados; abertura de conexão envia projeção atual.

## Bloqueio e permissões

Bloqueios são locais por clientId (até 200), persistem após reiniciar e podem ser desfeitos na aba Privacidade. Fecham mídias com a identidade, ocultam seu perfil/mensagens e impedem novas mensagens/interações recebidas e broadcasts dirigidos ao par bloqueado. Identidade básica pode permanecer na lista da sala; uma conexão de descoberta ainda pode apresentar dados básicos antes de reconhecimento do bloqueio. Histórico já armazenado não é apagado nem retirado de outras máquinas.

Permitir chamadas controla recebimento e iniciação de voz/webcam/tela, além de encerrar mídias quando desativado. Permitir reações controla operações de outros pares sobre mensagens locais; peers atualizados também respeitam o anúncio remoto. Sem backend, outras implementações podem ignorar anúncios; a proteção relevante é aplicada no receptor local. Mensagem nova deve corresponder ao clientId da sessão e sala ativa. Não há DM, lista de amigos ou convites de conta a implementar nesta etapa. Bloqueio não é uma proibição global nem impede um usuário de criar novo clientId.

## Testes e limites

- `node tests/profile-validation.cjs`: 7 grupos — propriedade local, URLs/injeções, raster/SVG, limites/username, projeção privada, invisível/offline e reconstrução remota sem campos privados.
- `node tests/profile-smoke.cjs`: formulário/upload real, persistência após reload, cancelamento, dois contextos com entrega via handler real usando ponte local de pacotes, campos privados omitidos, cartão completo, bloqueio persistente, rejeição de mídia/mensagem, chamadas e reações negadas em sessão conhecida, viewport móvel. A ponte local NÃO é teste de sinalização/ICE pela internet.
- Regressões do Studio e redesign passaram; probe core passou para compositor/DB/reação/modal/WAV/mixagem/stopAll e API Electron. Build TypeScript/Vite/Electron passou, com avisos prévios de bundle/preload.

Não executados: chamadas reais entre máquinas, servidor de autorização, reserva global de nome, Windows/hardware/4K60, leitor de tela completo. K01 e demais riscos anteriores do motor permanecem; o diff inclui os pontos de integração/permissão e formatação do arquivo do motor. Testes de backend só serão possíveis quando ele existir. Sem dependências novas, force push ou alteração direta em main. Entrega para revisão; próximo passo é validar compatibilidade multipar e definir backend quando autorizado, sem alegar garantias de conta nesta implementação.
