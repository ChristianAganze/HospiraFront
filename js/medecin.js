/**
 * medecin.js - Logique pour le tableau de bord Médecin
 *
 * Couvre : file d'attente du jour, consultation (ordonnance + examens),
 * recherche de dossiers patients hors file d'attente, et résultats de laboratoire.
 */

document.addEventListener('DOMContentLoaded', () => {
    const user = Auth.requireAuth(['Medecin', 'Admin', 'Infirmier']);
    if (!user) return;

    document.getElementById('user-name-top').textContent = `Dr. ${user.prenom} ${user.nom}`;
    const topbarRole = user.is_assistant ? 'Assistant · ' : '';
    const topbarSpecialite = user.specialite ? ` · ${user.specialite}` : '';
    document.getElementById('user-role-top').textContent = topbarRole + user.role + topbarSpecialite;

    const topUserInitials = document.getElementById('topbar-user-initials');
    if (topUserInitials) topUserInitials.textContent = (user.prenom.charAt(0) + user.nom.charAt(0)).toUpperCase();

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

    // ------------------------------------------------------------------
    // Navigation / vues
    // ------------------------------------------------------------------
    const navDashboard = document.getElementById('nav-dashboard');
    const navConsultation = document.getElementById('nav-consultation');
    const navPatients = document.getElementById('nav-patients');
    const navExamens = document.getElementById('nav-examens');

    const viewDashboard = document.getElementById('view-dashboard');
    const viewConsultation = document.getElementById('view-consultation');
    const viewPatients = document.getElementById('view-patients');
    const viewExamens = document.getElementById('view-examens');

    const views = {
        dashboard: viewDashboard,
        consultation: viewConsultation,
        patients: viewPatients,
        examens: viewExamens
    };
    const navs = {
        dashboard: navDashboard,
        consultation: navConsultation,
        patients: navPatients,
        examens: navExamens
    };

    let currentView = 'dashboard';

    function switchView(name) {
        Object.keys(views).forEach((key) => {
            views[key].style.display = 'none';
            navs[key].classList.remove('active');
        });
        views[name].style.display = 'block';
        navs[name].classList.add('active');
        currentView = name;
        if (window.innerWidth <= 768) closeSidebar();
    }

    navDashboard.addEventListener('click', (e) => {
        e.preventDefault();
        switchView('dashboard');
        loadAttente();
    });
    navConsultation.addEventListener('click', (e) => {
        e.preventDefault();
        switchView('consultation');
    });
    navPatients.addEventListener('click', (e) => {
        e.preventDefault();
        switchView('patients');
        loadPatients();
    });
    navExamens.addEventListener('click', (e) => {
        e.preventDefault();
        switchView('examens');
        loadExamens();
    });
    document.getElementById('btn-refresh').addEventListener('click', loadAttente);
    document.getElementById('btn-back-dashboard').addEventListener('click', () => navDashboard.click());
    document.getElementById('btn-refresh-examens').addEventListener('click', loadExamens);

    // ------------------------------------------------------------------
    // Utilitaires
    // ------------------------------------------------------------------
    function formatDate(value, withTime) {
        if (!value) return '';
        const date = new Date(String(value).replace(' ', 'T'));
        if (isNaN(date.getTime())) return String(value);
        return withTime ? date.toLocaleString('fr-FR') : date.toLocaleDateString('fr-FR');
    }

    function isToday(value) {
        if (!value) return false;
        const date = new Date(String(value).replace(' ', 'T'));
        if (isNaN(date.getTime())) return false;
        const now = new Date();
        return date.getFullYear() === now.getFullYear()
            && date.getMonth() === now.getMonth()
            && date.getDate() === now.getDate();
    }

    function numberOrNull(value) {
        const raw = String(value == null ? '' : value).trim();
        if (raw === '') return null;
        const num = Number(raw.replace(',', '.'));
        return isNaN(num) ? null : num;
    }

    function patientLabel(item) {
        return `${item.patient_prenom || ''} ${item.patient_nom || ''}`.trim() || 'Patient';
    }

    function resultFileUrl(path) {
        if (!path) return '';
        try {
            return ApiClient.staticUrl(path);
        } catch (_e) {
            return path;
        }
    }

    function resultBadge(status) {
        const done = status === 'Termine';
        return `<span class="badge ${done ? 'badge-success' : 'badge-warning'}">${done ? 'Résultat publié' : 'En attente'}</span>`;
    }

    function paymentBadge(status) {
        const paid = status === 'Paye';
        return `<span class="badge ${paid ? 'badge-success' : 'badge-warning'}">${paid ? 'Payé' : 'Non payé'}</span>`;
    }

    // ------------------------------------------------------------------
    // File d'attente du jour
    // ------------------------------------------------------------------
    function loadAttente() {
        ApiClient.request('/rendezvous', 'GET')
            .then(res => {
                const rdvs = (res && res.records) ? res.records : (Array.isArray(res) ? res : []);
                const container = document.getElementById('medecin-file-attente');
                container.innerHTML = '';
                const monId = Number(user.id);
                const monSuperviseur = user.is_assistant ? Number(user.superviseur_id) : null;
                const isAdmin = Auth.normalizeRole(user.role) === 'admin';

                const attente = rdvs.filter(r => {
                    if (r.statut !== 'Confirmé') return false;
                    if (!isToday(r.date_heure)) return false;
                    if (isAdmin) return true;
                    const medecinId = r.medecin && r.medecin.id ? Number(r.medecin.id) : null;
                    if (!medecinId) return false;
                    return medecinId === monId || (monSuperviseur && medecinId === monSuperviseur);
                });

                if (attente.length === 0) {
                    container.innerHTML = '<p class="text-muted text-center mt-2" style="padding: 2rem;">Aucun patient qui vous est affecté en salle d\'attente aujourd\'hui.</p>';
                    return;
                }

                attente.forEach(rdv => {
                    const patientPrenom = rdv.patient ? rdv.patient.prenom : (rdv.patient_prenom || '');
                    const patientNom = rdv.patient ? rdv.patient.nom : (rdv.patient_nom || '');
                    const patientIup = rdv.patient ? rdv.patient.id_iup : '';
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
                            <h4 style="margin: 0 0 0.5rem 0; color: var(--primary-dark);">Ticket #${escapeHtml(ticket)} — ${escapeHtml(patientPrenom)} ${escapeHtml(patientNom)}</h4>
                            <p style="margin: 0; font-size: 0.85rem; color: var(--text-muted);">Motif: ${escapeHtml(rdv.motif || 'Général')}${specialite ? ` <span class="badge" style="background:var(--primary-color); color:white; margin-left:0.4rem;">${escapeHtml(specialite)}</span>` : ''}</p>
                        </div>
                        <button class="btn btn-primary btn-sm" data-rdv-id="${Number(rdv.id)}" data-patient-id="${Number(patientId)}" data-patient-name="${escapeHtml(patientPrenom + ' ' + patientNom)}" data-patient-iup="${escapeHtml(patientIup || '')}">Consulter</button>
                    `;
                    card.querySelector('button').addEventListener('click', (event) => {
                        const btn = event.currentTarget;
                        demarrerConsultation(btn.dataset.rdvId, btn.dataset.patientId, btn.dataset.patientName, btn.dataset.patientIup);
                    });
                    container.appendChild(card);
                });
            })
            .catch(error => {
                document.getElementById('medecin-file-attente').innerHTML = `<p class="text-danger text-center">Erreur : ${escapeHtml(error.message)}</p>`;
            });
    }

    // ------------------------------------------------------------------
    // Consultation / dossier patient
    // ------------------------------------------------------------------
    let currentPatient = null;

    window.demarrerConsultation = function (rdvId, patientId, patientName, patientIup) {
        currentPatient = { id: Number(patientId), name: patientName || 'Patient', iup: patientIup || '' };
        const form = document.getElementById('form-nouvelle-consultation');
        form.reset();
        document.getElementById('cons-patient-id').value = patientId;
        document.getElementById('cons-rendezvous-id').value = rdvId || '';
        document.getElementById('consultation-patient-name').textContent = patientName || 'Dossier Patient';
        document.getElementById('consultation-patient-info').textContent = patientIup
            ? `IUP : ${patientIup}`
            : 'Consultation hors rendez-vous';
        medicamentsOrdonnance = [];
        renderOrdonnance();
        navConsultation.style.display = 'flex';
        switchView('consultation');
        loadHistoriquePatient(patientId);
        loadPatientExamens(patientId);
    };

    window.ouvrirDossierPatient = function (patientId, patientName, patientIup) {
        demarrerConsultation('', patientId, patientName, patientIup);
    };

    function loadHistoriquePatient(patientId) {
        const histContainer = document.getElementById('consultation-historique');
        histContainer.innerHTML = '<p class="text-center text-muted">Chargement de l\'historique…</p>';
        ApiClient.request(`/consultations/patient/${encodeURIComponent(patientId)}`, 'GET')
            .then(res => {
                const consultations = (res && res.records) ? res.records : (Array.isArray(res) ? res : []);
                histContainer.innerHTML = '';
                if (consultations.length === 0) {
                    histContainer.innerHTML = '<p class="text-center text-muted" style="padding: 1rem;">Aucun historique pour ce patient.</p>';
                    return;
                }
                consultations.forEach(cons => {
                    const date = formatDate(cons.date_consultation || cons.created_at);
                    const medecin = [cons.medecin_prenom, cons.medecin_nom].filter(Boolean).join(' ') || 'Médecin';
                    const prescriptions = Array.isArray(cons.prescriptions) ? cons.prescriptions : [];
                    const div = document.createElement('div');
                    div.style.borderLeft = '3px solid var(--primary-color)';
                    div.style.paddingLeft = '1rem';
                    div.style.marginBottom = '1.5rem';
                    div.innerHTML = `
                        <h4 style="margin: 0 0 0.5rem 0; font-size: 0.95rem;">Le ${escapeHtml(date)} - Dr. ${escapeHtml(medecin)}</h4>
                        <p style="margin: 0 0 0.5rem 0; font-size: 0.85rem;"><strong>Symptômes :</strong> ${escapeHtml(cons.symptomes || '—')}</p>
                        ${cons.diagnostic ? `<p style="margin: 0 0 0.5rem 0; font-size: 0.85rem;"><strong>Diagnostic :</strong> ${escapeHtml(cons.diagnostic)}</p>` : ''}
                        ${cons.tension || cons.temperature || cons.poids || cons.taille ? `<p style="margin: 0 0 0.5rem 0; font-size: 0.8rem; color: var(--text-muted);">${[
                            cons.poids ? `Poids ${escapeHtml(cons.poids)} kg` : '',
                            cons.taille ? `Taille ${escapeHtml(cons.taille)} cm` : '',
                            cons.temperature ? `T° ${escapeHtml(cons.temperature)} °C` : '',
                            cons.tension ? `TA ${escapeHtml(cons.tension)}` : ''
                        ].filter(Boolean).join(' · ')}</p>` : ''}
                        ${prescriptions.length > 0
                            ? `<div style="margin: 0 0 0.5rem 0; font-size: 0.85rem;"><strong>Ordonnance :</strong><ul style="margin: 0.25rem 0 0 1.1rem; padding: 0;">${prescriptions.map(p => `<li>${escapeHtml(p.medicament || '')}${p.posologie ? ` — ${escapeHtml(p.posologie)}` : ''}${p.duree ? ` (${escapeHtml(p.duree)})` : ''}</li>`).join('')}</ul></div>`
                            : (cons.ordonnance ? `<p style="margin: 0; font-size: 0.85rem; color: var(--secondary-color);"><strong>Ordonnance :</strong> ${escapeHtml(cons.ordonnance)}</p>` : '')}
                        ${cons.notes ? `<p style="margin: 0.4rem 0 0 0; font-size: 0.8rem; color: var(--text-muted);"><strong>Notes :</strong> ${escapeHtml(cons.notes)}</p>` : ''}
                    `;
                    histContainer.appendChild(div);
                });
            })
            .catch(error => {
                histContainer.innerHTML = `<p class="text-center text-danger">Erreur : ${escapeHtml(error.message)}</p>`;
            });
    }

    function loadPatientExamens(patientId) {
        const container = document.getElementById('consultation-examens');
        if (!container) return;
        container.innerHTML = '<p class="text-center text-muted" style="padding: 0.75rem;">Chargement des examens…</p>';
        ApiClient.request(`/prescriptions-examens?patient_id=${encodeURIComponent(patientId)}`, 'GET')
            .then(res => {
                const list = (res && res.prescriptions) ? res.prescriptions : [];
                if (list.length === 0) {
                    container.innerHTML = '<p class="text-center text-muted" style="padding: 0.75rem;">Aucun examen prescrit pour ce patient.</p>';
                    return;
                }
                container.innerHTML = list.map(item => {
                    const fileUrl = resultFileUrl(item.fichier_path);
                    return `
                        <div style="border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 0.75rem; margin-bottom: 0.6rem; background: var(--bg-main);">
                            <div style="display: flex; justify-content: space-between; gap: 0.5rem; align-items: flex-start;">
                                <strong style="font-size: 0.88rem;">${escapeHtml(item.examen_nom)}</strong>
                                <span style="white-space: nowrap;">${resultBadge(item.statut_examen)}</span>
                            </div>
                            <small style="color: var(--text-muted);">Prescrit le ${escapeHtml(formatDate(item.created_at))} · ${escapeHtml(item.statut_paiement === 'Paye' ? 'Payé' : 'Non payé')}${item.ticket_labo ? ` · Ticket ${escapeHtml(item.ticket_labo)}` : ''}</small>
                            ${item.resultat_texte ? `<p style="margin: 0.45rem 0 0 0; font-size: 0.82rem; white-space: pre-wrap; color: var(--text-main);">${escapeHtml(item.resultat_texte)}</p>` : ''}
                            ${fileUrl ? `<a href="${escapeHtml(fileUrl)}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm" style="margin-top: 0.5rem; display: inline-block; padding: 0.25rem 0.55rem; font-size: 0.75rem;">Télécharger le résultat</a>` : ''}
                        </div>
                    `;
                }).join('');
            })
            .catch(error => {
                container.innerHTML = `<p class="text-center text-danger" style="padding: 0.75rem;">Erreur : ${escapeHtml(error.message)}</p>`;
            });
    }

    // ------------------------------------------------------------------
    // Recherche de dossiers patients
    // ------------------------------------------------------------------
    let allPatients = [];

    function loadPatients() {
        const container = document.getElementById('patients-list');
        container.innerHTML = '<p class="text-center text-muted" style="padding: 2rem;">Chargement des dossiers patients…</p>';
        ApiClient.request('/patients', 'GET')
            .then(res => {
                allPatients = (res && res.records) ? res.records : (Array.isArray(res) ? res : []);
                renderPatients();
            })
            .catch(error => {
                container.innerHTML = `<p class="text-center text-danger" style="padding: 2rem;">Erreur : ${escapeHtml(error.message)}</p>`;
            });
    }

    function renderPatients() {
        const container = document.getElementById('patients-list');
        const search = (document.getElementById('patients-search').value || '').trim().toLowerCase();
        const filtered = allPatients.filter(p => {
            if (!search) return true;
            return [p.nom, p.prenom, p.id_iup, p.telephone, p.adresse]
                .filter(Boolean).join(' ').toLowerCase().includes(search);
        });

        if (filtered.length === 0) {
            container.innerHTML = `<p class="text-center text-muted" style="padding: 2rem;">${allPatients.length === 0 ? 'Aucun dossier patient disponible.' : 'Aucun patient ne correspond à votre recherche.'}</p>`;
            return;
        }

        container.innerHTML = filtered.map(p => {
            const name = `${p.prenom || ''} ${p.nom || ''}`.trim();
            const age = p.date_naissance ? Math.max(0, new Date().getFullYear() - new Date(p.date_naissance).getFullYear()) : null;
            return `
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; padding: 0.9rem 0; border-bottom: 1px solid var(--border-color);">
                    <div>
                        <strong style="color: var(--primary-dark);">${escapeHtml(name)}</strong>
                        <div style="font-size: 0.82rem; color: var(--text-muted);">
                            IUP : ${escapeHtml(p.id_iup || '—')}
                            ${age !== null ? ` · ${age} ans` : ''}
                            ${p.sexe ? ` · ${p.sexe === 'M' ? 'Homme' : 'Femme'}` : ''}
                            ${p.telephone ? ` · ${escapeHtml(p.telephone)}` : ''}
                        </div>
                    </div>
                    <button class="btn btn-primary btn-sm" data-patient-id="${Number(p.id)}" data-patient-name="${escapeHtml(name)}" data-patient-iup="${escapeHtml(p.id_iup || '')}">Ouvrir le dossier</button>
                </div>
            `;
        }).join('');
    }

    document.getElementById('patients-list').addEventListener('click', (event) => {
        const btn = event.target.closest('button[data-patient-id]');
        if (!btn) return;
        ouvrirDossierPatient(btn.dataset.patientId, btn.dataset.patientName, btn.dataset.patientIup);
    });
    document.getElementById('patients-search').addEventListener('input', renderPatients);

    // ------------------------------------------------------------------
    // Résultats de laboratoire
    // ------------------------------------------------------------------
    let allExamens = [];

    function loadExamens() {
        const tbody = document.getElementById('examens-results-body');
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding: 2rem;">Chargement des examens…</td></tr>';
        ApiClient.request('/prescriptions-examens', 'GET')
            .then(res => {
                allExamens = (res && res.prescriptions) ? res.prescriptions : [];
                renderExamens();
            })
            .catch(error => {
                tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger" style="padding: 2rem;">Erreur : ${escapeHtml(error.message)}</td></tr>`;
            });
    }

    function renderExamens() {
        const tbody = document.getElementById('examens-results-body');
        const search = (document.getElementById('examens-search').value || '').trim().toLowerCase();
        const status = document.getElementById('examens-statut').value;

        const filtered = allExamens.filter(item => {
            if (status && item.statut_examen !== status) return false;
            if (!search) return true;
            return [item.patient_nom, item.patient_prenom, item.patient_iup, item.examen_nom, item.medecin_nom, item.medecin_prenom]
                .filter(Boolean).join(' ').toLowerCase().includes(search);
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding: 2rem;">${allExamens.length === 0 ? 'Aucun examen prescrit.' : 'Aucun examen ne correspond aux filtres.'}</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(item => {
            const name = patientLabel(item);
            const fileUrl = resultFileUrl(item.fichier_path);
            const resultHtml = item.resultat_texte
                ? `<div style="font-size: 0.82rem; max-width: 280px; white-space: pre-wrap;">${escapeHtml(item.resultat_texte)}</div>${fileUrl ? `<a href="${escapeHtml(fileUrl)}" target="_blank" rel="noopener" style="font-size: 0.78rem; color: var(--primary-color); font-weight: 600;">Télécharger le fichier</a>` : ''}`
                : '<span style="font-size: 0.82rem; color: var(--text-muted);">En attente du laboratoire</span>';

            return `
                <tr style="border-bottom: 1px solid var(--border-color); vertical-align: top;">
                    <td style="padding: 0.85rem 0.5rem;">
                        <strong>${escapeHtml(name)}</strong><br>
                        <small style="color: var(--text-muted);">${escapeHtml(item.patient_iup || '')}</small><br>
                        <button class="btn btn-secondary btn-sm" data-patient-id="${Number(item.patient_id)}" data-patient-name="${escapeHtml(name)}" data-patient-iup="${escapeHtml(item.patient_iup || '')}" style="margin-top: 0.35rem; padding: 0.2rem 0.5rem; font-size: 0.72rem;">Ouvrir dossier</button>
                    </td>
                    <td style="padding: 0.85rem 0.5rem;"><strong>${escapeHtml(item.examen_nom)}</strong><br><small style="color: var(--text-muted);">${escapeHtml(item.examen_desc || '')}</small></td>
                    <td style="padding: 0.85rem 0.5rem; font-size: 0.85rem;">Dr. ${escapeHtml([item.medecin_prenom, item.medecin_nom].filter(Boolean).join(' '))}</td>
                    <td style="padding: 0.85rem 0.5rem; font-size: 0.82rem; color: var(--text-muted);">${escapeHtml(formatDate(item.created_at, true))}</td>
                    <td style="padding: 0.85rem 0.5rem;">${paymentBadge(item.statut_paiement)}</td>
                    <td style="padding: 0.85rem 0.5rem;">${resultBadge(item.statut_examen)}</td>
                    <td style="padding: 0.85rem 0.5rem;">${resultHtml}</td>
                </tr>
            `;
        }).join('');
    }

    document.getElementById('examens-results-body').addEventListener('click', (event) => {
        const btn = event.target.closest('button[data-patient-id]');
        if (!btn) return;
        ouvrirDossierPatient(btn.dataset.patientId, btn.dataset.patientName, btn.dataset.patientIup);
    });
    document.getElementById('examens-search').addEventListener('input', renderExamens);
    document.getElementById('examens-statut').addEventListener('change', renderExamens);

    // ------------------------------------------------------------------
    // Ordonnance
    // ------------------------------------------------------------------
    let medicamentsOrdonnance = [];

    document.getElementById('btn-add-medicament').addEventListener('click', () => {
        const med = document.getElementById('presc-medicament').value.trim();
        const pos = document.getElementById('presc-posologie').value.trim();
        const duree = document.getElementById('presc-duree').value.trim();
        if (med && pos) {
            medicamentsOrdonnance.push({
                medicament: med,
                posologie: pos,
                duree: duree,
                instructions: ''
            });
            document.getElementById('presc-medicament').value = '';
            document.getElementById('presc-posologie').value = '';
            document.getElementById('presc-duree').value = '';
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
            div.style.alignItems = 'center';
            div.style.background = 'white';
            div.style.padding = '0.5rem';
            div.style.borderRadius = '4px';
            div.style.marginBottom = '0.5rem';
            const suffix = item.duree ? ` (${item.duree})` : '';
            div.innerHTML = `<span style="font-size: 0.9rem;">${escapeHtml(item.medicament)} — ${escapeHtml(item.posologie)}${escapeHtml(suffix)}</span><button type="button" data-index="${index}" style="background:none; border:none; color:var(--danger-color); cursor:pointer; font-size: 1.1rem;">&times;</button>`;
            div.querySelector('button').addEventListener('click', () => {
                medicamentsOrdonnance.splice(index, 1);
                renderOrdonnance();
            });
            list.appendChild(div);
        });
    }

    const btnResetConsultation = document.getElementById('btn-reset-consultation');
    if (btnResetConsultation) {
        btnResetConsultation.addEventListener('click', () => {
            const form = document.getElementById('form-nouvelle-consultation');
            const patientId = document.getElementById('cons-patient-id').value;
            const rdvId = document.getElementById('cons-rendezvous-id').value;
            form.reset();
            document.getElementById('cons-patient-id').value = patientId;
            document.getElementById('cons-rendezvous-id').value = rdvId;
            medicamentsOrdonnance = [];
            renderOrdonnance();
        });
    }

    // ------------------------------------------------------------------
    // Catalogue d'examens
    // ------------------------------------------------------------------
    function loadExamensCatalog() {
        const select = document.getElementById('cons-examens');
        if (!select) return;
        ApiClient.request('/examens', 'GET')
            .then(res => {
                if (res && res.examens) {
                    select.innerHTML = res.examens.map(e => `<option value="${escapeHtml(e.id)}">${escapeHtml(e.nom)} (${escapeHtml(e.prix)} FC)</option>`).join('');
                }
            })
            .catch(() => {});
    }
    loadExamensCatalog();

    // ------------------------------------------------------------------
    // Soumission de la consultation
    // ------------------------------------------------------------------
    document.getElementById('form-nouvelle-consultation').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const rdvId = document.getElementById('cons-rendezvous-id').value;
        const patientId = document.getElementById('cons-patient-id').value;
        if (!patientId) {
            showToast('Veuillez sélectionner un patient avant de commencer la consultation.', 'warning');
            return;
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;

        const consultationData = {
            patient_id: Number(patientId),
            medecin_id: Number(user.id),
            rendezvous_id: rdvId ? Number(rdvId) : null,
            poids: numberOrNull(document.getElementById('cons-poids').value),
            taille: numberOrNull(document.getElementById('cons-taille').value),
            temperature: numberOrNull(document.getElementById('cons-temp').value),
            tension: document.getElementById('cons-tension').value.trim(),
            symptomes: document.getElementById('cons-symptomes').value.trim(),
            diagnostic: document.getElementById('cons-diagnostic').value.trim(),
            notes: document.getElementById('cons-notes').value.trim(),
            prescriptions: medicamentsOrdonnance.map(p => ({
                medicament: p.medicament,
                posologie: p.posologie,
                duree: p.duree,
                instructions: p.instructions
            }))
        };

        try {
            const res = await ApiClient.request('/consultations', 'POST', consultationData);
            const consultationId = Number(
                (res && (res.consultation_id ?? (res.data && (res.data.consultation_id ?? res.data.id)))) || 0
            );

            const selectEx = document.getElementById('cons-examens');
            const selectedExamens = selectEx
                ? Array.from(selectEx.selectedOptions).map(opt => Number(opt.value)).filter(n => !isNaN(n))
                : [];

            let examWarning = '';
            if (selectedExamens.length > 0) {
                try {
                    await ApiClient.request('/prescriptions-examens', 'POST', {
                        patient_id: Number(patientId),
                        medecin_id: Number(user.id),
                        consultation_id: consultationId || null,
                        examen_ids: selectedExamens
                    });
                } catch (examError) {
                    examWarning = " La consultation est enregistrée, mais les examens n'ont pas pu être prescrits : " + examError.message;
                }
            }

            showToast('Consultation enregistrée avec succès !' + examWarning, examWarning ? 'warning' : 'success', examWarning ? 8000 : 4000);
            form.reset();
            document.getElementById('cons-patient-id').value = '';
            document.getElementById('cons-rendezvous-id').value = '';
            medicamentsOrdonnance = [];
            renderOrdonnance();
            currentPatient = null;
            navConsultation.style.display = 'none';
            navDashboard.click();
        } catch (error) {
            showToast('Erreur : ' + error.message, 'danger');
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    });

    // ------------------------------------------------------------------
    // Rafraîchissement piloté par les notifications
    // ------------------------------------------------------------------
    document.addEventListener('hospira:notification', () => {
        if (currentView === 'dashboard') {
            loadAttente();
        } else if (currentView === 'examens') {
            loadExamens();
        } else if (currentView === 'patients') {
            loadPatients();
        } else if (currentView === 'consultation' && currentPatient) {
            loadPatientExamens(currentPatient.id);
        }
    });

    loadAttente();
    setInterval(() => {
        if (currentView === 'dashboard') loadAttente();
    }, 45000);
});
