/**
 * medecin.js - Logique pour le tableau de bord Médecin
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Vérification de l'authentification
    const token = localStorage.getItem('hospira_token');
    const userStr = localStorage.getItem('hospira_user');

    if (!token || !userStr) {
        window.location.href = 'login.html';
        return;
    }

    const user = JSON.parse(userStr);
    const roleLower = user.role.toLowerCase();
    if (roleLower !== 'medecin' && roleLower !== 'médecin' && roleLower !== 'admin' && roleLower !== 'administrateur') {
        window.location.href = 'login.html'; 
        return;
    }

    // 2. Initialisation de l'interface (Topbar)
    document.getElementById('user-name-top').textContent = `Dr. ${user.prenom} ${user.nom}`;
    const topbarRole = user.is_assistant ? 'Assistant · ' : '';
    const topbarSpecialite = user.specialite ? ` · ${user.specialite}` : '';
    document.getElementById('user-role-top').textContent = topbarRole + user.role + topbarSpecialite;
    
    const topUserInitials = document.getElementById('topbar-user-initials');
    topUserInitials.textContent = user.prenom.charAt(0).toUpperCase() + user.nom.charAt(0).toUpperCase();

    // Topbar Dropdown
    const userMenu = document.getElementById('topbar-user-menu');
    const userDropdown = document.getElementById('user-dropdown');
    userMenu.addEventListener('click', (e) => {
        userDropdown.style.display = userDropdown.style.display === 'none' ? 'block' : 'none';
        e.stopPropagation();
    });
    window.addEventListener('click', () => {
        userDropdown.style.display = 'none';
    });

    document.getElementById('btn-logout').addEventListener('click', () => {
        localStorage.removeItem('hospira_token');
        localStorage.removeItem('hospira_user');
        window.location.href = 'login.html';
    });

    document.getElementById('btn-profil').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('modal-profile').style.display = 'flex';
    });
    document.getElementById('close-modal-profile').addEventListener('click', () => {
        document.getElementById('modal-profile').style.display = 'none';
    });

    // Mobile Sidebar Toggle
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.querySelector('.sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    function closeSidebar() {
        if (sidebar) sidebar.classList.remove('open');
        if (backdrop) backdrop.classList.remove('active');
    }
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            backdrop.classList.toggle('active');
        });
    }
    if (backdrop) {
        backdrop.addEventListener('click', closeSidebar);
    }

    // Navigation
    const navDashboard = document.getElementById('nav-dashboard');
    const navConsultation = document.getElementById('nav-consultation'); // Caché par défaut
    
    const viewDashboard = document.getElementById('view-dashboard');
    const viewConsultation = document.getElementById('view-consultation');

    function switchView(activeNav, activeView) {
        [navDashboard, navConsultation].forEach(nav => nav.classList.remove('active'));
        [viewDashboard, viewConsultation].forEach(view => view.style.display = 'none');
        activeNav.classList.add('active');
        activeView.style.display = 'block';
        if(window.innerWidth <= 768) {
             closeSidebar();
        }
    }

    navDashboard.addEventListener('click', (e) => {
        e.preventDefault();
        navConsultation.style.display = 'none';
        switchView(navDashboard, viewDashboard);
        loadAttente();
    });

    document.getElementById('btn-refresh').addEventListener('click', loadAttente);
    document.getElementById('btn-back-dashboard').addEventListener('click', () => navDashboard.click());

    // 3. Charger la Salle d'Attente
    function loadAttente() {
        ApiClient.request('/api/rendezvous', 'GET')
            .then(res => {
                const rdvs = (res && res.records) ? res.records : (Array.isArray(res) ? res : []);
                const container = document.getElementById('medecin-file-attente');
                container.innerHTML = '';
                
                // Chaque médecin (ou son assistant) ne voit que les patients
                // qui lui ont été affectés par la secrétaire (Confirmé).
                const monId = Number(user.id);
                const monSuperviseur = user.is_assistant ? Number(user.superviseur_id) : null;

                const attente = rdvs.filter(r => {
                    if (r.statut !== 'Confirmé') return false;
                    const medecinId = r.medecin && r.medecin.id ? Number(r.medecin.id) : null;
                    if (!medecinId) return false;
                    return medecinId === monId || (monSuperviseur && medecinId === monSuperviseur);
                });
                
                if (attente.length === 0) {
                    container.innerHTML = '<p class="text-muted text-center mt-2" style="padding: 2rem;">Aucun patient qui vous est affecté en salle d\'attente pour le moment.</p>';
                    return;
                }

                attente.forEach(rdv => {
                    // Support objet imbriqué patient ou champs plats
                    const patientPrenom = rdv.patient ? rdv.patient.prenom : (rdv.patient_prenom || '');
                    const patientNom = rdv.patient ? rdv.patient.nom : (rdv.patient_nom || '');
                    const patientId = rdv.patient_id;
                    const ticket = rdv.numero_passage || 'N/A';
                    const specialite = rdv.medecin && rdv.medecin.specialite ? rdv.medecin.specialite : '';
                    const card = document.createElement('div');
                    card.style.padding = '1rem';
                    card.style.border = '1px solid rgba(0,0,0,0.05)';
                    card.style.borderRadius = 'var(--radius-md)';
                    card.style.marginBottom = '1rem';
                    card.style.display = 'flex';
                    card.style.justifyContent = 'space-between';
                    card.style.alignItems = 'center';
                    card.style.background = 'var(--bg-main)';

                    card.innerHTML = `
                        <div>
                            <h4 style="margin: 0 0 0.5rem 0; color: var(--primary-dark);">🎫 #${ticket} — ${patientPrenom} ${patientNom}</h4>
                            <p style="margin: 0; font-size: 0.85rem; color: var(--text-muted);">
                                Motif: ${rdv.motif || 'Général'}${specialite ? ` <span class="badge" style="background:var(--primary-color); color:white; margin-left:0.4rem;">${specialite}</span>` : ''}
                            </p>
                        </div>
                        <button class="btn btn-primary btn-sm" onclick="demarrerConsultation(${rdv.id}, ${patientId}, '${patientPrenom} ${patientNom}')">Consulter</button>
                    `;
                    container.appendChild(card);
                });
            })
            .catch(error => {
                document.getElementById('medecin-file-attente').innerHTML = `<p class="text-danger text-center">⚠️ Erreur : ${error.message}</p>`;
            });
    }

    // 4. Démarrer Consultation
    window.demarrerConsultation = function(rdvId, patientId, patientName) {
        document.getElementById('cons-patient-id').value = patientId;
        document.getElementById('cons-rendezvous-id').value = rdvId;
        document.getElementById('consultation-patient-name').textContent = patientName;
        
        document.getElementById('form-nouvelle-consultation').reset();
        medicamentsOrdonnance = [];
        renderOrdonnance();

        navConsultation.style.display = 'flex';
        switchView(navConsultation, viewConsultation);
        
        loadHistoriquePatient(patientId);
    };

    function loadHistoriquePatient(patientId) {
        const histContainer = document.getElementById('consultation-historique');
        histContainer.innerHTML = '<p class="text-center text-muted">Chargement de l\'historique...</p>';
        
        ApiClient.request(`/api/consultations/patient/${patientId}`, 'GET')
            .then(res => {
                // Le backend retourne {records:[...]} ou un tableau direct
                const consultations = (res && res.records) ? res.records : (Array.isArray(res) ? res : []);
                histContainer.innerHTML = '';
                if(consultations.length === 0) {
                    histContainer.innerHTML = '<p class="text-center text-muted" style="padding: 1rem;">Aucun historique pour ce patient.</p>';
                    return;
                }
                
                consultations.forEach(cons => {
                    const date = new Date(cons.date_consultation || cons.created_at).toLocaleDateString('fr-FR');
                    const div = document.createElement('div');
                    div.style.borderLeft = '3px solid var(--primary-color)';
                    div.style.paddingLeft = '1rem';
                    div.style.marginBottom = '1.5rem';
                    
                    div.innerHTML = `
                        <h4 style="margin: 0 0 0.5rem 0; font-size: 0.95rem;">Le ${date} - Dr. ${cons.medecin_nom || 'Médecin'}</h4>
                        <p style="margin: 0 0 0.5rem 0; font-size: 0.85rem;"><strong>Symptômes:</strong> ${cons.symptomes}</p>
                        ${cons.diagnostic ? `<p style="margin: 0 0 0.5rem 0; font-size: 0.85rem;"><strong>Diagnostic:</strong> ${cons.diagnostic}</p>` : ''}
                        ${cons.ordonnance ? `<p style="margin: 0; font-size: 0.85rem; color: var(--secondary-color);"><strong>Ordonnance:</strong> ${cons.ordonnance}</p>` : ''}
                    `;
                    histContainer.appendChild(div);
                });
            })
            .catch(error => {
                histContainer.innerHTML = `<p class="text-center text-danger">Erreur: ${error.message}</p>`;
            });
    }

    // Gestion Ordonnance
    let medicamentsOrdonnance = [];
    document.getElementById('btn-add-medicament').addEventListener('click', () => {
        const med = document.getElementById('presc-medicament').value.trim();
        const pos = document.getElementById('presc-posologie').value.trim();
        
        if(med && pos) {
            medicamentsOrdonnance.push(`${med} - ${pos}`);
            document.getElementById('presc-medicament').value = '';
            document.getElementById('presc-posologie').value = '';
            renderOrdonnance();
        }
    });

    function renderOrdonnance() {
        const list = document.getElementById('ordonnance-list');
        list.innerHTML = '';
        medicamentsOrdonnance.forEach((item, index) => {
            const div = document.createElement('div');
            div.style.display = 'flex';
            div.style.justifyContent = 'space-between';
            div.style.background = 'white';
            div.style.padding = '0.5rem';
            div.style.borderRadius = '4px';
            div.style.marginBottom = '0.5rem';
            div.innerHTML = `
                <span style="font-size: 0.9rem;">${item}</span>
                <button type="button" onclick="removeMedicament(${index})" style="background:none; border:none; color:var(--danger-color); cursor:pointer;">&times;</button>
            `;
            list.appendChild(div);
        });
    }
    
    window.removeMedicament = function(index) {
        medicamentsOrdonnance.splice(index, 1);
        renderOrdonnance();
    };

    // Charger la liste des examens disponibles
    function loadExamensCatalog() {
        const select = document.getElementById('cons-examens');
        if (!select) return;

        ApiClient.request('/api/examens', 'GET')
            .then(res => {
                if (res && res.examens) {
                    select.innerHTML = res.examens.map(e => `
                        <option value="${e.id}">${e.nom} (${e.prix} FC)</option>
                    `).join('');
                }
            })
            .catch(() => {});
    }
    loadExamensCatalog();

    // Soumettre la consultation
    document.getElementById('form-nouvelle-consultation').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const rdvId = document.getElementById('cons-rendezvous-id').value;
        const patientId = document.getElementById('cons-patient-id').value;
        
        const consultationData = {
            patient_id: patientId,
            rendezvous_id: rdvId,
            poids: document.getElementById('cons-poids').value,
            taille: document.getElementById('cons-taille').value,
            temperature: document.getElementById('cons-temp').value,
            tension: document.getElementById('cons-tension').value,
            symptomes: document.getElementById('cons-symptomes').value,
            diagnostic: document.getElementById('cons-diagnostic').value,
            notes: document.getElementById('cons-notes').value,
            ordonnance: medicamentsOrdonnance.join('\n')
        };

        try {
            await ApiClient.request('/api/consultations', 'POST', consultationData);
            
            // Prescrire les examens sélectionnés si présents
            const selectEx = document.getElementById('cons-examens');
            if (selectEx) {
                const selectedExamens = Array.from(selectEx.selectedOptions).map(opt => opt.value);
                if (selectedExamens.length > 0) {
                    await ApiClient.request('/api/prescriptions-examens', 'POST', {
                        patient_id: patientId,
                        medecin_id: user.id,
                        examen_ids: selectedExamens
                    });
                }
            }

            // Le statut du RDV est passé à "Terminé" côté serveur par POST /api/consultations

            showToast("Consultation enregistrée avec succès !", "success");
            navDashboard.click(); // Retour à la salle d'attente
            loadAttente();
        } catch (error) {
            showToast("Erreur: " + error.message, "danger");
        }
    });

    // Init
    loadAttente();

    // Auto-refresh salle d'attente
    setInterval(() => {
        if(navDashboard && navDashboard.classList.contains('active')) {
            loadAttente();
        }
    }, 30000);
});
