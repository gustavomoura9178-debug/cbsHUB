# Logo oficial — BRAND-002

05/11/2026 · Codex/OpenAI · branch feat/official-logo-2026-11-05 · base 9b58863 (PR #9 integrado). Checkout limpo antes de acrescentar assets; recuperação recovery/pre-official-logo-2026-11-05. Continuação de BRAND-001 após receber o SVG original em arquivo.

SVG preservado byte a byte, inclusive cores, paths, máscaras e preenchimento branco central. Não havia retângulo branco de fundo: a transparência original foi preservada. Nenhuma imagem generativa anterior foi utilizada. Hash original e manifesto em public/brand/README.md e manifest.json.

Recursos entregues: SVG, nove PNGs RGBA de 16 a 512 px e ICO com sete resoluções de 16 a 256 px. Exportador reproduzível em scripts/export-brand.cjs. Sem biblioteca nova, conversão por Chromium/canvas e ICO construído com frames PNG. Proporção 1656:1536 preservada com margem de segurança para ícones quadrados.

Integração: OfficialLogo compartilhado na titlebar (20×20, object-contain) e navegação, superfície neutra no rail para manter leitura das cores originais; BrowserWindow usa PNG256; electron-builder recebe ICO Windows e PNG512 Linux. Assets públicos entram no dist e no pacote existente. Alturas compactas da tarefa anterior preservadas.

Arquivos: public/brand/*; scripts/export-brand.cjs; src/components/{OfficialLogo,TitleBar,WorkspaceRail}.tsx; src/index.css; electron/main.ts; package.json (apenas configuração de ícones); tests/official-logo.cjs e electron-smoke.cjs; documentos compartilhados. Chamadas, mensagens, Soundboard, permissões e backend não foram alterados.

Testes executados: build passou; official-logo passou hash do vetor, tamanhos/alpha dos PNGs, diretório ICO, renderização/proporções/20px e temas; compact-bars passou alturas, viewports, menus e entrada/saída sintética; window-controls passou IPC de janela e eventos; electron-smoke passou produção, CSP/mic sintético e logo no executável Linux; empacotamento Linux passou. Capturas locais em /workspace/cbshub-onboarding/official-logo-classic.png e official-logo-modern.png.

Limites: ICO estruturalmente validado e configurado; não foi criado/testado instalador Windows ou verificada aparência na barra de tarefas do Windows. Arraste/maximização reais ainda exigem desktop gráfico. Sem Tray no aplicativo, não foi criado comportamento de bandeja. Mídia física/rede real mantém limites anteriores. Avisos preexistentes de Vite/bundle permanecem.

Pendência do arquivo original de BRAND-001 resolvida. Pronto para revisão da identidade e integração da branch; sem push/merge nesta etapa.
