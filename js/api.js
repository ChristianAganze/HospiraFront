/**
 * api.js - Fichier central pour les appels fetch() vers le backend
 */

// API_BASE_URL :
//  1) window.API_BASE_URL si défini (déploiement personnalisé)
//  2) sinon, le backend est servi par Apache (port 80) sur le même hôte
//     que le frontend : //<hôte>/Hospira/HospiraBackend/public/api
//     Fonctionne donc que le frontend soit servi par Vite (localhost:5173),
//     par Apache sous /Hospira/..., ou via une adresse IP du LAN.
const API_BASE_URL = window.API_BASE_URL || (() => {
    const host = window.location.hostname || 'localhost';
    // Si la page est ouverte en file:// (double-clic), une URL relative au
    // protocole ("//host/...") serait résolue en "file://host/..." et échouerait.
    // On force donc http: dans ce cas.
    const proto = (window.location.protocol === 'file:' || window.location.protocol === '') ? 'http:' : window.location.protocol;
    return proto + '//' + host + '/Hospira/HospiraBackend/public/api';
})();

class ApiClient {
    static async request(endpoint, method = 'GET', data = null) {
        let cleanEndpoint = endpoint;
        if (cleanEndpoint.startsWith('/api/')) {
            cleanEndpoint = cleanEndpoint.substring(4);
        }
        const url = `${API_BASE_URL}${cleanEndpoint}`;
        
        const headers = {
            'Accept': 'application/json'
        };

        // Si data n'est pas un FormData, on ajoute le Content-Type JSON
        if (!(data instanceof FormData)) {
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

        if (data && (method === 'POST' || method === 'PUT')) {
            config.body = data instanceof FormData ? data : JSON.stringify(data);
        }

        try {
            const response = await fetch(url, config);

            let responseData = {};
            try {
                responseData = await response.json();
            } catch (parseError) {
                // Réponse vide ou non-JSON (ex: backend planté, page HTML renvoyée)
                console.error('Réponse non-JSON:', parseError);
                throw new Error('Le serveur a répondu de façon inattendue. Vérifiez que Apache et MySQL sont bien démarrés.');
            }

            if (!response.ok) {
                if (response.status === 401) {
                    // Token expiré ou invalide
                    localStorage.removeItem('hospira_token');
                    localStorage.removeItem('hospira_user');
                    window.location.href = 'login.html';
                } else if (responseData && responseData.must_change_password) {
                    // Changement de mot de passe obligatoire avant toute action
                    window.location.href = 'motdepasse.html';
                }
                throw new Error(responseData.message || ('Erreur serveur (' + response.status + '). Veuillez réessayer.'));
            }

            return responseData;
        } catch (error) {
            // Erreur réseau / serveur inaccessible : message compréhensible
            if (error instanceof TypeError || /failed to fetch/i.test(error.message)) {
                console.error('API Error:', error);
                throw new Error('Impossible de contacter le serveur. Vérifiez que Apache et MySQL sont démarrés, puis réessayez.');
            }
            console.error('API Error:', error);
            throw error;
        }
    }

    static async login(email, password) {
        return this.request('/auth/login', 'POST', { email, password });
    }

    static async register(patientData) {
        // patientData is a FormData object
        return this.request('/auth/register', 'POST', patientData);
    }

    static async changePassword(oldPassword, newPassword) {
        return this.request('/auth/change-password', 'POST', { old_password: oldPassword, new_password: newPassword });
    }

    // URL d'un fichier uploadé (préfixe du backend + chemin stocké).
    // Évite les URL localhost codées en dur (marche en dev Vite, LAN, etc.).
    static staticUrl(path) {
        if (!path) return '';
        if (/^https?:\/\//i.test(path)) return path;
        const base = API_BASE_URL.replace(/\/api\/?$/, '');
        return base + '/' + String(path).replace(/^\/+/, '');
    }

    static async updateProfile(profileData) {
        // profileData is a FormData object containing new_password, old_password, profile_image
        return this.request('/auth/profile', 'POST', profileData);
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
        return this.request('/patients', 'POST', patientData);
    }

    static async getRendezvous() {
        return this.request('/rendezvous', 'GET');
    }

    static async createRendezvous(rvData) {
        return this.request('/rendezvous', 'POST', rvData);
    }

    static async getConsultations(patientId) {
        return this.request(`/consultations?patient_id=${patientId}`, 'GET');
    }

    static async createConsultation(consultationData) {
        return this.request('/consultations', 'POST', consultationData);
    }
}
