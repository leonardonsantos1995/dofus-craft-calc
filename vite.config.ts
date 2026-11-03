import { defineConfig, type ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';

// A DofusDB é chamada através de um proxy local (/dofusdb) para evitar problemas de CORS.
const proxy: Record<string, ProxyOptions> = {
  '/dofusdb': {
    target: 'https://api.dofusdb.fr',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/dofusdb/, ''),
  },
};

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, open: true, proxy },
  preview: { port: 4173, proxy },
});
