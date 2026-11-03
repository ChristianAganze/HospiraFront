import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';
import { cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const apiUrl = (env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');
    if (!apiUrl) {
        console.warn('[Hospira] VITE_API_BASE_URL manquant — définissez-le dans .env (ex: https://hospira.hercialabs.com/api)');
    }

    return {
        publicDir: 'assets',
        build: {
            rollupOptions: {
                input: {
                    main: resolve(import.meta.dirname, 'index.html'),
                    login: resolve(import.meta.dirname, 'login.html'),
                    admin: resolve(import.meta.dirname, 'admin.html'),
                    medecin: resolve(import.meta.dirname, 'medecin.html'),
                    secretaire: resolve(import.meta.dirname, 'secretaire.html'),
                    caisse: resolve(import.meta.dirname, 'caisse.html'),
                    laborantin: resolve(import.meta.dirname, 'laborantin.html'),
                    motdepasse: resolve(import.meta.dirname, 'motdepasse.html'),
                    portailPatient: resolve(import.meta.dirname, 'portail-patient.html'),
                }
            }
        },
        plugins: [
            {
                name: 'inject-api-url',
                transformIndexHtml(html) {
                    const url = apiUrl || '';
                    const script = `<script>window.API_BASE_URL = ${JSON.stringify(url)};</script>`;
                    return html.replace(/<head([^>]*)>/i, `<head$1>\n${script}`);
                }
            },
            {
                name: 'copy-static-js-css',
                async closeBundle() {
                    const dist = resolve(import.meta.dirname, 'dist');
                    for (const dir of ['js', 'css']) {
                        const src = resolve(import.meta.dirname, dir);
                        const dest = resolve(dist, dir);
                        if (existsSync(src)) {
                            await cp(src, dest, { recursive: true, force: true });
                            console.log(`[Hospira] Copied ${dir}/ -> dist/${dir}/`);
                        }
                    }
                }
            }
        ],
        server: {
            host: '0.0.0.0',
            port: 3000,
            allowedHosts: 'all'
        }
    };
});
