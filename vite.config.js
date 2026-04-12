import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        termsOfUse: resolve(__dirname, 'terms-of-use.html'),
        privacyPolicy: resolve(__dirname, 'privacy-policy.html'),
        legalNotice: resolve(__dirname, 'legal-notice.html'),
      },
    },
  },
});
