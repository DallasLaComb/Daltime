import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    'process.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL),
  },
});
