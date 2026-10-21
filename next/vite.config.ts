import { defineConfig } from 'vitest/config';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.tsx'],
            refresh: true,
        }),
        react(),
        tailwindcss(),
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./resources/js', import.meta.url)),
        },
    },
    build: {
        // Deterministic artefact names are already content-hashed by Vite; the
        // manifest is what Laravel reads, so nothing on the server needs Node.
        manifest: 'manifest.json',
        sourcemap: false,
    },
    test: {
        environment: 'node',
        include: ['resources/js/**/*.test.{ts,tsx}'],
        environmentMatchGlobs: [['resources/js/**/*.dom.test.tsx', 'jsdom']],
    },
});
