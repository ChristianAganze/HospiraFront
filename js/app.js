/**
 * app.js - Logique globale de l'application (Auth Check, Layout)
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Vérification de l'authentification
    const token = localStorage.getItem('hospira_token');
    const userDataStr = localStorage.getItem('hospira_user');

    if (!token || !userDataStr) {
        // Rediriger vers la connexion si non authentifié
        window.location.href = 'login.html';
        return;
    }

    const user = JSON.parse(userDataStr);
    
    // Si c'est un patient, le rediriger vers son portail dédié
    if (user.role === 'Patient') {
        window.location.href = 'portail-patient.html';
        return;
    }

    // 2. Affichage des infos de l'utilisateur dans la sidebar
    document.getElementById('user-name').textContent = `${user.prenom} ${user.nom}`;
    document.getElementById('user-role').textContent = user.role;
    
    // Afficher l'image de profil ou les initiales
    const userImgEl = document.getElementById('user-img');
    const userInitialsEl = document.getElementById('user-initials');
    
    if (user.profile_image) {
        if(userImgEl) {
            userImgEl.src = `http://localhost/Hospira/HospiraBackend/public/${user.profile_image}`;
            userImgEl.style.display = 'block';
        }
        if(userInitialsEl) userInitialsEl.style.display = 'none';
    } else {
        if(userImgEl) userImgEl.style.display = 'none';
        if(userInitialsEl) {
            userInitialsEl.textContent = user.prenom.charAt(0) + user.nom.charAt(0);
            userInitialsEl.style.display = 'flex';
        }
    }

    // 3. Logique de déconnexion
    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('hospira_token');
        localStorage.removeItem('hospira_user');
        window.location.href = 'login.html';
    });

    // 3b. Modale de changement de mot de passe
    const btnProfile = document.getElementById('profile-btn');
    if (btnProfile) {
        btnProfile.addEventListener('click', (e) => {
            e.preventDefault();
            // Créer une modale simple ou rediriger
            window.dispatchEvent(new Event('openProfileModal'));
        });
    }

    // 2. Gestion des Rôles (Affichage conditionnel des menus)
    const navDashboard = document.getElementById('nav-dashboard');
    const navPatients = document.getElementById('nav-patients');
    const navRendezvous = document.getElementById('nav-rendezvous');
    const navCaisse = document.getElementById('nav-caisse');

    // Masquer tout par défaut
    navDashboard.parentElement.style.display = 'none';
    navPatients.parentElement.style.display = 'none';
    navRendezvous.parentElement.style.display = 'none';
    navCaisse.parentElement.style.display = 'none';

    if (user.role === 'Admin') {
        navDashboard.parentElement.style.display = 'block';
        navPatients.parentElement.style.display = 'block';
        navRendezvous.parentElement.style.display = 'block';
        navCaisse.parentElement.style.display = 'block';
    } else if (user.role === 'Secretaire') {
        navPatients.parentElement.style.display = 'block';
        navRendezvous.parentElement.style.display = 'block';
    } else if (user.role === 'Medecin') {
        navPatients.parentElement.style.display = 'block';
        navRendezvous.parentElement.style.display = 'block';
    } else if (user.role === 'Caissier') {
        navCaisse.parentElement.style.display = 'block';
    } else if (user.role === 'Secretaire') {
        navPatients.parentElement.style.display = 'block';
        navRendezvous.parentElement.style.display = 'block';
    }

    // 4. Logique de navigation (Sidebar)
    const viewDashboardAdmin = document.getElementById('view-dashboard-admin');
    const viewDashboardMedecin = document.getElementById('view-dashboard-medecin');
    const viewDashboardAccueil = document.getElementById('view-dashboard-accueil');
    const viewDashboardCaisse = document.getElementById('view-dashboard-caisse');
    
    const viewPatients = document.getElementById('view-patients');
    const viewRendezvous = document.getElementById('view-rendezvous');
    const viewCaisse = document.getElementById('view-caisse');
    const pageTitle = document.getElementById('page-title');
    const btnAddPatient = document.getElementById('btn-add-patient');

    if (!navDashboard || !navPatients || !navRendezvous || !navCaisse || !viewPatients || !viewRendezvous || !viewCaisse) {
        console.warn('Navigation elements not found on this page.');
        return;
    }

    // Fonction utilitaire pour masquer toutes les vues
    const hideAllViews = () => {
        if(viewDashboardAdmin) viewDashboardAdmin.style.display = 'none';
        if(viewDashboardMedecin) viewDashboardMedecin.style.display = 'none';
        if(viewDashboardAccueil) viewDashboardAccueil.style.display = 'none';
        if(viewDashboardCaisse) viewDashboardCaisse.style.display = 'none';
        
        viewPatients.style.display = 'none';
        viewRendezvous.style.display = 'none';
        viewCaisse.style.display = 'none';
        
        navDashboard.classList.remove('active');
        navPatients.classList.remove('active');
        navRendezvous.classList.remove('active');
        navCaisse.classList.remove('active');
        
        btnAddPatient.style.display = 'none';
        if(window.innerWidth <= 768) { document.querySelector('.nav-menu').classList.remove('show'); }
    };

    // 4. Navigation Handling
    navDashboard.addEventListener('click', (e) => {
        e.preventDefault();
        hideAllViews();
        navDashboard.classList.add('active');
        pageTitle.textContent = 'Tableau de bord';
        
        if (user.role === 'Admin') {
            if(viewDashboardAdmin) viewDashboardAdmin.style.display = 'block';
            loadDashboardStats();
        } else if (user.role === 'Medecin') {
            if(viewDashboardMedecin) viewDashboardMedecin.style.display = 'block';
            loadDashboardMedecin();
        } else if (user.role === 'Secretaire') {
            if(viewDashboardAccueil) viewDashboardAccueil.style.display = 'block';
            loadDashboardAccueil();
        } else if (user.role === 'Caissier') {
            if(viewDashboardCaisse) viewDashboardCaisse.style.display = 'block';
            loadDashboardCaisse();
        }
    });

    navPatients.addEventListener('click', (e) => {
        e.preventDefault();
        hideAllViews();
        navPatients.classList.add('active');
        viewPatients.style.display = 'block';
        pageTitle.textContent = 'Gestion des Patients';
        btnAddPatient.style.display = 'block';
    });

    navRendezvous.addEventListener('click', (e) => {
        e.preventDefault();
        hideAllViews();
        navRendezvous.classList.add('active');
        viewRendezvous.style.display = 'block';
        pageTitle.textContent = 'Agenda des Rendez-vous';
        window.dispatchEvent(new Event('loadRendezvous'));
    });

    navCaisse.addEventListener('click', (e) => {
        e.preventDefault();
        hideAllViews();
        navCaisse.classList.add('active');
        viewCaisse.style.display = 'block';
        pageTitle.textContent = 'Caisse et Facturation';
        window.dispatchEvent(new Event('loadCaisse'));
    });

    // 5. Mobile Menu Toggle
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            document.querySelector('.nav-menu').classList.toggle('show');
        });
    }

    // 6. Charger Statistiques Dashboard
    function loadDashboardStats() {
        api.request('/api/stats', 'GET')
            .then(data => {
                if (data) {
                    document.getElementById('stat-patients').textContent = data.patients || 0;
                    document.getElementById('stat-consultations').textContent = data.consultations || 0;
                    document.getElementById('stat-rendezvous').textContent = data.rendezvous || 0;
                    document.getElementById('stat-revenus').textContent = (data.revenus || 0) + ' FC';
                }
            })
            .catch(err => console.error("Erreur stats:", err));
    }

    function loadDashboardMedecin() {
        api.request('/api/rendezvous', 'GET').then(data => {
            if(data && data.records) {
                // Filtrer les RDV du médecin pour aujourd'hui
                const today = new Date().toISOString().split('T')[0];
                const rdvJour = data.records.filter(r => r.date_heure.startsWith(today) && r.medecin.nom === user.nom);
                const rdvList = document.getElementById('medecin-rdv-jour');
                const fileAttente = document.getElementById('medecin-file-attente');
                
                if(rdvJour.length > 0) {
                    rdvList.innerHTML = rdvJour.map(r => `
                        <div style="padding: 10px; border-bottom: 1px solid #eee;">
                            <strong>${r.date_heure.substring(11, 16)}</strong> - ${r.patient.prenom} ${r.patient.nom}
                        </div>
                    `).join('');
                }

                // File d'attente : On simule avec les RDV Planifiés du jour
                const attente = rdvJour.filter(r => r.statut === 'Planifié');
                if(attente.length > 0) {
                    fileAttente.innerHTML = attente.map(r => `
                        <div style="padding: 10px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>${r.patient.prenom} ${r.patient.nom}</strong><br>
                                <small class="text-muted">RDV: ${r.date_heure.substring(11, 16)}</small>
                            </div>
                            <button class="btn btn-primary" style="padding: 0.2rem 0.5rem; font-size: 0.8rem;" onclick="document.getElementById('nav-patients').click()">Ouvrir Dossier</button>
                        </div>
                    `).join('');
                }
            }
        });
    }

    function loadDashboardAccueil() {
        api.request('/api/rendezvous', 'GET').then(data => {
            if(data && data.records) {
                const today = new Date().toISOString().split('T')[0];
                const rdvJour = data.records.filter(r => r.date_heure.startsWith(today));
                const tbody = document.getElementById('accueil-flux-body');
                
                if(rdvJour.length > 0) {
                    tbody.innerHTML = rdvJour.map(r => {
                        let badge = '<span class="badge badge-warning">En Attente</span>';
                        if(r.statut === 'Terminé') badge = '<span class="badge badge-success">Terminé</span>';
                        
                        return `
                        <tr>
                            <td style="padding: 1rem 0.5rem;"><strong>${r.patient.prenom} ${r.patient.nom}</strong><br><small class="text-muted">${r.patient.id_iup}</small></td>
                            <td style="padding: 1rem 0.5rem;">${r.date_heure.substring(11, 16)}</td>
                            <td style="padding: 1rem 0.5rem;">${badge}</td>
                            <td style="padding: 1rem 0.5rem;">Dr. ${r.medecin.nom}</td>
                        </tr>
                    `}).join('');
                } else {
                    tbody.innerHTML = '<tr><td colspan="4" class="text-center">Aucun flux aujourd\'hui.</td></tr>';
                }
            }
        });
    }

    function loadDashboardCaisse() {
        api.request('/api/factures', 'GET').then(data => {
            let factures = data.records || data;
            const today = new Date().toISOString().split('T')[0];
            const facturesJour = factures.filter(f => f.date_facturation.startsWith(today) || f.statut === 'En attente');
            
            const totalJour = facturesJour.filter(f => f.statut === 'Payé').reduce((sum, f) => sum + parseFloat(f.montant_total), 0);
            document.getElementById('caisse-total-jour').textContent = totalJour + ' FC';

            const urgentes = facturesJour.filter(f => f.statut === 'En attente');
            const liste = document.getElementById('caisse-factures-urgentes');
            if(urgentes.length > 0) {
                liste.innerHTML = urgentes.map(f => `
                    <div style="padding: 10px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong>${f.patient_prenom} ${f.patient_nom}</strong><br>
                            <small class="text-muted">${f.montant_total} FC</small>
                        </div>
                        <button class="btn btn-primary" style="padding: 0.2rem 0.5rem; font-size: 0.8rem;" onclick="document.getElementById('nav-caisse').click()">Aller Caisse</button>
                    </div>
                `).join('');
            }
        });
    }

    // Load initial view
    navDashboard.click();
});
