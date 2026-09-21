import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Em desenvolvimento, redireciona chamadas /api para o backend Java (Spring Boot).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  }
});
