import {productionCsp} from './electron/security.ts';
import { defineConfig } from 'vite';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';
import {build as bundleWithEsbuild} from 'esbuild';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const AUDIOWORKLET_SOURCE_QUERY = '?audioworklet-source';
const RNNOISE_WASM_BASE64_QUERY = '?rnnoise-wasm-base64';

/**
 * AudioWorklet.addModule() cannot load a file:// URL in packaged Electron.
 * These virtual modules keep both dev and production identical: the worklet is
 * bundled into a JS string for a Blob URL, and the package's embedded WASM
 * base64 is exposed without a runtime fetch or a separate file:// asset.
 */
function rnnoiseAssetsPlugin() {
  return {
    name: 'cbshub-rnnoise-assets',
    async load(id: string) {
      if (id.endsWith(AUDIOWORKLET_SOURCE_QUERY)) {
        const entry = id.slice(0, -AUDIOWORKLET_SOURCE_QUERY.length);
        const result = await bundleWithEsbuild({
          entryPoints: [entry],
          bundle: true,
          write: false,
          format: 'iife',
          platform: 'browser',
          target: 'es2022',
          minify: true,
          legalComments: 'none',
          define: {'import.meta.url': '""'},
          plugins: [
            {
              name: 'cbshub-rnnoise-cached-wasm-bytes',
              setup(build) {
                build.onLoad({filter: /rnnoise-sync\.js$/}, async ({path}) => {
                  const source = await readFile(path, 'utf8');
                  const stripped = source.replace(
                    /(data:application\/octet-stream;base64,)[A-Za-z0-9+/]+={0,2}/,
                    '$1',
                  );
                  if (stripped === source) {
                    throw new Error(`Embedded RNNoise WASM not found: ${path}`);
                  }
                  // The AudioWorklet receives cached bytes via processorOptions;
                  // retaining this second base64 copy would add ~1.9 MB to dist.
                  return {contents: stripped, loader: 'js'};
                });
              },
            },
          ],
        });
        const source = result.outputFiles[0]?.text;
        if (!source) throw new Error(`Empty AudioWorklet bundle: ${entry}`);
        return `export default ${JSON.stringify(source)};`;
      }

      if (id.endsWith(RNNOISE_WASM_BASE64_QUERY)) {
        const filename = id.slice(0, -RNNOISE_WASM_BASE64_QUERY.length);
        const source = await readFile(filename, 'utf8');
        const base64 = source.match(
          /data:application\/octet-stream;base64,([A-Za-z0-9+/]+={0,2})/,
        )?.[1];
        if (!base64) throw new Error(`Embedded RNNoise WASM not found: ${filename}`);
        return `export default ${JSON.stringify(base64)};`;
      }

      return null;
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  envPrefix: ['VITE_', 'SUPABASE_'],
  plugins: [
    rnnoiseAssetsPlugin(),
    {name:"cbshub-production-csp",apply:"build",transformIndexHtml(){return [{tag:"meta",attrs:{"http-equiv":"Content-Security-Policy",content:productionCsp},injectTo:"head-prepend"}];}},
    tailwindcss(),
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron', 'electron-updater'],
            },
          },
        },
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload();
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            // Disable the plugin's ES library default instead of merging format arrays.
            lib: false,
            rollupOptions: {
              input: "electron/preload.ts",
              external: ['electron'],
              output: {
                format: 'cjs',
                entryFileNames: 'preload.cjs',
                exports: 'auto',
              },
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
