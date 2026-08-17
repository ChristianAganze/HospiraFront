import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const apiUrl = env.VITE_API_BASE_URL || 'http://localhost/Hospira/HospiraBackend/public/api';

    return {
        publicDir: 'public',
        build: {
            rollupOptions: {
                input: {
                    main: resolve(__dirname, 'index.html'),
                    login: resolve(__dirname, 'login.html'),
                    admin: resolve(__dirname, 'admin.html'),
                    medecin: resolve(__dirname, 'medecin.html'),
                    secretaire: resolve(__dirname, 'secretaire.html'),
                    caisse: resolve(__dirname, 'caisse.html'),
                    laborantin: resolve(__dirname, 'laborantin.html'),
                    motdepasse: resolve(__dirname, 'motdepasse.html'),
                    portailPatient: resolve(__dirname, 'portail-patient.html'),
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
            }
        ],
        server: {
            port: 5173,
            open: true
        }
    };
});
