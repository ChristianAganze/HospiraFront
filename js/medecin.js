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
        // 1. Charger les patients en salle d'attente (Consultations du jour)
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
                } else {
                    attente.forEach(rdv => {
                        const patientPrenom = rdv.patient ? rdv.patient.prenom : (rdv.patient_prenom || '');
                        const patientNom = rdv.patient ? rdv.patient.nom : (rdv.patient_nom || '');
                        const patientIup = rdv.patient ? rdv.patient.id_iup : '';
                        const patientId = rdv.patient_id;
                        const ticket = rdv.numero_passage || 'N/A';
                        const specialite = rdv.medecin && rdv.medecin.specialite ? rdv.medecin.specialite : '';
                        
                        // Constantes prises à l'accueil
                        const consts = rdv.constantes || {};
                        const hasConst = consts.poids || consts.temperature || consts.tension || consts.taille;
                        const constsBadge = hasConst
                            ? `<span class="badge" style="background:rgba(16,185,129,0.12); color:#047857; margin-left:0.5rem; font-size:0.75rem; border:1px solid rgba(16,185,129,0.3);">🩺 ${escapeHtml([consts.tension ? 'TA: ' + consts.tension : '', consts.temperature ? consts.temperature + '°C' : '', consts.poids ? consts.poids + 'kg' : ''].filter(Boolean).join(' · '))}</span>`
                            : '';

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
                                <h4 style="margin: 0 0 0.5rem 0; color: var(--primary-dark); display:flex; align-items:center; flex-wrap:wrap;">
                                    Ticket #${escapeHtml(ticket)} — ${escapeHtml(patientPrenom)} ${escapeHtml(patientNom)}
                                    ${constsBadge}
                                </h4>
                                <p style="margin: 0; font-size: 0.85rem; color: var(--text-muted);">Motif: ${escapeHtml(rdv.motif || 'Général')}${specialite ? ` <span class="badge" style="background:var(--primary-color); color:white; margin-left:0.4rem;">${escapeHtml(specialite)}</span>` : ''}</p>
                            </div>
                            <button class="btn btn-primary btn-sm" data-rdv-id="${Number(rdv.id)}" data-patient-id="${Number(patientId)}" data-patient-name="${escapeHtml(patientPrenom + ' ' + patientNom)}" data-patient-iup="${escapeHtml(patientIup || "")}" data-rdv-motif="${escapeHtml(rdv.motif || "")}">Consulter</button>
                        `;
                        card.querySelector('button').addEventListener('click', (event) => {
                            const btn = event.currentTarget;
                            demarrerConsultation(btn.dataset.rdvId, btn.dataset.patientId, btn.dataset.patientName, btn.dataset.patientIup, consts, null, null, btn.dataset.rdvMotif);
                        });
                        container.appendChild(card);
                    });
                }
            })
            .catch(error => {
                document.getElementById('medecin-file-attente').innerHTML = `<p class="text-danger text-center">Erreur : ${escapeHtml(error.message)}</p>`;
            });

        // 2. Charger les retours du Laboratoire (Résultats d'examens terminés)
        loadRetoursLabo();
    }

    function loadRetoursLabo() {
        const container = document.getElementById('medecin-retours-labo');
        const badge = document.getElementById('badge-retours-labo');
        if (!container) return;

        ApiClient.request('/prescriptions-examens?statut_examen=Termine', 'GET')
            .then(res => {
                const list = (res && res.prescriptions) ? res.prescriptions : [];
                const monId = Number(user.id);
                const monSuperviseur = user.is_assistant ? Number(user.superviseur_id) : null;
                const isAdmin = Auth.normalizeRole(user.role) === 'admin';

                const mesExamensTermines = list.filter(item => {
                    if (isAdmin) return true;
                    const medId = Number(item.medecin_id);
                    return medId === monId || (monSuperviseur && medId === monSuperviseur);
                });

                // Grouper par patient
                const parPatient = {};
                mesExamensTermines.forEach(item => {
                    const pid = item.patient_id;
                    if (!parPatient[pid]) {
                        parPatient[pid] = {
                            patient_id: pid,
                            patient_nom: item.patient_nom,
                            patient_prenom: item.patient_prenom,
                            patient_iup: item.patient_iup,
                            ticket_labo: item.ticket_labo,
                            examens: []
                        };
                    }
                    parPatient[pid].examens.push(item);
                });

                const patientsList = Object.values(parPatient);
                if (badge) badge.textContent = `${patientsList.length} prêt(s)`;

                if (patientsList.length === 0) {
                    container.innerHTML = '<p class="text-muted text-center mt-2" style="padding: 1.5rem;">Aucun résultat d\'analyse en attente d\'interprétation.</p>';
                    return;
                }

                container.innerHTML = '';
                patientsList.forEach(groupe => {
                    const patientLabel = `${groupe.patient_prenom} ${groupe.patient_nom}`.trim();
                    const iupLabel = groupe.patient_iup ? ` (${groupe.patient_iup})` : '';
                    const examensNames = groupe.examens.map(e => e.examen_nom).join(', ');
                    const ticketLaboLabel = groupe.ticket_labo ? `Ticket Labo #${groupe.ticket_labo}` : '';

                    const card = document.createElement('div');
                    card.style.padding = '0.9rem';
                    card.style.border = '1px solid rgba(16,185,129,0.3)';
                    card.style.borderRadius = 'var(--radius-md)';
                    card.style.marginBottom = '0.75rem';
                    card.style.display = 'flex';
                    card.style.justifyContent = 'space-between';
                    card.style.alignItems = 'center';
                    card.style.background = 'rgba(16,185,129,0.04)';
                    card.innerHTML = `
                        <div>
                            <h4 style="margin: 0 0 0.3rem 0; color: #065f46;">
                                👤 ${escapeHtml(patientLabel)} <span style="font-size:0.8rem; font-weight:normal; color:var(--text-muted);">${escapeHtml(iupLabel)}</span>
                                <span class="badge badge-success" style="font-size:0.75rem; margin-left:0.5rem;">Résultats disponibles</span>
                            </h4>
                            <p style="margin: 0; font-size: 0.82rem; color: var(--text-main);">
                                <strong>Examens :</strong> ${escapeHtml(examensNames)} ${ticketLaboLabel ? `<span style="color:var(--text-muted); margin-left:0.5rem;">· ${escapeHtml(ticketLaboLabel)}</span>` : ''}
                            </p>
                        </div>
                        <button class="btn btn-success btn-sm btn-retour-consult" style="padding: 0.4rem 0.8rem; font-size: 0.82rem; white-space: nowrap;">
                            📋 Interpréter & Ordonnance finale
                        </button>
                    `;
                    card.querySelector('.btn-retour-consult').addEventListener('click', () => {
                        const consId = (groupe.examens && groupe.examens[0]) ? groupe.examens[0].consultation_id : null;
                        demarrerConsultation('', groupe.patient_id, patientLabel, groupe.patient_iup, null, consId, groupe.examens);
                    });
                    container.appendChild(card);
                });
            })
            .catch(err => {
                container.innerHTML = `<p class="text-danger text-center">Erreur chargement retours labo : ${escapeHtml(err.message)}</p>`;
            });
    }

    // ------------------------------------------------------------------
    // Consultation / dossier patient
    // ------------------------------------------------------------------
    let currentPatient = null;

    window.demarrerConsultation = function (rdvId, patientId, patientName, patientIup, rdvConstantes, consId, retoursLabo, rdvMotif) {
        currentPatient = { id: Number(patientId), name: patientName || 'Patient', iup: patientIup || '' };
        const form = document.getElementById('form-nouvelle-consultation');
        form.reset();
        document.getElementById('cons-patient-id').value = patientId;
        document.getElementById('cons-rendezvous-id').value = rdvId || '';
        const consIdInput = document.getElementById('cons-consultation-id');
        if (consIdInput) consIdInput.value = consId || '';

        document.getElementById('consultation-patient-name').textContent = patientName || 'Dossier Patient';
        document.getElementById('consultation-patient-info').textContent = patientIup
            ? `IUP : ${patientIup}`
            : 'Consultation';

        // Valeurs par défaut du bandeau
        const ageSexeEl = document.getElementById('banner-patient-age-sexe');
        const gsangEl = document.getElementById('banner-patient-gsang');
        const telEl = document.getElementById('banner-patient-tel');
        const motifEl = document.getElementById('banner-patient-motif');
        const constTextEl = document.getElementById('banner-patient-constantes-text');

        if (ageSexeEl) ageSexeEl.textContent = 'Chargement dossier…';
        if (motifEl) motifEl.textContent = rdvMotif || 'Non précisé';

        // Si des constantes ont été passées directement
        function appliquerConstantes(c) {
            if (!c) return;
            if (c.poids) document.getElementById('cons-poids').value = c.poids;
            if (c.taille) document.getElementById('cons-taille').value = c.taille;
            if (c.temperature) document.getElementById('cons-temp').value = c.temperature;
            if (c.tension) document.getElementById('cons-tension').value = c.tension;

            const parts = [
                c.tension ? 'TA : ' + c.tension : '',
                c.temperature ? c.temperature + '°C' : '',
                c.poids ? c.poids + ' kg' : '',
                c.taille ? c.taille + ' cm' : ''
            ].filter(Boolean);

            if (constTextEl) {
                constTextEl.textContent = parts.length > 0 ? parts.join(' · ') : 'Aucune constante enregistrée';
            }
        }

        if (rdvConstantes) appliquerConstantes(rdvConstantes);

        // Récupérer les informations complètes du patient depuis la base de données
        ApiClient.request(`/patients/${patientId}`, 'GET')
            .then(res => {
                const p = (res && res.patient) ? res.patient : null;
                if (!p) return;

                // Afficher identité & antécédents
                if (ageSexeEl) {
                    const sexeLabel = p.sexe === 'F' ? 'Femme' : (p.sexe === 'M' ? 'Homme' : (p.sexe || ''));
                    const ageLabel = p.age != null ? `${p.age} ans` : '';
                    ageSexeEl.textContent = [sexeLabel, ageLabel].filter(Boolean).join(', ') || 'Patient';
                }
                if (gsangEl) {
                    gsangEl.textContent = p.groupe_sanguin ? `🩸 Groupe : ${p.groupe_sanguin}` : '🩸 Groupe : Non renseigné';
                }
                if (telEl) {
                    telEl.textContent = p.telephone ? `📞 Tél : ${p.telephone}` : '📞 Tél : —';
                }

                // Motif du rendez-vous
                const motifFinal = (p.dernier_rdv && p.dernier_rdv.motif) || rdvMotif;
                if (motifEl && motifFinal) {
                    motifEl.textContent = motifFinal;
                }

                // Pré-remplir les symptômes avec le motif si le champ est encore vide
                const symptomesInput = document.getElementById('cons-symptomes');
                if (symptomesInput && !symptomesInput.value && motifFinal) {
                    symptomesInput.value = motifFinal;
                }

                // Si les constantes n'étaient pas passées en paramètre, les charger du dernier RDV
                if (p.dernier_rdv && p.dernier_rdv.constantes) {
                    appliquerConstantes(p.dernier_rdv.constantes);
                }
                if (p.dernier_rdv && p.dernier_rdv.id && !document.getElementById('cons-rendezvous-id').value) {
                    document.getElementById('cons-rendezvous-id').value = p.dernier_rdv.id;
                }
            })
            .catch(err => {
                console.warn('Impossible de charger le détail patient :', err);
                if (ageSexeEl) ageSexeEl.textContent = 'Patient';
            });

        // Gestion du mode Retour Labo vs Consultation Initiale
        const alertLabo = document.getElementById('consultation-retour-labo-alert');
        const contentLabo = document.getElementById('consultation-retour-labo-content');
        const panelEtape1 = document.getElementById('panel-etape-1');
        const panelEtape2 = document.getElementById('panel-etape-2');

        if (retoursLabo && retoursLabo.length > 0) {
            if (alertLabo && contentLabo) {
                alertLabo.style.display = 'block';
                contentLabo.innerHTML = retoursLabo.map(e => `
                    <div style="margin-bottom: 0.5rem; padding: 0.5rem; background: white; border-radius: 6px; border: 1px solid rgba(16,185,129,0.3);">
                        <strong>🔬 ${escapeHtml(e.examen_nom)}</strong> ${e.ticket_labo ? `<span style="color:var(--text-muted); font-size:0.8rem;">(${escapeHtml(e.ticket_labo)})</span>` : ''} :
                        <div style="margin-top:0.25rem; font-weight:600; color:#065f46;">
                            ${escapeHtml(e.resultat_texte || 'Analyse terminée sans texte complémentaire.')}
                        </div>
                        ${e.fichier_path ? `<div style="margin-top:0.25rem;"><a href="${ApiClient.staticUrl(e.fichier_path)}" target="_blank" class="btn btn-secondary btn-sm" style="padding:0.2rem 0.5rem; font-size:0.75rem;">📄 Voir le compte-rendu PDF / Image</a></div>` : ''}
                    </div>
                `).join('');
            }
            if (panelEtape1) panelEtape1.style.display = 'none';
            if (panelEtape2) panelEtape2.style.display = 'block';
            const certitudeEl = document.getElementById('cons-diagnostic-certitude');
            if (certitudeEl) {
                certitudeEl.required = true;
                setTimeout(() => certitudeEl.focus(), 300);
            }
        } else {
            if (alertLabo) alertLabo.style.display = 'none';
            if (panelEtape1) panelEtape1.style.display = 'block';
            if (panelEtape2) panelEtape2.style.display = 'none';
            const certitudeEl = document.getElementById('cons-diagnostic-certitude');
            if (certitudeEl) certitudeEl.required = false;
        }

        panierExamens = [];
        renderPanierExamens();
        medicamentsOrdonnance = [];
        renderOrdonnance();
        // Réinitialiser checkbox cas simple
        const chkSimple = document.getElementById('chk-cas-simple');
        if (chkSimple) chkSimple.checked = false;
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
    // ------------------------------------------------------------------
    // Panier d'examens interactif (Bon de Labo)
    // ------------------------------------------------------------------
    let catalogueExamens = [];
    let panierExamens = [];

    function loadExamensCatalog() {
        const select = document.getElementById('select-catalogue-examens');
        if (!select) return;
        ApiClient.request('/examens', 'GET')
            .then(res => {
                if (res && res.examens) {
                    catalogueExamens = res.examens;
                    select.innerHTML = '<option value="">-- Choisir un examen dans le catalogue --</option>' +
                        res.examens.map(e => `<option value="${e.id}" data-nom="${escapeHtml(e.nom)}" data-prix="${e.prix}">${escapeHtml(e.nom)}</option>`).join('');
                }
            })
            .catch(() => {});
    }
    loadExamensCatalog();

    function renderPanierExamens() {
        const listEl = document.getElementById('liste-examens-prescrits');
        const emptyMsg = document.getElementById('empty-panier-msg');
        const totalBar = document.getElementById('total-examens-bar');
        const countEl = document.getElementById('count-examens-prescrits');
        const totalEl = document.getElementById('total-examens-prix');

        if (!listEl) return;

        if (panierExamens.length === 0) {
            listEl.innerHTML = '';
            if (emptyMsg) emptyMsg.style.display = 'block';
            if (totalBar) totalBar.style.display = 'none';
            return;
        }

        if (emptyMsg) emptyMsg.style.display = 'none';
        if (totalBar) totalBar.style.display = 'flex';

        let total = 0;
        listEl.innerHTML = panierExamens.map((ex, idx) => {
            total += Number(ex.prix) || 0;
            return `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:0.5rem 0.6rem; background:white; border:1px solid rgba(245,158,11,0.25); border-radius:6px; margin-bottom:0.4rem;">
                    <div>
                        <strong style="font-size:0.88rem;">${escapeHtml(ex.nom)}</strong>
                        
                    </div>
                    <button type="button" data-panier-idx="${idx}" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:1.2rem; padding:0 0.3rem;" title="Retirer cet examen">×</button>
                </div>
            `;
        }).join('');

        if (countEl) countEl.textContent = panierExamens.length + ' examen(s)';
        // Pas de calcul financier côté médecin

        // Boutons de suppression
        listEl.querySelectorAll('button[data-panier-idx]').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = Number(btn.dataset.panierIdx);
                panierExamens.splice(idx, 1);
                renderPanierExamens();
            });
        });
    }

    // Bouton "Ajouter l'examen" au panier
    const btnAddExBon = document.getElementById('btn-add-examen-bon');
    if (btnAddExBon) {
        btnAddExBon.addEventListener('click', () => {
            const select = document.getElementById('select-catalogue-examens');
            if (!select || !select.value) {
                showToast('Veuillez choisir un examen dans le catalogue.', 'warning');
                return;
            }
            const opt = select.options[select.selectedIndex];
            const id = Number(select.value);
            // Vérifier doublon
            if (panierExamens.some(e => e.id === id)) {
                showToast('Cet examen est déjà dans le bon de laboratoire.', 'warning');
                return;
            }
            panierExamens.push({
                id: id,
                nom: opt.dataset.nom || opt.textContent,
                prix: opt.dataset.prix || 0
            });
            select.value = '';
            renderPanierExamens();
        });
    }

    // Checkbox "Cas simple"
    const chkCasSimple = document.getElementById('chk-cas-simple');
    if (chkCasSimple) {
        chkCasSimple.addEventListener('change', () => {
            const panel1 = document.getElementById('panel-etape-1');
            const panel2 = document.getElementById('panel-etape-2');
            const bonLaboSection = panel1 ? panel1.querySelector('#container-panier-examens') : null;
            const btnBonLabo = document.getElementById('btn-emettre-bon-labo');

            if (chkCasSimple.checked) {
                // Cas simple : cacher le bon de labo, montrer étape 2
                if (bonLaboSection) bonLaboSection.parentElement.style.display = 'none';
                if (btnBonLabo) btnBonLabo.style.display = 'none';
                if (panel2) panel2.style.display = 'block';
            } else {
                // Normal : montrer le bon de labo, cacher étape 2
                if (bonLaboSection) bonLaboSection.parentElement.style.display = 'block';
                if (btnBonLabo) btnBonLabo.style.display = 'block';
                if (panel2) panel2.style.display = 'none';
            }
        });
    }

    // Bouton "Valider Étape 1 : Émettre Bon de Labo"
    const btnEmettreLaboEl = document.getElementById('btn-emettre-bon-labo');
    if (btnEmettreLaboEl) {
        btnEmettreLaboEl.addEventListener('click', async () => {
            const patientId = document.getElementById('cons-patient-id').value;
            const rdvId = document.getElementById('cons-rendezvous-id').value;
            const diagnosticPresomption = document.getElementById('cons-diagnostic-presomption').value.trim();
            const symptomes = document.getElementById('cons-symptomes').value.trim();

            if (!patientId) {
                showToast('Veuillez sélectionner un patient.', 'warning');
                return;
            }
            if (!diagnosticPresomption) {
                showToast('Veuillez saisir le diagnostic de présomption avant de valider.', 'warning');
                return;
            }
            if (panierExamens.length === 0) {
                showToast('Ajoutez au moins un examen au bon de laboratoire, ou cochez "Cas simple".', 'warning');
                return;
            }

            btnEmettreLaboEl.disabled = true;
            btnEmettreLaboEl.textContent = 'Envoi en cours...';

            try {
                // 1. Créer la consultation avec diagnostic de présomption
                const consultationData = {
                    patient_id: Number(patientId),
                    medecin_id: Number(user.id),
                    rendezvous_id: rdvId ? Number(rdvId) : null,
                    poids: numberOrNull(document.getElementById('cons-poids').value),
                    taille: numberOrNull(document.getElementById('cons-taille').value),
                    temperature: numberOrNull(document.getElementById('cons-temp').value),
                    tension: document.getElementById('cons-tension').value.trim(),
                    symptomes: symptomes,
                    diagnostic_presomption: diagnosticPresomption,
                    notes: '',
                    examen_ids: panierExamens.map(e => e.id),
                    prescriptions: []
                };

                const res = await ApiClient.request('/consultations', 'POST', consultationData);

                showToast('Étape 1 validée ! Bon de laboratoire émis. Le patient peut maintenant payer et passer les examens.', 'success', 6000);

                // Réinitialiser et retourner au dashboard
                document.getElementById('form-nouvelle-consultation').reset();
                document.getElementById('cons-patient-id').value = '';
                document.getElementById('cons-rendezvous-id').value = '';
                if (document.getElementById('cons-consultation-id')) document.getElementById('cons-consultation-id').value = '';
                panierExamens = [];
                renderPanierExamens();
                medicamentsOrdonnance = [];
                renderOrdonnance();
                currentPatient = null;
                navConsultation.style.display = 'none';
                navDashboard.click();
            } catch (error) {
                showToast('Erreur lors de la validation : ' + error.message, 'danger');
            } finally {
                btnEmettreLaboEl.disabled = false;
                btnEmettreLaboEl.textContent = '🧪 Valider l\'Étape 1 : Émettre Bon de Labo & Envoyer en Caisse';
            }
        });
    }

    // ------------------------------------------------------------------
    // Soumission de la consultation
    // ------------------------------------------------------------------
    
    // Raccourcis de date de contrôle (+7j, +14j, +1 mois)
    document.querySelectorAll('.btn-quick-ctrl').forEach(btn => {
        btn.addEventListener('click', () => {
            const days = Number(btn.dataset.days);
            const d = new Date();
            d.setDate(d.getDate() + days);
            const dateStr = d.toISOString().split('T')[0];
            const input = document.getElementById('cons-date-controle');
            if (input) input.value = dateStr;
        });
    });
    const btnClearCtrl = document.getElementById('btn-clear-ctrl');
    if (btnClearCtrl) {
        btnClearCtrl.addEventListener('click', () => {
            const input = document.getElementById('cons-date-controle');
            if (input) input.value = '';
        });
    }

    document.getElementById('form-nouvelle-consultation').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const patientId = document.getElementById('cons-patient-id').value;
        const consId = document.getElementById('cons-consultation-id') ? document.getElementById('cons-consultation-id').value : '';

        if (!patientId) {
            showToast('Veuillez sélectionner un patient avant de commencer la consultation.', 'warning');
            return;
        }

        const submitBtn = document.getElementById('btn-submit-consultation');
        if (submitBtn) submitBtn.disabled = true;

        try {
            if (consId) {
                // ===== MODE RETOUR LABO : Finaliser Étape 2 (Certitude + Ordonnance) =====
                const certitude = document.getElementById('cons-diagnostic-certitude').value.trim();
                if (!certitude) {
                    showToast('Veuillez saisir le diagnostic de certitude.', 'warning');
                    if (submitBtn) submitBtn.disabled = false;
                    return;
                }

                const certitudeData = {
                    diagnostic_certitude: certitude,
                    notes: document.getElementById('cons-notes').value.trim(),
                    date_controle: document.getElementById('cons-date-controle') ? document.getElementById('cons-date-controle').value : null,
                    prescriptions: medicamentsOrdonnance.map(p => ({
                        medicament: p.medicament,
                        posologie: p.posologie,
                        duree: p.duree,
                        instructions: p.instructions || ''
                    }))
                };

                await ApiClient.request('/consultations/' + consId + '/certitude', 'POST', certitudeData);
                showToast('Étape 2 validée ! Diagnostic de certitude et ordonnance enregistrés. Consultation clôturée.', 'success', 6000);
            } else {
                // ===== MODE CAS SIMPLE : Consultation complète en une seule étape =====
                const diagnosticPresomption = document.getElementById('cons-diagnostic-presomption').value.trim();
                const diagnosticCertitude = document.getElementById('cons-diagnostic-certitude').value.trim();
                const rdvId = document.getElementById('cons-rendezvous-id').value;

                const consultationData = {
                    patient_id: Number(patientId),
                    medecin_id: Number(user.id),
                    rendezvous_id: rdvId ? Number(rdvId) : null,
                    poids: numberOrNull(document.getElementById('cons-poids').value),
                    taille: numberOrNull(document.getElementById('cons-taille').value),
                    temperature: numberOrNull(document.getElementById('cons-temp').value),
                    tension: document.getElementById('cons-tension').value.trim(),
                    symptomes: document.getElementById('cons-symptomes').value.trim(),
                    diagnostic_presomption: diagnosticPresomption || diagnosticCertitude || '',
                    diagnostic_certitude: diagnosticCertitude || '',
                    notes: document.getElementById('cons-notes').value.trim(),
                    date_controle: document.getElementById('cons-date-controle') ? document.getElementById('cons-date-controle').value : null,
                    examen_ids: [],
                    prescriptions: medicamentsOrdonnance.map(p => ({
                        medicament: p.medicament,
                        posologie: p.posologie,
                        duree: p.duree,
                        instructions: p.instructions || ''
                    }))
                };

                await ApiClient.request('/consultations', 'POST', consultationData);
                showToast('Consultation enregistrée avec succès ! Ordonnance remise au patient.', 'success', 5000);
            }

            // Nettoyage après succès
            form.reset();
            document.getElementById('cons-patient-id').value = '';
            document.getElementById('cons-rendezvous-id').value = '';
            if (document.getElementById('cons-consultation-id')) document.getElementById('cons-consultation-id').value = '';
            panierExamens = [];
            renderPanierExamens();
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
