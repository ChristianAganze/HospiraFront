/**
 * secretaire.js - Logique pour le tableau de bord Secrétaire
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
    if (roleLower !== 'secrétaire' && roleLower !== 'secretaire' && roleLower !== 'admin' && roleLower !== 'administrateur') {
        window.location.href = 'login.html'; 
        return;
    }

    // 2. Initialisation de l'interface (Topbar)
    document.getElementById('user-name-top').textContent = `${user.prenom} ${user.nom}`;
    document.getElementById('user-role-top').textContent = user.role;
    
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

    // 3. Navigation Sidebar
    const navRdv = document.getElementById('nav-rdv');
    const navPatients = document.getElementById('nav-patients');
    
    const viewRdv = document.getElementById('view-rdv');
    const viewPatients = document.getElementById('view-patients');

    function switchView(activeNav, activeView) {
        [navRdv, navPatients].forEach(nav => nav.classList.remove('active'));
        [viewRdv, viewPatients].forEach(view => view.style.display = 'none');
        activeNav.classList.add('active');
        activeView.style.display = 'block';
        if(window.innerWidth <= 768) {
             closeSidebar();
        }
    }

    navRdv.addEventListener('click', (e) => {
        e.preventDefault();
        switchView(navRdv, viewRdv);
        loadRendezvous();
    });

    navPatients.addEventListener('click', (e) => {
        e.preventDefault();
        switchView(navPatients, viewPatients);
        loadPatients();
    });

    // 4. Gestion des Patients
    let allPatients = [];
    function loadPatients() {
        ApiClient.request('/api/patients', 'GET')
            .then(res => {
                const patients = (res && res.records) ? res.records : (Array.isArray(res) ? res : []);
                allPatients = patients;
                renderPatients(patients);
                populatePatientSelect(patients);
            })
            .catch(error => {
                console.error("Erreur patients:", error);
                document.getElementById('patients-table-body').innerHTML = `<tr><td colspan="5" class="text-center text-danger">⚠️ Erreur de chargement.</td></tr>`;
            });
    }

    function renderPatients(patients) {
        const tbody = document.getElementById('patients-table-body');
        tbody.innerHTML = '';
        if (patients.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted" style="padding: 2rem;">Aucun patient trouvé.</td></tr>';
            return;
        }
        patients.forEach(patient => {
            const dateN = patient.date_naissance ? new Date(patient.date_naissance).toLocaleDateString('fr-FR') : '-';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding: 1rem 0.5rem; font-family: monospace;">${patient.iup}</td>
                <td style="padding: 1rem 0.5rem; font-weight: 500;">${patient.prenom} ${patient.nom}</td>
                <td style="padding: 1rem 0.5rem; color: var(--text-muted);">${dateN}</td>
                <td style="padding: 1rem 0.5rem;">${patient.sexe || '-'}</td>
                <td style="padding: 1rem 0.5rem;">${patient.telephone || '-'}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    document.getElementById('search-patient').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allPatients.filter(p => 
            p.nom.toLowerCase().includes(term) || 
            p.prenom.toLowerCase().includes(term) || 
            p.iup.toLowerCase().includes(term)
        );
        renderPatients(filtered);
    });

    // Créer un Patient
    const modalPatient = document.getElementById('modal-patient');
    const btnAddPatient = document.getElementById('btn-add-patient');
    const formPatient = document.getElementById('form-patient');

    btnAddPatient.addEventListener('click', () => {
        modalPatient.style.display = 'flex';
        formPatient.reset();
    });

    document.getElementById('close-modal-patient').addEventListener('click', () => modalPatient.style.display = 'none');

    formPatient.addEventListener('submit', async (e) => {
        e.preventDefault();
        const patientData = {
            nom: document.getElementById('patient-nom').value.trim(),
            prenom: document.getElementById('patient-prenom').value.trim(),
            date_naissance: document.getElementById('patient-date-naissance').value,
            sexe: document.getElementById('patient-sexe').value,
            telephone: document.getElementById('patient-telephone').value,
            adresse: document.getElementById('patient-adresse').value
        };

        try {
            await ApiClient.request('/api/patients', 'POST', patientData);
            modalPatient.style.display = 'none';
            loadPatients();
            showToast("Patient ajouté avec succès !");
        } catch (error) {
            showToast(error.message || "Erreur lors de l'ajout du patient", "danger");
        }
    });

    // 5. Gestion des Rendez-vous
    function loadRendezvous() {
        ApiClient.request('/api/rendezvous', 'GET')
            .then(res => {
                const rdvs = (res && res.records) ? res.records : (Array.isArray(res) ? res : []);
                const tbody = document.getElementById('rdv-table-body');
                tbody.innerHTML = '';
                if (rdvs.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted" style="padding: 2rem;">Aucun rendez-vous.</td></tr>';
                    return;
                }
                
                // On trie pour afficher les "En attente" en premier
                rdvs.sort((a, b) => {
                    if(a.statut === 'En attente' && b.statut !== 'En attente') return -1;
                    if(a.statut !== 'En attente' && b.statut === 'En attente') return 1;
                    return new Date(b.date_heure) - new Date(a.date_heure);
                });

                rdvs.forEach(rdv => {
                    const dateObj = new Date(rdv.date_heure);
                    const isToday = dateObj.toDateString() === new Date().toDateString();
                    const dateStr = isToday ? "Aujourd'hui" : dateObj.toLocaleDateString('fr-FR');
                    
                    // Support objet imbriqué ou champs plats
                    const patientPrenom = rdv.patient ? rdv.patient.prenom : (rdv.patient_prenom || '');
                    const patientNom = rdv.patient ? rdv.patient.nom : (rdv.patient_nom || '');
                    const medecinNom = rdv.medecin ? rdv.medecin.nom : (rdv.medecin_nom || '');
                    const medecinPrenom = rdv.medecin ? rdv.medecin.prenom : (rdv.medecin_prenom || '');
                    const medecinSpecialite = rdv.medecin ? rdv.medecin.specialite : (rdv.medecin_specialite || null);
                    
                    const hasPreuve = rdv.preuve_paiement_path ? `<br><span class="badge badge-info" style="font-size:0.7rem;">💳 Reçu Joint</span>` : '';
                    let statutBadge = `<span class="badge badge-neutral">En attente</span>${hasPreuve}`;
                    let actionBtn = `<button class="btn btn-primary" onclick="openValiderModal(${rdv.id}, '${rdv.preuve_paiement_path || ''}', ${rdv.medecin ? rdv.medecin.id : 'null'})" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;">Affecter & Valider</button>`;
                    
                    if(rdv.statut === 'À payer') {
                        statutBadge = `<span class="badge badge-warning">À payer</span>${hasPreuve}`;
                        actionBtn = `-`;
                    } else if(rdv.statut === 'Confirmé') {
                        statutBadge = `<span class="badge badge-success">Confirmé</span>${hasPreuve}`;
                        actionBtn = `-`;
                    } else if(rdv.statut === 'Annulé') {
                        statutBadge = `<span class="badge badge-danger">Annulé</span>`;
                        actionBtn = `-`;
                    } else if(rdv.statut === 'Terminé') {
                        statutBadge = `<span class="badge badge-info">Terminé</span>`;
                        actionBtn = `-`;
                    }

                    const tr = document.createElement('tr');
                    tr.style.borderBottom = '1px solid rgba(0,0,0,0.05)';
                    tr.innerHTML = `
                        <td style="padding: 1rem 0.5rem; font-weight:500;">
                            ${dateStr} <br><small style="color:var(--text-muted); font-weight:normal;">${statutBadge}</small>
                        </td>
                        <td style="padding: 1rem 0.5rem;">${patientPrenom} ${patientNom}</td>
                        <td style="padding: 1rem 0.5rem;">${medecinNom ? 'Dr. ' + medecinPrenom + ' ' + medecinNom + (medecinSpecialite ? ' <small style="color:var(--text-muted);">(' + medecinSpecialite + ')</small>' : '') : '<span style="background:rgba(245,158,11,0.12); color:#b45309; padding:4px 12px; border-radius:20px; font-weight:600; font-size:0.85rem;">À affecter</span>'}</td>
                        <td style="padding: 1rem 0.5rem; color: var(--text-muted);">${rdv.motif || '-'}</td>
                        <td style="padding: 1rem 0.5rem;">${actionBtn}</td>
                    `;
                    tbody.appendChild(tr);
                });
            })
            .catch(error => {
                document.getElementById('rdv-table-body').innerHTML = `<tr><td colspan="5" class="text-center text-danger">⚠️ Erreur: ${error.message}</td></tr>`;
            });
    }

    // Prendre un RDV
    const modalRdv = document.getElementById('modal-rendezvous');
    const btnAddRdv = document.getElementById('btn-add-rdv');
    const formRdv = document.getElementById('form-rendezvous');

    function populatePatientSelect(patients) {
        const select = document.getElementById('rdv-patient-select');
        select.innerHTML = '<option value="">Sélectionnez un patient</option>';
        patients.forEach(p => {
            select.innerHTML += `<option value="${p.id}">${p.prenom} ${p.nom} (${p.iup})</option>`;
        });
    }

    btnAddRdv.addEventListener('click', () => {
        modalRdv.style.display = 'flex';
        formRdv.reset();
        
        // Load medecins
        ApiClient.request('/api/users/staff', 'GET')
            .then(staff => {
                const select = document.getElementById('rdv-medecin-select');
                select.innerHTML = '<option value="">(Facultatif)</option>';
                staff.filter(s => s.role === 'Medecin' && !(s.is_assistant == 1)).forEach(m => {
                    select.innerHTML += `<option value="${m.id}">Dr. ${m.prenom} ${m.nom}${m.specialite ? ` — ${m.specialite}` : ''}</option>`;
                });
            });
    });

    document.getElementById('close-modal-rdv').addEventListener('click', () => modalRdv.style.display = 'none');

    formRdv.addEventListener('submit', async (e) => {
        e.preventDefault();
        const rdvData = {
            patient_id: document.getElementById('rdv-patient-select').value,
            medecin_id: document.getElementById('rdv-medecin-select').value || null,
            date_prevue: document.getElementById('rdv-date').value,
            motif: document.getElementById('rdv-motif').value
        };

        try {
            await ApiClient.request('/api/rendezvous', 'POST', rdvData);
            modalRdv.style.display = 'none';
            loadRendezvous();
            showToast("Rendez-vous créé (En attente).", "success");
        } catch(error) {
            showToast(error.message, "danger");
        }
    });

    // Valider un RDV (Secrétaire -> À Payer)
    const modalValider = document.getElementById('modal-valider');
    const formValider = document.getElementById('form-valider');
    
    window.openValiderModal = function(id, preuvePath, medecinId) {
        document.getElementById('valider-rdv-id').value = id;
        document.getElementById('valider-ticket').value = 'T-' + Math.floor(100 + Math.random() * 900);
        document.getElementById('valider-direct').checked = false;

        // Charger les médecins (avec spécialité) et pré-sélectionner celui déjà affecté
        ApiClient.request('/api/medecins', 'GET')
            .then(res => {
                const medecins = (res && res.records) ? res.records : [];
                const select = document.getElementById('valider-medecin-select');
                select.innerHTML = '<option value="">— Choisir un médecin spécialisé —</option>';
                medecins.forEach(m => {
                    const label = `Dr. ${m.prenom} ${m.nom}` + (m.specialite ? ` — ${m.specialite}` : '');
                    select.innerHTML += `<option value="${m.id}"${String(m.id) === String(medecinId) ? ' selected' : ''}>${label}</option>`;
                });
            })
            .catch(() => {});

        const preuveContainer = document.getElementById('valider-preuve-container');
        const preuveLink = document.getElementById('valider-preuve-link');
        
        if (preuvePath && preuvePath !== 'null' && preuvePath !== '') {
            preuveContainer.style.display = 'block';
            preuveLink.href = ApiClient.staticUrl(preuvePath);
            document.getElementById('valider-direct').checked = true; // Auto-check if proof attached
        } else {
            preuveContainer.style.display = 'none';
        }

        modalValider.style.display = 'flex';
    };

    document.getElementById('close-modal-valider').addEventListener('click', () => modalValider.style.display = 'none');

    formValider.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('valider-rdv-id').value;
        const ticket = document.getElementById('valider-ticket').value.trim();
        const validerDirect = document.getElementById('valider-direct').checked;
        const medecinId = document.getElementById('valider-medecin-select').value;
        
        if (!medecinId) {
            showToast("Veuillez affecter un médecin avant de valider.", "danger");
            return;
        }

        try {
            await ApiClient.request(`/api/rendezvous/${id}/valider`, 'PUT', { 
                numero_passage: ticket,
                medecin_id: medecinId,
                valider_directement: validerDirect 
            });
            modalValider.style.display = 'none';
            loadRendezvous();
            const msg = validerDirect 
                ? "Rendez-vous validé et affecté ! Le médecin a été notifié."
                : "Rendez-vous validé et affecté ! Le patient est envoyé à la caisse.";
            showToast(msg, "success");
        } catch(error) {
            showToast("Erreur: " + error.message, "danger");
        }
    });

    // Init
    loadRendezvous();
    loadPatients(); // Loads patient select list

    // Polling for notifications (Secrétaire gets notified when patient asks RDV)
    setInterval(() => {
        ApiClient.request('/api/notifications', 'GET').then(data => {
            if(data && data.length > 0) {
                data.forEach(notif => {
                    showToast(notif.message, "info");
                    ApiClient.request(`/api/notifications/${notif.id}/read`, 'POST');
                });
                loadRendezvous(); // Reload list
            }
        }).catch(() => {});
    }, 30000);
});
