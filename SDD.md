# SOFTWARE DESIGN DESCRIPTION (SDD): CBSHUB CLOUD, DMs & DIRECT CALLS v3.0

Este documento rege a migração estrutural do cbsHUB de um ambiente de salas P2P locais para uma arquitetura híbrida centralizada baseada no Supabase. O design de interface permanece estritamente minimalista (Zinc Dark / Onyx), removendo interfaces de salas de teste e consolidando o foco na interação direta entre irmãos.

## 1. SISTEMA DE AUTENTICAÇÃO E CONTAS
- Substituir o uso de nomes do LocalStorage pelo sistema de Autenticação Supabase (email/senha) com persistência automática de sessão.
- Triggers PostgreSQL automáticos criam e atualizam o registro de `public.profiles` no cadastro.
- A tela de entrada de sala será substituída pela tela de login/registro limpa, mantendo o visual e a logo animada.

## 2. INFRAESTRUTURA DE AMIGOS E DM
- Painel "Amigos" integrado à barra lateral atual sem expandir a área horizontal (substituindo ou compactando o atual painel de salas).
- Interfaces para enviar pedido de amizade por nickname, aceitar/rejeitar solicitações pendentes e visualizar status de presença em tempo real (Online, Ocupado, Offline) via Supabase Realtime Presence.
- Clicar em um amigo abre o chat direto 1:1, carregando as mensagens históricas da tabela `public.messages`.

## 3. PIPELINE DE ANEXO E DOCUMENTOS NO CHAT
- **Uploader de Arquivos integrado ao input de chat:**
  - Botão "+" ao lado do input. Aceita arrastar e soltar (Drag and Drop) e seleção de múltiplos formatos.
  - Limite estrito de 50MB por arquivo (filtrado localmente para evitar estourar limites).
- **Processamento e Armazenamento (Supabase Storage):**
  - O arquivo é enviado para o bucket `cbs-attachments` usando a estrutura `dm_channels/{channel_id}/{uuid}-{nome_original}`.
  - Durante o upload, exibe progresso dinâmico com porcentagem e velocidade estimada diretamente sobre a mensagem correspondente.
- **Renderizadores Inteligentes e Seguros no Chat (chat/MessageRow.tsx):**
  - IMAGENS: Carrega thumbnail com pré-carregamento suave (Blur Hash/Fade). Abre visualização em tela cheia (lightbox) ao clicar.
  - VÍDEOS: Player embutido compacto (HTML5) com controles de áudio e velocidade de reprodução.
  - ÁUDIO: Player de áudio fino (Waveform simples ou barra de progresso) para mensagens de voz ou arquivos de música.
  - DOCUMENTOS (.txt, .md, .json, .py, .js, .ts, etc.): Card de anexo contendo ícone de arquivo correspondente, tamanho legível, botão de download e botão "Visualizar". Ao clicar em visualizar, abre um visualizador com realce de sintaxe básico (Read-Only) usando o `SafeMarkdown` para códigos ou visualização direta de texto sem baixar.

## 4. LIGAÇÃO DIRETA E HANDSHAKE WebRTC (DISCAGEM ESTILO DISCORD)
- Eliminar o conceito de Beacons estáticos e entrada em salas comuns. A conexão se torna direta de ponto a ponto (1:1).
- **Máquina de Estado de Chamadas:**
  - O originador clica no botão de Chamada de Voz ou Chamada de Vídeo na DM do amigo.
  - Envia registro `calling` para `public.signaling_calls`, disparando uma notificação por canal de sinalização Supabase Realtime.
  - O receptor recebe um modal flutuante na tela (ou notificação do Electron se o app estiver minimizado) com as opções [Atender] ou [Recusar], tocando o som de chamada em loop (`sounds.ts`).
  - [RECUSAR] ou [OCUPADO]: Encerra a máquina de estados e notifica o originador para interromper a chamada e o toque.
  - [ATENDER]: Envia o `receiver_peer_id` de volta. O originador fecha a conexão e inicia o handshake WebRTC direta de áudio/vídeo.
- **Reconexão Inteligente 1:1:** Caso a internet de um dos envolvidos oscile, tenta o handshake de reconexão direto pelo último peer_id válido, de forma silenciosa e sem banir o usuário da ligação por problemas de gateway zumbi.

## 5. PERSISTÊNCIA DE PREFERÊNCIAS NA CONTA
- Sincronização e backup na nuvem da paleta de efeitos de soundboard customizados e configurações de dispositivo de áudio/vídeo do usuário, superando a perda de preferências no LocalStorage.

## 6. REQUISITOS DE IMPLEMENTAÇÃO E QUALIDADE
- Utilizar `useMediaOutput` de forma reativa para fones e headests ao vivo na nova interface.
- Isolar a segurança por Row Level Security no Supabase para isolar mensagens, chamadas e uploads apenas para os respectivos usuários envolvidos.
- Compilação limpa com TypeScript. Execute `npx tsc --noEmit` para validação de erros de build.