/**
 * api.js - Fichier central pour les appels fetch() vers le backend Hospira
 * Intègre la gestion des notifications Toast et la sérialisation des requêtes.
 */

const API_BASE_URL = window.API_BASE_URL || (() => {
    const host = window.location.hostname || '127.0.0.1';
    const proto = (window.location.protocol === 'file:' || window.location.protocol === '') ? 'http:' : window.location.protocol;
    return proto + '//' + host + '/Hospira/HospiraBackend/public/api';
})();

console.log('[Hospira] API Base URL:', API_BASE_URL);

/**
 * Système de Toast Médical Accessible
 * @param {string} message - Message à afficher
 * @param {'success'|'danger'|'warning'|'info'} type - Type de notification
 * @param {number} duration - Durée en millisecondes (défaut: 4000ms)
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
            <div class="toast-content">${message}</div>
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

class ApiClient {
    static async request(endpoint, method = 'GET', data = null, isFormData = false) {
        let cleanEndpoint = endpoint;
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

        // Si data n'est pas un FormData, on ajoute le Content-Type JSON
        if (!(data instanceof FormData) && !isFormData) {
            headers['Content-Type'] = 'application/json';
        }

        // Ajouter le token JWT si disponible
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

        try {
            console.log(`[Hospira] ${method} ${url}`);
            const response = await fetch(url, config);

            let responseData = {};
            try {
                responseData = await response.json();
            } catch (parseError) {
                console.error('[Hospira] Réponse non-JSON:', parseError, 'Status:', response.status);
                throw new Error('Le serveur a répondu de façon inattendue (HTTP ' + response.status + ').');
            }

            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.removeItem('hospira_token');
                    localStorage.removeItem('hospira_user');
                    window.location.href = 'login.html';
                } else if (responseData && responseData.must_change_password) {
                    window.location.href = 'motdepasse.html';
                }
                throw new Error(responseData.message || ('Erreur serveur (' + response.status + ').'));
            }

            return responseData;
        } catch (error) {
            console.warn('[Hospira] Erreur API:', error.message, 'URL:', url);
            if (error instanceof TypeError || /failed to fetch|NetworkError|Load failed/i.test(error.message)) {
                throw new Error('Impossible de contacter le serveur à ' + url + '. Vérifiez que votre backend Hospira est accessible.');
            }
            throw error;
        }
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

    static staticUrl(path) {
        if (!path) return '';
        if (/^https?:\/\//i.test(path)) return path;
        const base = API_BASE_URL.replace(/\/api\/?$/, '');
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

