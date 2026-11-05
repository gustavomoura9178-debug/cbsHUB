# cbsHUB 3.0 — plano incremental solicitado em 05/11/2026

Especificação recebida duas vezes (mesmo conteúdo) e referência de sidebar recebida. Pedido adicional explícito: diagnóstico e quedas de voz são prioridade máxima. Preservar stack, logo/temas, chat, Soundboard e dados existentes. O nome 3.0 é a direção de produto; não autoriza declarar versão estável nem alterar arbitrariamente o pacote.

A limpeza do chat (CHAT-UI-003) é entregue primeiro em commit independente, sem alterações do motor, conforme o pedido específico. Depois iniciar as fases abaixo com escopos/testes próprios. Não misturar correção de transporte com simples refatoração visual.

| Fase | Objetivo / arquivos previstos | Aceite e reversão |
| --- | --- | --- |
| A | Auditar lifecycle PeerJS/DataConnection/MediaConnection; módulo de diagnóstico e Configurações > Diagnóstico | Eventos locais estruturados, limitados e sem conteúdo/endereços/tokens; cópia/limpeza e teste de privacidade; commit próprio |
| B | Corrigir caminhos reproduzíveis de teardown prematuro e recuperação; webrtcEngine/mediaState | Queda transitória preserva chamada, falha definitiva tenta recuperação limitada, cancelamento cancela timers; testes controlados e limitações físicas explícitas |
| C | Sidebar em duas colunas existentes, busca/favoritos/atividade, teclado | Reusar rail/sidebar/resize/Sheets, sem DM falso/Nitro/loja; temas/viewports e persistência locais |
| D | Painel de voz compacto e rodapé de perfil | Estado de voz/reconexão, desconectar/tela/câmera/config e ícones reais, sem controles duplicados no rodapé |
| E | Refinamento de menus/altura/estados vazios/janelas pequenas | Preservar barras compactas/logo oficial; regressões visuais |
| F | Áudio compatível: PTT/teste mic e opções existentes | PTT só com foco/atalhos seguros; desligar track/pipeline corretamente e não cortar Soundboard; atalhos globais exigem Electron/teste próprio |
| G | Chat: auditar recursos existentes e mapear ausentes | Edit/delete/reply/pin/mentions/search/typing/unread já existem. DM e anexos não têm backend; não expor UI falsa |
| H | Sincronização e persistência | Sala/recentes/remover/restaurar são locais por decisão prévia; backend proposto, ainda não aprovado/implementado. Preservar dados e propor menor mudança |
| I | Segurança/performance e lifecycle | Preservar audit zero da fase anterior; medir antes de prometer CPU/memória. CSP/IPC e streams/listeners com regressão |
| J | Testes/documentação/revisão | Build e suite, falhas/bloqueios explícitos, diário/roadmap/handoff; sem force push/main ou release sem aprovação |

Dependências: B depende da evidência de A; D depende de estado de recuperação de B; H/DM/autorização global dependem de revisão do backend; testes de hardware, redes diferentes, TURN e suspensão real precisam de ambiente/dispositivos e não podem ser simulados como aprovação física.
