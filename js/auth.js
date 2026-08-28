/**
 * auth.js - Module d'authentification centralisé Hospira
 * Gère: normalisation des rôles, guards, vérification session, must_change_password, token exp.
 */

const ROLES_CANONICAL = ['admin', 'medecin', 'secretaire', 'infirmier', 'caissier', 'laborantin', 'patient'];

const ROLE_ROUTE_MAP = {
    admin: 'admin.html',
    medecin: 'medecin.html',
    secretaire: 'secretaire.html',
    infirmier: 'medecin.html',
    caissier: 'caisse.html',
    laborantin: 'laborantin.html',
    patient: 'portail-patient.html'
};

function normalizeRole(role) {
    if (!role) return '';
    return String(role).trim().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function getToken() {
    try { return localStorage.getItem('hospira_token') || ''; } catch (_e) { return ''; }
}

function getUser() {
    try {
        const raw = localStorage.getItem('hospira_user');
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (_e) {
        return null;
    }
}

function setSession(token, user) {
    localStorage.setItem('hospira_token', token);
    localStorage.setItem('hospira_user', JSON.stringify(user));
}

function clearSession() {
    localStorage.removeItem('hospira_token');
    localStorage.removeItem('hospira_user');
}

function isAuthenticated() {
    const token = getToken();
    const user = getUser();
    if (!token || !user) return false;
    if (isTokenExpired(token)) return false;
    return true;
}

function isTokenExpired(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return false;
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        if (!payload.exp) return false;
        const now = Math.floor(Date.now() / 1000);
        // 30s de marge
        return payload.exp < (now - 30);
    } catch (_e) {
        return false;
    }
}

function hasRole(allowedRoles) {
    const user = getUser();
    if (!user || !user.role) return false;
    const normalized = normalizeRole(user.role);
    const allowed = allowedRoles.map(normalizeRole);
    return allowed.includes(normalized);
}

function getRouteForRole(role) {
    const n = normalizeRole(role);
    return ROLE_ROUTE_MAP[n] || 'login.html';
}

function getRouteForCurrentUser() {
    const user = getUser();
    if (!user || !user.role) return 'login.html';
    return getRouteForRole(user.role);
}

function logout(redirect = true) {
    clearSession();
    if (redirect) window.location.href = 'login.html';
}

function redirectIfMustChangePassword() {
    const user = getUser();
    if (user && user.must_change_password) {
        const current = window.location.pathname.split('/').pop();
        if (current !== 'motdepasse.html') {
            window.location.href = 'motdepasse.html';
            return true;
        }
    }
    return false;
}

/**
 * Guard pour pages protégées.
 * @param {string[]} allowedRoles - rôles canoniques autorisés (ex: ['Admin','Medecin'])
 * @returns {object|null} user si autorisé, sinon redirige et retourne null
 */
function requireAuth(allowedRoles) {
    if (!isAuthenticated()) {
        window.location.href = 'login.html';
        return null;
    }
    if (redirectIfMustChangePassword()) return null;

    const user = getUser();
    if (allowedRoles && allowedRoles.length > 0) {
        if (!hasRole(allowedRoles)) {
            window.location.href = 'login.html';
            return null;
        }
    }
    // Vérification serveur non-bloquante (rafraîchit must_change_password / rôle)
    verifySessionInBackground();
    return user;
}

function requireGuest() {
    if (isAuthenticated()) {
        const user = getUser();
        if (user && user.must_change_password) {
            window.location.href = 'motdepasse.html';
            return false;
        }
        window.location.href = getRouteForCurrentUser();
        return false;
    }
    return true;
}

async function verifySessionInBackground() {
    try {
        const data = await ApiClient.verifySession();
        // Backend peut retourner {user:{...}} ou directement l'utilisateur
        const freshUser = data.user || data.data || data;
        if (freshUser && freshUser.role) {
            const current = getUser();
            const merged = { ...current, ...freshUser };
            // Conserver le token existant, mettre à jour le user
            const token = getToken();
            setSession(token, merged);
            if (merged.must_change_password) {
                redirectIfMustChangePassword();
            }
        }
    } catch (_e) {
        // 401 déjà géré par ApiClient (logout + redirect)
    }
}

window.Auth = {
    ROLES_CANONICAL,
    ROLE_ROUTE_MAP,
    normalizeRole,
    getToken,
    getUser,
    setSession,
    clearSession,
    isAuthenticated,
    isTokenExpired,
    hasRole,
    getRouteForRole,
    getRouteForCurrentUser,
    logout,
    redirectIfMustChangePassword,
    requireAuth,
    requireGuest,
    verifySessionInBackground
};
