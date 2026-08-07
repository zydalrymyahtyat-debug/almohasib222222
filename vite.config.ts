import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';
import vitePluginJavascriptObfuscator from 'vite-plugin-javascript-obfuscator';

export default defineConfig(({ mode }) => {
  return {
    plugins: [
      react(), 
      mode === 'production' ? vitePluginJavascriptObfuscator({
        include: ['src/**/*.js', 'src/**/*.ts', 'src/**/*.jsx', 'src/**/*.tsx'],
        exclude: [/node_modules/],
        apply: 'build',
        debugger: true,
        options: {
          compact: true,
          controlFlowFlattening: true,
          controlFlowFlatteningThreshold: 1,
          deadCodeInjection: true,
          deadCodeInjectionThreshold: 1,
          debugProtection: true,
          debugProtectionInterval: 4000,
          disableConsoleOutput: true,
          identifierNamesGenerator: 'hexadecimal',
          log: false,
          numbersToExpressions: true,
          renameGlobals: false,
          selfDefending: true,
          simplify: true,
          splitStrings: true,
          splitStringsChunkLength: 5,
          stringArray: true,
          stringArrayCallsTransform: true,
          stringArrayEncoding: ['rc4'],
          stringArrayIndexShift: true,
          stringArrayRotate: true,
          stringArrayShuffle: true,
          stringArrayWrappersCount: 5,
          stringArrayWrappersChainedCalls: true,
          stringArrayWrappersParametersMaxCount: 5,
          stringArrayWrappersType: 'function',
          stringArrayThreshold: 1,
          transformObjectKeys: true,
          unicodeEscapeSequence: false
        }
      }) : null,
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'الدفتر الآمن',
          short_name: 'الدفتر الآمن',
          description: 'نظام المحاسبة السحابي المتكامل',
          theme_color: '#0f172a',
          background_color: '#0f172a',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/'
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
          navigateFallback: 'index.html',
          maximumFileSizeToCacheInBytes: 15000000
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâ€”file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
