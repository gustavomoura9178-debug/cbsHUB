# cbsHUB 3.0 — revisão incremental de 05/11/2026

Codex/OpenAI · branch feat/workspace-3-2026-11-05. Base origin/main 27eb0fe, preservada. O rótulo 3.0 descreve esta direção de produto; package.json continua 2.0.0-rc.2 conforme política de candidatos. Sem mudança de backend, shadcn/Radix, Tailwind, React ou Electron.

| Fase | Entrega local e arquivos | Evidência e limite |
| --- | --- | --- |
| A | callDiagnostics, CallDiagnosticsPanel, Configurações > Diagnóstico | Eventos limitados em memória, aliases, cópia/limpeza; teste call-recovery. Sem mensagem/áudio/vídeo/SDP/IP/token no relatório |
| B | Correção de teardown da mídia durante perda de dados; retries/generation/identidade de sessões | Testes controlados de perda/troca de conexão, tolerância transitória, falha definitiva, limites/cancelamento. Sem comprovação da causa de todas as quedas reais |
| C | WorkspaceRail existente + LeftSidebar com pesquisa sempre disponível, favoritas e recentes separados, indicador de não lidas da sala ativa | workspace-sidebar: persistência/filtro/teclado/mobile/temas. Resize/collapse/Sheet existentes preservados. Favoritos são locais; não há atividade/contadores inventados de outras salas |
| D | Painel inferior de voz com sala, estado, sair, tela, câmera e configurações; perfil em uma linha com mic/áudio/config e tooltips | Controles usam motor existente e estados busy. Atalhos compactos; dock expandido continua responsável por opções detalhadas de dispositivos/volume, sem nova implementação paralela |
| E | Logo oficial nova, barras compactas, toolbar redundante removida, header e estados vazios preservados | official-logo/compact-bars/chat-toolbar/redesign-smoke. Configurações medidas em 390px: scrollWidth/clientWidth 388/388, sem filhos saindo da borda direita |
| F | PTT opcional com foco e teste de microfone; opções de áudio existentes mantidas | audio-tools e media-engine medem WebAudio sintético. Atalho global não implementado; hardware físico não verificado |
| G | Chat auditado: respostas/edição/exclusão/fixadas/menções/busca/digitação/unread/Markdown seguro/links sob ação já presentes | Regressões chat-model/chat-drafts/chat-smoke/chat-toolbar. DM, anexos/prévia de imagens e notificações do SO não implementados nesta entrega; sem UI vazia |
| H | Persistência de salas/temas/perfis/mensagens mantida; favoritos e voz têm chaves separadas | Criar sala é entrar em código determinístico; remover/restaurar afeta recentes deste dispositivo conforme decisão prévia. Sincronização global depende de revisão de BACKEND_PROPOSAL.md, sem servidor paralelo |
| I | CSP/sandbox/IPC/URLs e validação existentes preservados; lifecycle e diagnósticos limitados; sidebar não assina mais micLevel/store inteiro | desktop-security/signaling-validation/stabilization-a11y e media-engine. Sem benchmark de CPU/memória ou teste de carga física; ABR/telemetria de tela por par continuam pendentes |
| J | Build, suíte e executável Linux locais; documentação compartilhada | Resultado final no diário/PROJECT_STATUS. Um bloqueio de ICE não equivale a aprovação de transporte ou produção |

## Uso e reversão

Pesquisa da conversa fica no ícone do cabeçalho; fixadas e atividades no menu da sala; densidade em Configurações > Aparência. Densidade usa a chave anterior, sem migração de mensagens. Barra permanente “Conversa” foi removida. Conteúdo numérico era mensagem legítima conforme esclarecimento do usuário e foi preservado, com quebra de textos longos.

Sidebar: favoritos pelo menu da sala, busca por nome/código, nome completo no title dos nomes truncados. cbshub-room-favorites contém no máximo 50 slugs válidos; erro de gravação aparece sem alegar sucesso. Remover/restaurar salas e confirmação existentes preservados. Contagem de mensagens novas corresponde somente à sala ativa do store, sem promessa de sincronização de salas em segundo plano. Participantes do Clássico permanecem no mesmo local.

Ver VOICE_RECOVERY.md para diagnóstico/PTT/teste e limitações de transporte. A nova marca em public/brand/logo.svg foi confirmada pelo mantenedor; mark.svg só ajusta margens transparentes. PNG/ICO e manifesto estão em public/brand. Configuração de ícones BrowserWindow/builder anterior reutilizada; nenhuma implementação Tray criada.

Commits independentes: eb8f1fc (chat sem motor), 8cd3dff (nova marca), ac501cc (voz A/B/F), seguido da sidebar C/D/E e fechamento documental. Tags recovery/pre-chat-toolbar-2026-11-05 e recovery/pre-workspace-voice-2026-11-05 permitem comparar/restaurar em branch; não fazer reset destrutivo, force push ou merge em main. Reverter mudanças novas não exige apagar nenhum banco/chave de dados existente.

## Próximos gates

1. Revisar a branch e os relatórios de diagnóstico coletados durante uma queda real; comparar estado de sinalização, dados, mídia e microfone.
2. Matriz em dois computadores reais e depois múltiplos participantes, redes separadas, perda/restauração, suspensão, troca de dispositivo, tela/câmera/Soundboard simultâneos. Depende de hardware e ICE/STUN/TURN acessível.
3. Instalação e ícones/janela no Windows, arraste/maximização físicos, acessibilidade com leitor de tela e carga prolongada. Depende das plataformas reais, sem inferir aprovação de um smoke headless.
4. Revisar proposta de backend antes de contas/ACL/DM/notificações/arquivos/pastas/GIFs/sync global. A implementação destes recursos depende do serviço aprovado e migração que preserve identidades/dados locais.
5. ABR/estatísticas de tela por participante e divisão do bundle após baseline de mídia e medição. Persistem avisos customResolver/freeze e bundle >500kB.
