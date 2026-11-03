/**
 * secretaire.js - Logique pour le tableau de bord Secrétaire
 */

document.addEventListener('DOMContentLoaded', () => {
    const user = Auth.requireAuth(['Secretaire', 'Admin']);
    if (!user) return;

    document.getElementById('user-name-top').textContent = `${user.prenom} ${user.nom}`;
    document.getElementById('user-role-top').textContent = user.role;
    const topUserInitials = document.getElementById('topbar-user-initials');
    topUserInitials.textContent = (user.prenom.charAt(0) + user.nom.charAt(0)).toUpperCase();

    const userMenu = document.getElementById('topbar-user-menu');
    const userDropdown = document.getElementById('user-dropdown');
    userMenu.addEventListener('click', (e) => {
        userDropdown.style.display = userDropdown.style.display === 'none' ? 'block' : 'none';
        e.stopPropagation();
    });
    window.addEventListener('click', () => { userDropdown.style.display = 'none'; });

    document.getElementById('btn-logout').addEventListener('click', () => Auth.logout());
    document.getElementById('btn-profil').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('modal-profile').style.display = 'flex';
    });
    document.getElementById('close-modal-profile').addEventListener('click', () => {
        document.getElementById('modal-profile').style.display = 'none';
    });

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
    if (backdrop) backdrop.addEventListener('click', closeSidebar);

    const navRdv = document.getElementById('nav-rdv');
    const navPatients = document.getElementById('nav-patients');
    const viewRdv = document.getElementById('view-rdv');
    const viewPatients = document.getElementById('view-patients');

    function switchView(activeNav, activeView) {
        [navRdv, navPatients].forEach(nav => nav.classList.remove('active'));
        [viewRdv, viewPatients].forEach(view => view.style.display = 'none');
        activeNav.classList.add('active');
        activeView.style.display = 'block';
        if(window.innerWidth <= 768) closeSidebar();
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

    let allPatients = [];
    function loadPatients() {
        ApiClient.request('/patients', 'GET')
            .then(res => {
                const patients = (res && res.records) ? res.records : (Array.isArray(res) ? res : []);
                allPatients = patients;
                renderPatients(patients);
                populatePatientSelect(patients);
            })
            .catch(() => {
                document.getElementById('patients-table-body').innerHTML = `<tr><td colspan="5" class="text-center text-danger">Erreur de chargement.</td></tr>`;
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
                <td style="padding: 1rem 0.5rem; font-family: monospace;">${escapeHtml(patient.iup)}</td>
                <td style="padding: 1rem 0.5rem; font-weight: 500;">${escapeHtml(patient.prenom)} ${escapeHtml(patient.nom)}</td>
                <td style="padding: 1rem 0.5rem; color: var(--text-muted);">${escapeHtml(dateN)}</td>
                <td style="padding: 1rem 0.5rem;">${escapeHtml(patient.sexe || '-')}</td>
                <td style="padding: 1rem 0.5rem;">${escapeHtml(patient.telephone || '-')}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    document.getElementById('search-patient').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allPatients.filter(p =>
            (p.nom || '').toLowerCase().includes(term) ||
            (p.prenom || '').toLowerCase().includes(term) ||
            (p.iup || '').toLowerCase().includes(term)
        );
        renderPatients(filtered);
    });

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
            await ApiClient.request('/patients', 'POST', patientData);
            modalPatient.style.display = 'none';
            loadPatients();
            showToast("Patient ajouté avec succès !");
        } catch (error) {
            showToast(error.message || "Erreur lors de l'ajout du patient", "danger");
        }
    });

    let allRendezvousList = [];
    let currentRdvFilter = 'en_attente';

    // Gestion des onglets de tri des rendez-vous
    document.querySelectorAll('.rdv-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.rdv-filter-btn').forEach(b => {
                b.classList.remove('active');
                b.style.background = '';
                b.style.color = '';
            });
            btn.classList.add('active');
            btn.style.background = 'var(--primary-color)';
            btn.style.color = 'white';
            currentRdvFilter = btn.dataset.filter;
            renderRendezvousTable();
        });
    });

    function loadRendezvous() {
        ApiClient.request('/rendezvous', 'GET')
            .then(res => {
                allRendezvousList = (res && res.records) ? res.records : (Array.isArray(res) ? res : []);
                updateRdvBadges();
                renderRendezvousTable();
            })
            .catch(error => {
                document.getElementById('rdv-table-body').innerHTML = `<tr><td colspan="5" class="text-center text-danger">Erreur: ${escapeHtml(error.message)}</td></tr>`;
            });
    }

    function updateRdvBadges() {
        const todayStr = new Date().toDateString();
        const enAttenteCount = allRendezvousList.filter(r => r.statut === 'En attente' || (!r.medecin && !r.medecin_id)).length;
        const affectesCount = allRendezvousList.filter(r => (r.statut === 'Confirmé' || r.statut === 'À payer' || r.statut === 'En attente examens') && (r.medecin || r.medecin_id)).length;
        const todayCount = allRendezvousList.filter(r => new Date(r.date_heure).toDateString() === todayStr).length;

        const bWait = document.getElementById('badge-rdv-en-attente');
        const bAff = document.getElementById('badge-rdv-affectes');
        const bToday = document.getElementById('badge-rdv-today');
        const bAll = document.getElementById('badge-rdv-tous');

        if (bWait) bWait.textContent = enAttenteCount;
        if (bAff) bAff.textContent = affectesCount;
        if (bToday) bToday.textContent = todayCount;
        if (bAll) bAll.textContent = allRendezvousList.length;
    }

    function renderRendezvousTable() {
        const tbody = document.getElementById('rdv-table-body');
        tbody.innerHTML = '';

        const todayStr = new Date().toDateString();
        let filtered = allRendezvousList.slice();

        if (currentRdvFilter === 'en_attente') {
            filtered = filtered.filter(r => r.statut === 'En attente' || (!r.medecin && !r.medecin_id));
        } else if (currentRdvFilter === 'affectes') {
            filtered = filtered.filter(r => (r.statut === 'Confirmé' || r.statut === 'À payer' || r.statut === 'En attente examens') && (r.medecin || r.medecin_id));
        } else if (currentRdvFilter === 'aujourdhui') {
            filtered = filtered.filter(r => new Date(r.date_heure).toDateString() === todayStr);
        }

        if (filtered.length === 0) {
            const msgs = {
                'en_attente': 'Aucun rendez-vous en attente de validation ou d\'affectation.',
                'affectes': 'Aucun rendez-vous actuellement affecté.',
                'aujourdhui': 'Aucun rendez-vous prévu pour aujourd\'hui.',
                'tous': 'Aucun rendez-vous enregistré.'
            };
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted" style="padding: 2.5rem;">${msgs[currentRdvFilter] || 'Aucun rendez-vous.'}</td></tr>`;
            return;
        }

        filtered.sort((a, b) => {
            if (a.statut === 'En attente' && b.statut !== 'En attente') return -1;
            if (a.statut !== 'En attente' && b.statut === 'En attente') return 1;
            return new Date(b.date_heure) - new Date(a.date_heure);
        });

        filtered.forEach(rdv => {
            const dateObj = new Date(rdv.date_heure);
            const isToday = dateObj.toDateString() === todayStr;
            const dateStr = isToday ? "Aujourd'hui " + dateObj.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'}) : dateObj.toLocaleDateString('fr-FR') + ' ' + dateObj.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
            const patientPrenom = rdv.patient ? rdv.patient.prenom : (rdv.patient_prenom || '');
            const patientNom = rdv.patient ? rdv.patient.nom : (rdv.patient_nom || '');
            const patientLabel = `${patientPrenom} ${patientNom}`.trim();
            const medecinNom = rdv.medecin ? rdv.medecin.nom : (rdv.medecin_nom || '');
            const medecinPrenom = rdv.medecin ? rdv.medecin.prenom : (rdv.medecin_prenom || '');
            const medecinSpecialite = rdv.medecin ? rdv.medecin.specialite : (rdv.medecin_specialite || null);
            const hasPreuve = rdv.preuve_paiement_path ? `<br><span class="badge badge-info" style="font-size:0.7rem;">Reçu Joint</span>` : '';
            
            let statutBadge = `<span class="badge badge-neutral">En attente</span>${hasPreuve}`;
            if (rdv.statut === 'À payer') statutBadge = `<span class="badge badge-warning">À payer</span>${hasPreuve}`;
            else if (rdv.statut === 'Confirmé') statutBadge = `<span class="badge badge-success">Confirmé</span>${hasPreuve}`;
            else if (rdv.statut === 'Annulé') statutBadge = `<span class="badge badge-danger">Annulé</span>`;
            else if (rdv.statut === 'Terminé') statutBadge = `<span class="badge badge-info">Terminé</span>`;

            // Actions selon le statut
            let actionsHtml = '';

            if (rdv.statut === 'En attente' || (!rdv.medecin && !rdv.medecin_id)) {
                actionsHtml = `
                    <div style="display:flex; flex-wrap:wrap; gap:4px; align-items:center;">
                        <button class="btn btn-primary" onclick="openValiderModal(${Number(rdv.id)}, '${escapeHtml(rdv.preuve_paiement_path || '')}', ${rdv.medecin ? Number(rdv.medecin.id) : 'null'})" style="padding: 0.35rem 0.7rem; font-size: 0.82rem; font-weight:600;">
                            👉 Affecter & Valider
                        </button>
                        <button class="btn btn-secondary" onclick="openReporterModal(${Number(rdv.id)}, '${escapeHtml(patientLabel)}', '${rdv.date_heure}')" title="Reporter la date" style="padding: 0.3rem 0.5rem; font-size: 0.8rem;">
                            🕒 Reporter
                        </button>
                        <button class="btn btn-danger" onclick="annulerRdv(${Number(rdv.id)})" title="Annuler le rendez-vous" style="padding: 0.3rem 0.5rem; font-size: 0.8rem;">
                            ✕
                        </button>
                    </div>
                `;
            } else if (rdv.statut === 'Confirmé' || rdv.statut === 'À payer') {
                const hasConst = rdv.constantes && (rdv.constantes.poids || rdv.constantes.tension || rdv.constantes.temperature);
                const constBtn = hasConst
                    ? `<button class="btn" onclick="openConstantesModal(${Number(rdv.id)}, '${escapeHtml(patientLabel)}', '${escapeHtml(rdv.numero_passage || '')}', ${escapeHtml(JSON.stringify(rdv.constantes))})" style="padding: 0.3rem 0.5rem; font-size: 0.75rem; background: rgba(16,185,129,0.12); color: #047857; border: 1px solid rgba(16,185,129,0.4);" title="Constantes enregistrées - Cliquer pour modifier">🩺 ${escapeHtml(rdv.constantes.tension || rdv.constantes.poids + 'kg')}</button>`
                    : `<button class="btn btn-primary" onclick="openConstantesModal(${Number(rdv.id)}, '${escapeHtml(patientLabel)}', '${escapeHtml(rdv.numero_passage || '')}')" style="padding: 0.3rem 0.5rem; font-size: 0.75rem;" title="Prendre le poids, tension, température">🩺 Constantes</button>`;

                actionsHtml = `
                    <div style="display:flex; flex-wrap:wrap; gap:4px; align-items:center;">
                        ${constBtn}
                        <button class="btn btn-secondary" onclick="openReassignerModal(${Number(rdv.id)}, '${escapeHtml(patientLabel)}', ${rdv.medecin ? Number(rdv.medecin.id) : 'null'})" title="Réaffecter à un autre médecin (indisponibilité)" style="padding: 0.3rem 0.5rem; font-size: 0.75rem;">
                            🔄 Réassigner
                        </button>
                        <button class="btn btn-secondary" onclick="openReporterModal(${Number(rdv.id)}, '${escapeHtml(patientLabel)}', '${rdv.date_heure}')" title="Reporter la date" style="padding: 0.3rem 0.5rem; font-size: 0.75rem;">
                            🕒 Reporter
                        </button>
                        <button class="btn btn-danger" onclick="annulerRdv(${Number(rdv.id)})" title="Annuler le rendez-vous" style="padding: 0.3rem 0.5rem; font-size: 0.75rem;">
                            ✕
                        </button>
                    </div>
                `;
            } else {
                actionsHtml = `<span style="color:var(--text-muted); font-size:0.8rem;">-</span>`;
            }

            const ticketBadge = rdv.numero_passage ? `<span style="font-size:0.75rem; color:var(--primary-color); font-weight:600; display:block;">Ticket #${escapeHtml(rdv.numero_passage)}</span>` : '';

            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid rgba(0,0,0,0.05)';
            tr.innerHTML = `
                <td style="padding: 1rem 0.5rem; font-weight:500;">${escapeHtml(dateStr)} ${ticketBadge}<small style="color:var(--text-muted); font-weight:normal;">${statutBadge}</small></td>
                <td style="padding: 1rem 0.5rem; font-weight:500;">${escapeHtml(patientLabel)}</td>
                <td style="padding: 1rem 0.5rem;">${medecinNom ? 'Dr. ' + escapeHtml(medecinPrenom) + ' ' + escapeHtml(medecinNom) + (medecinSpecialite ? ' <small style="color:var(--text-muted);">(' + escapeHtml(medecinSpecialite) + ')</small>' : '') : '<span style="background:rgba(245,158,11,0.12); color:#b45309; padding:4px 12px; border-radius:20px; font-weight:600; font-size:0.85rem;">À affecter</span>'}</td>
                <td style="padding: 1rem 0.5rem; color: var(--text-muted);">${escapeHtml(rdv.motif || '-')}</td>
                <td style="padding: 1rem 0.5rem;">${actionsHtml}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    const modalRdv = document.getElementById('modal-rendezvous');
    const btnAddRdv = document.getElementById('btn-add-rdv');
    const formRdv = document.getElementById('form-rendezvous');

    function populatePatientSelect(patients) {
        const select = document.getElementById('rdv-patient-select');
        select.innerHTML = '<option value="">Sélectionnez un patient</option>';
        patients.forEach(p => {
            select.innerHTML += `<option value="${escapeHtml(p.id)}">${escapeHtml(p.prenom)} ${escapeHtml(p.nom)} (${escapeHtml(p.iup)})</option>`;
        });
    }

    btnAddRdv.addEventListener('click', () => {
        modalRdv.style.display = 'flex';
        formRdv.reset();
        ApiClient.request('/medecins', 'GET')
            .then(res => {
                const medecins = (res && res.records) ? res.records : [];
                const select = document.getElementById('rdv-medecin-select');
                select.innerHTML = '<option value="">(Facultatif)</option>';
                medecins.forEach(m => {
                    select.innerHTML += `<option value="${escapeHtml(m.id)}">Dr. ${escapeHtml(m.prenom)} ${escapeHtml(m.nom)}${m.specialite ? ` — ${escapeHtml(m.specialite)}` : ''}</option>`;
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
            await ApiClient.request('/rendezvous', 'POST', rdvData);
            modalRdv.style.display = 'none';
            loadRendezvous();
            showToast("Rendez-vous créé (En attente).", "success");
        } catch(error) {
            showToast(error.message, "danger");
        }
    });

    const modalValider = document.getElementById('modal-valider');
    const formValider = document.getElementById('form-valider');

    window.openValiderModal = function(id, preuvePath, medecinId) {
        document.getElementById('valider-rdv-id').value = id;
        document.getElementById('valider-ticket').value = 'T-' + Math.floor(100 + Math.random() * 900);
        document.getElementById('valider-direct').checked = false;
        ApiClient.request('/medecins', 'GET')
            .then(res => {
                const medecins = (res && res.records) ? res.records : [];
                const select = document.getElementById('valider-medecin-select');
                select.innerHTML = '<option value="">— Choisir un médecin spécialisé —</option>';
                medecins.forEach(m => {
                    const label = `Dr. ${escapeHtml(m.prenom)} ${escapeHtml(m.nom)}` + (m.specialite ? ` — ${escapeHtml(m.specialite)}` : '');
                    select.innerHTML += `<option value="${escapeHtml(m.id)}"${String(m.id) === String(medecinId) ? ' selected' : ''}>${label}</option>`;
                });
            })
            .catch(() => {});
        const preuveContainer = document.getElementById('valider-preuve-container');
        const preuveLink = document.getElementById('valider-preuve-link');
        if (preuvePath && preuvePath !== 'null' && preuvePath !== '') {
            preuveContainer.style.display = 'block';
            preuveLink.href = ApiClient.staticUrl(preuvePath);
            document.getElementById('valider-direct').checked = true;
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
        if (!medecinId) { showToast("Veuillez affecter un médecin avant de valider.", "danger"); return; }
        try {
            await ApiClient.request(`/rendezvous/${id}/valider`, 'PUT', {
                numero_passage: ticket,
                medecin_id: medecinId,
                valider_directement: validerDirect
            });
            modalValider.style.display = 'none';
            loadRendezvous();
            const msg = validerDirect ? "Rendez-vous validé et affecté ! Le médecin a été notifié." : "Rendez-vous validé et affecté ! Le patient est envoyé à la caisse.";
            showToast(msg, "success");
        } catch(error) {
            showToast("Erreur: " + error.message, "danger");
        }
    });

    // ─────────────────────────────────────────────
    // GESTION DU REPORT DE RENDEZ-VOUS
    // ─────────────────────────────────────────────
    const modalReporter = document.getElementById('modal-reporter');
    const formReporter = document.getElementById('form-reporter');
    window.openReporterModal = function(id, patientLabel, currentDateHeure) {
        document.getElementById('reporter-rdv-id').value = id;
        document.getElementById('reporter-patient-info').textContent = `Patient : ${patientLabel}`;
        if (currentDateHeure) {
            const d = new Date(currentDateHeure);
            const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
            document.getElementById('reporter-date-heure').value = iso;
        }
        document.getElementById('reporter-motif').value = '';
        modalReporter.style.display = 'flex';
    };
    document.getElementById('close-modal-reporter').addEventListener('click', () => modalReporter.style.display = 'none');
    formReporter.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('reporter-rdv-id').value;
        const dateHeure = document.getElementById('reporter-date-heure').value;
        const motif = document.getElementById('reporter-motif').value;
        try {
            await ApiClient.request(`/rendezvous/${id}/reporter`, 'PUT', {
                date_heure: dateHeure,
                motif_report: motif
            });
            modalReporter.style.display = 'none';
            loadRendezvous();
            showToast("Rendez-vous reporté avec succès ! Patient notifié.", "success");
        } catch(err) {
            showToast("Erreur : " + err.message, "danger");
        }
    });

    // ─────────────────────────────────────────────
    // GESTION DE LA RÉAFFECTATION DU MÉDECIN
    // ─────────────────────────────────────────────
    const modalReassigner = document.getElementById('modal-reassigner');
    const formReassigner = document.getElementById('form-reassigner');
    window.openReassignerModal = function(id, patientLabel, currentMedecinId) {
        document.getElementById('reassigner-rdv-id').value = id;
        document.getElementById('reassigner-patient-info').textContent = `Patient : ${patientLabel}`;
        ApiClient.request('/medecins', 'GET')
            .then(res => {
                const medecins = (res && res.records) ? res.records : [];
                const select = document.getElementById('reassigner-medecin-select');
                select.innerHTML = '<option value="">— Choisir un médecin remplaçant —</option>';
                medecins.forEach(m => {
                    const label = `Dr. ${escapeHtml(m.prenom)} ${escapeHtml(m.nom)}` + (m.specialite ? ` — ${escapeHtml(m.specialite)}` : '');
                    select.innerHTML += `<option value="${escapeHtml(m.id)}"${String(m.id) === String(currentMedecinId) ? ' disabled' : ''}>${label}${String(m.id) === String(currentMedecinId) ? ' (Médecin actuel)' : ''}</option>`;
                });
            })
            .catch(() => {});
        modalReassigner.style.display = 'flex';
    };
    document.getElementById('close-modal-reassigner').addEventListener('click', () => modalReassigner.style.display = 'none');
    formReassigner.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('reassigner-rdv-id').value;
        const medecinId = document.getElementById('reassigner-medecin-select').value;
        if (!medecinId) { showToast("Veuillez sélectionner un médecin remplaçant.", "warning"); return; }
        try {
            await ApiClient.request(`/rendezvous/${id}/reassigner`, 'PUT', { medecin_id: medecinId });
            modalReassigner.style.display = 'none';
            loadRendezvous();
            showToast("Médecin réaffecté avec succès ! Notifications envoyées.", "success");
        } catch(err) {
            showToast("Erreur : " + err.message, "danger");
        }
    });

    // ─────────────────────────────────────────────
    // GESTION DE LA PRISE DES CONSTANTES VITALES
    // ─────────────────────────────────────────────
    const modalConstantes = document.getElementById('modal-constantes');
    const formConstantes = document.getElementById('form-constantes');
    window.openConstantesModal = function(id, patientLabel, ticket, existingConst) {
        document.getElementById('constantes-rdv-id').value = id;
        document.getElementById('constantes-patient-info').textContent = `Patient : ${patientLabel}` + (ticket ? ` (Ticket #${ticket})` : '');
        const c = existingConst || {};
        document.getElementById('const-poids').value = c.poids || '';
        document.getElementById('const-taille').value = c.taille || '';
        document.getElementById('const-temp').value = c.temperature || '';
        document.getElementById('const-tension').value = c.tension || '';
        modalConstantes.style.display = 'flex';
    };
    document.getElementById('close-modal-constantes').addEventListener('click', () => modalConstantes.style.display = 'none');
    formConstantes.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('constantes-rdv-id').value;
        const payload = {
            poids: document.getElementById('const-poids').value || null,
            taille: document.getElementById('const-taille').value || null,
            temperature: document.getElementById('const-temp').value || null,
            tension: document.getElementById('const-tension').value || null
        };
        try {
            await ApiClient.request(`/rendezvous/${id}/constantes`, 'PUT', payload);
            modalConstantes.style.display = 'none';
            loadRendezvous();
            showToast("Constantes enregistrées ! Elles seront transmises au médecin.", "success");
        } catch(err) {
            showToast("Erreur : " + err.message, "danger");
        }
    });

    // Annuler un RDV
    window.annulerRdv = async function(id) {
        if (!confirm("Voulez-vous vraiment annuler ce rendez-vous ?")) return;
        try {
            await ApiClient.request(`/rendezvous/${id}/annuler`, 'PUT');
            loadRendezvous();
            showToast("Rendez-vous annulé.", "info");
        } catch(err) {
            showToast("Erreur : " + err.message, "danger");
        }
    };

        loadRendezvous();
    loadPatients();

    // Les notifications sont gérées par js/notifications.js (cloche + polling).
    document.addEventListener('hospira:notification', () => {
        loadRendezvous();
    });
});
