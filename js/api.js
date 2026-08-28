/**
 * api.js - Client central pour les appels fetch() vers le backend Hospira
 * Base URL injectée via VITE_API_BASE_URL (window.API_BASE_URL).
 * Aucun fallback localhost / URL en dur.
 */

const API_BASE_URL = (() => {
    const raw = (typeof window !== 'undefined' && window.API_BASE_URL) ? String(window.API_BASE_URL) : '';
    return raw.trim().replace(/\/+$/, '');
})();

function ensureApiBaseUrl() {
    if (!API_BASE_URL) {
        throw new Error('Configuration API manquante: VITE_API_BASE_URL non définie. Vérifiez votre fichier .env ou la config Netlify.');
    }
}

/**
 * Échappe une chaîne pour insertion HTML sécurisée.
 */
function escapeHtml(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Système de Toast Médical Accessible
 */
function showToast(message, type = 'info', duration = 4000) {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('aria-atomic', 'true');
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.setAttribute('role', 'alert');

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'danger') icon = '⚠️';
    if (type === 'warning') icon = '🔔';

    toast.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 1.1rem;">${icon}</span>
            <div class="toast-content">${escapeHtml(message)}</div>
        </div>
        <button class="toast-close" type="button" aria-label="Fermer">✕</button>
    `;

    const closeBtn = toast.querySelector('.toast-close');
    const removeToast = () => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.2s ease';
        setTimeout(() => toast.remove(), 200);
    };

    closeBtn.addEventListener('click', removeToast);
    container.appendChild(toast);

    if (duration > 0) {
        setTimeout(removeToast, duration);
    }
}

window.showToast = showToast;
window.escapeHtml = escapeHtml;

class ApiClient {
    static async request(endpoint, method = 'GET', data = null, isFormData = false) {
        ensureApiBaseUrl();

        let cleanEndpoint = String(endpoint || '').trim();
        // Convention unifiée: endpoints sans préfixe /api (ex: /auth/login).
        // Si un appel legacy passe /api/..., on le normalise.
        if (cleanEndpoint.startsWith('/api/')) {
            cleanEndpoint = cleanEndpoint.substring(4);
        }
        if (!cleanEndpoint.startsWith('/')) {
            cleanEndpoint = '/' + cleanEndpoint;
        }
        const url = `${API_BASE_URL}${cleanEndpoint}`;

        const headers = {
            'Accept': 'application/json'
        };

        if (!(data instanceof FormData) && !isFormData) {
            headers['Content-Type'] = 'application/json';
        }

        const token = localStorage.getItem('hospira_token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const config = {
            method: method,
            headers: headers
        };

        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            config.body = (data instanceof FormData || isFormData) ? data : JSON.stringify(data);
        }

        let response;
        try {
            response = await fetch(url, config);
        } catch (err) {
            // Ne jamais exposer l'URL complète côté UI
            throw new Error('Impossible de contacter le serveur. Vérifiez votre connexion ou réessayez plus tard.');
        }

        let responseData = {};
        try {
            const text = await response.text();
            responseData = text ? JSON.parse(text) : {};
        } catch (_parseError) {
            throw new Error('Le serveur a répondu de façon inattendue (HTTP ' + response.status + ').');
        }

        // must_change_password: rediriger quel que soit le status (200 ou erreur métier)
        if (responseData && responseData.must_change_password) {
            const current = window.location.pathname.split('/').pop();
            if (current !== 'motdepasse.html') {
                window.location.href = 'motdepasse.html';
            }
            throw new Error(responseData.message || 'Vous devez changer votre mot de passe avant de continuer.');
        }

        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('hospira_token');
                localStorage.removeItem('hospira_user');
                const current = window.location.pathname.split('/').pop();
                if (current !== 'login.html' && current !== 'motdepasse.html') {
                    window.location.href = 'login.html';
                }
            }
            throw new Error(responseData.message || ('Erreur serveur (' + response.status + ').'));
        }

        return responseData;
    }

    static async login(email, password) {
        return this.request('/auth/login', 'POST', { email, password });
    }

    static async register(patientData) {
        return this.request('/auth/register', 'POST', patientData, true);
    }

    static async changePassword(oldPassword, newPassword) {
        return this.request('/auth/change-password', 'POST', { old_password: oldPassword, new_password: newPassword });
    }

    static async verifySession() {
        return this.request('/auth/me', 'GET');
    }

    static staticUrl(path) {
        if (!path) return '';
        if (/^https?:\/\//i.test(path)) return path;
        ensureApiBaseUrl();
        // path peut être du type /storage/... ou storage/... — on normalise
        const base = API_BASE_URL.replace(/\/api\/?$/i, '');
        return base + '/' + String(path).replace(/^\/+/, '');
    }

    static async updateProfile(profileData) {
        return this.request('/auth/profile', 'POST', profileData, true);
    }

    static async getStaff() {
        return this.request('/staff', 'GET');
    }

    static async createStaff(staffData) {
        return this.request('/staff', 'POST', staffData);
    }

    static async getPatients() {
        return this.request('/patients', 'GET');
    }

    static async createPatient(patientData) {
        return this.request('/patients', 'POST', patientData, true);
    }

    static async getRendezvous() {
        return this.request('/rendezvous', 'GET');
    }

    static async createRendezvous(rvData) {
        return this.request('/rendezvous', 'POST', rvData, rvData instanceof FormData);
    }

    static async getConsultations(patientId) {
        return this.request(`/consultations?patient_id=${patientId}`, 'GET');
    }

    static async createConsultation(consultationData) {
        return this.request('/consultations', 'POST', consultationData);
    }

    static async getLaboQueue() {
        return this.request('/labo/queue', 'GET');
    }

    static async createResultatExamen(formData) {
        return this.request('/resultats-examens', 'POST', formData, true);
    }

    static async getPaiementsQueue() {
        return this.request('/rendezvous/a-payer', 'GET');
    }

    static async payerRendezvous(id, paymentData = {}) {
        return this.request(`/rendezvous/${id}/payer`, 'POST', paymentData);
    }
}
