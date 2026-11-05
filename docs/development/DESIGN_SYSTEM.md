# Design system — workspace

05/11/2026 · Codex/OpenAI · feat/workspace-redesign-2026-11-05.

Identidade: superfícies grafite, acento verde-água, contraste calmo e hierarquia por espaço e tipografia. Acentos de perfil continuam sendo dados do usuário; o tema da aplicação é único. Nenhum sistema de personalização foi implementado.

Fonte de verdade: `src/index.css`. Tokens semânticos para background, surface, surface-raised, card, popover, primary, secondary, muted, accent, destructive, success, warning, border/input/ring e overlay. Tokens de radius, elevação, largura do rail/membros, altura de cabeçalhos, tipografia micro/2xs/caption e família de sistema. Escala de espaçamento Tailwind reutilizada em incrementos consistentes. Componentes de layout usam classes semânticas centralizadas. Cores fixas de vídeo e paletas de avatar têm finalidade própria; a migração de estilos legados é incremental.

Primitivos existentes shadcn/Radix preservados: Button, Dialog, DropdownMenu, Tooltip, Tabs, Avatar, ScrollArea, Slider, Switch, Popover, Input e Separator. Sheet reutiliza Radix Dialog já instalado (portal/foco/Escape). ResizeHandle é local, sem dependência adicional: pointer capture, limites de 224–360px e teclado Left/Right/Home/End. Não foi instalado outro kit visual.

Desktop: rail permanente, navegação ajustável, conversa flexível e membros opcionais. Até 1100px membros abrem em Sheet; até 767px navegação também usa Sheet. Preferências de layout ficam em chave local separada `cbshub-workspace-layout`, sem mudar Zustand ou dados de comunicação. Estado de layout não remonta App nem reinicializa o motor.

Foco visível e ações com nomes acessíveis; tooltips nos controles; animações discretas e respeito a prefers-reduced-motion. Acessibilidade completa com leitor de tela permanece para validação manual.

Telemetria: StreamDiagnostics organiza FPS/latência/bitrate/perda da transmissão já monitorada. CPU/GPU mostram indisponibilidade porque o contrato atual não oferece esses dados. Não há números simulados; ABR multipar permanece limitado pelo motor auditado.


## Atualização — STUDIO-001 — 05/11/2026

Studio agora permite substituir os tokens de aparência com valores validados e medidas limitadas. Seis presets claros/escuros, wallpaper em camada separada e preview independente. O editor preserva cores próprias legíveis durante experimentação. Movimentos respeitam preferência de sistema e configuração explícita. Modelo/contraste em src/studio/theme.ts; especificação STUDIO.md.
