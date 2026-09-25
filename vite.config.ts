import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true
        }
      }
    },
    // HTTPS (certificado autofirmado) solo si se pide explícitamente: ENABLE_BASIC_SSL=true
    // localhost es contexto seguro también por HTTP, así que cámara/voz funcionan igual.
    plugins: [react(), ...(env.ENABLE_BASIC_SSL === 'true' ? [basicSsl()] : [])],
    define: {
      'process.env': {
        API_KEY: env.GEMINI_API_KEY || '',
        GEMINI_API_KEY: env.GEMINI_API_KEY || ''
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
