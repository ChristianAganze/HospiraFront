/**
 * api.js - Fichier central pour les appels fetch() vers le backend
 */

const API_BASE_URL = 'http://localhost/Hospira/HospiraBackend/public/api';

class ApiClient {
    static async request(endpoint, method = 'GET', data = null) {
        const url = `${API_BASE_URL}${endpoint}`;
        
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
            const responseData = await response.json();

            if (!response.ok) {
                if (response.status === 401) {
                    // Token expiré ou invalide
                    localStorage.removeItem('hospira_token');
                    localStorage.removeItem('hospira_user');
                    window.location.href = 'login.html';
                }
                throw new Error(responseData.message || 'Une erreur est survenue');
            }

            return responseData;
        } catch (error) {
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
