# Identidade oficial cbsHUB

`logo.svg` é o vetor fornecido pelo mantenedor em 05/11/2026, sem alterações de bytes/paths/cores. O fundo já é transparente. O preenchimento branco central e os brancos das máscaras fazem parte da arte e foram preservados.

SHA-256 do original: `373f0b7d55b512c30fbe61fed90d1734e33bc1bba3ede2fb1646250d1350e3d5`.

`logo-N.png`: exportações transparentes de 16, 20, 24, 32, 48, 64, 128, 256 e 512 px. Canvas quadrado, proporções originais 1656:1536 preservadas, margem externa de 4% para ícones. `app.ico`: frames PNG RGBA em 16/24/32/48/64/128/256 px.

Regenerar na raiz do projeto: `node scripts/export-brand.cjs`. Requer Playwright/Chromium no host, como os testes; não é dependência de runtime. Exportação por canvas, sem geração de imagem ou redesenho. `manifest.json` registra hash e tamanhos.

Uso: titlebar/rail importam o SVG; BrowserWindow usa PNG256; electron-builder Windows usa ICO e Linux usa PNG512. Não existe sistema Tray ativo no aplicativo; o ICO pode ser reutilizado se uma tarefa futura o adicionar.
