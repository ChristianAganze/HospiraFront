/**
 * medecin.js - Logique pour le tableau de bord Médecin
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

    const navDashboard = document.getElementById('nav-dashboard');
    const navConsultation = document.getElementById('nav-consultation');
    const viewDashboard = document.getElementById('view-dashboard');
    const viewConsultation = document.getElementById('view-consultation');

    function switchView(activeNav, activeView) {
        [navDashboard, navConsultation].forEach(nav => nav.classList.remove('active'));
        [viewDashboard, viewConsultation].forEach(view => view.style.display = 'none');
        activeNav.classList.add('active');
        activeView.style.display = 'block';
        if(window.innerWidth <= 768) closeSidebar();
    }

    navDashboard.addEventListener('click', (e) => {
        e.preventDefault();
        navConsultation.style.display = 'none';
        switchView(navDashboard, viewDashboard);
        loadAttente();
    });
    document.getElementById('btn-refresh').addEventListener('click', loadAttente);
    document.getElementById('btn-back-dashboard').addEventListener('click', () => navDashboard.click());

    function loadAttente() {
        ApiClient.request('/rendezvous', 'GET')
            .then(res => {
                const rdvs = (res && res.records) ? res.records : (Array.isArray(res) ? res : []);
                const container = document.getElementById('medecin-file-attente');
                container.innerHTML = '';
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
                            <h4 style="margin: 0 0 0.5rem 0; color: var(--primary-dark);">Ticket #${escapeHtml(ticket)} — ${escapeHtml(patientPrenom)} ${escapeHtml(patientNom)}</h4>
                            <p style="margin: 0; font-size: 0.85rem; color: var(--text-muted);">Motif: ${escapeHtml(rdv.motif || 'Général')}${specialite ? ` <span class="badge" style="background:var(--primary-color); color:white; margin-left:0.4rem;">${escapeHtml(specialite)}</span>` : ''}</p>
                        </div>
                        <button class="btn btn-primary btn-sm" onclick="demarrerConsultation(${Number(rdv.id)}, ${Number(patientId)}, '${escapeHtml(patientPrenom)} ${escapeHtml(patientNom)}')">Consulter</button>
                    `;
                    container.appendChild(card);
                });
            })
            .catch(error => {
                document.getElementById('medecin-file-attente').innerHTML = `<p class="text-danger text-center">Erreur : ${escapeHtml(error.message)}</p>`;
            });
    }

    window.demarrerConsultation = function(rdvId, patientId, patientName) {
        document.getElementById('cons-patient-id').value = patientId;
        document.getElementById('cons-rendezvous-id').value = rdvId;
        document.getElementById('consultation-patient-name').textContent = patientName;
        document.getElementById('form-nouvelle-consultation').reset();
        // Réassigner les hidden après reset
        document.getElementById('cons-patient-id').value = patientId;
        document.getElementById('cons-rendezvous-id').value = rdvId;
        medicamentsOrdonnance = [];
        renderOrdonnance();
        navConsultation.style.display = 'flex';
        switchView(navConsultation, viewConsultation);
        loadHistoriquePatient(patientId);
    };

    function loadHistoriquePatient(patientId) {
        const histContainer = document.getElementById('consultation-historique');
        histContainer.innerHTML = '<p class="text-center text-muted">Chargement de l\'historique...</p>';
        ApiClient.request(`/consultations/patient/${patientId}`, 'GET')
            .then(res => {
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
                        <h4 style="margin: 0 0 0.5rem 0; font-size: 0.95rem;">Le ${escapeHtml(date)} - Dr. ${escapeHtml(cons.medecin_nom || 'Médecin')}</h4>
                        <p style="margin: 0 0 0.5rem 0; font-size: 0.85rem;"><strong>Symptômes:</strong> ${escapeHtml(cons.symptomes)}</p>
                        ${cons.diagnostic ? `<p style="margin: 0 0 0.5rem 0; font-size: 0.85rem;"><strong>Diagnostic:</strong> ${escapeHtml(cons.diagnostic)}</p>` : ''}
                        ${cons.ordonnance ? `<p style="margin: 0; font-size: 0.85rem; color: var(--secondary-color);"><strong>Ordonnance:</strong> ${escapeHtml(cons.ordonnance)}</p>` : ''}
                    `;
                    histContainer.appendChild(div);
                });
            })
            .catch(error => {
                histContainer.innerHTML = `<p class="text-center text-danger">Erreur: ${escapeHtml(error.message)}</p>`;
            });
    }

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
            div.innerHTML = `<span style="font-size: 0.9rem;">${escapeHtml(item)}</span><button type="button" onclick="removeMedicament(${index})" style="background:none; border:none; color:var(--danger-color); cursor:pointer;">&times;</button>`;
            list.appendChild(div);
        });
    }
    window.removeMedicament = function(index) { medicamentsOrdonnance.splice(index, 1); renderOrdonnance(); };

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
            await ApiClient.request('/consultations', 'POST', consultationData);
            const selectEx = document.getElementById('cons-examens');
            if (selectEx) {
                const selectedExamens = Array.from(selectEx.selectedOptions).map(opt => opt.value);
                if (selectedExamens.length > 0) {
                    await ApiClient.request('/prescriptions-examens', 'POST', {
                        patient_id: patientId,
                        medecin_id: user.id,
                        examen_ids: selectedExamens
                    });
                }
            }
            showToast("Consultation enregistrée avec succès !", "success");
            navDashboard.click();
            loadAttente();
        } catch (error) {
            showToast("Erreur: " + error.message, "danger");
        }
    });

    loadAttente();
    setInterval(() => {
        if(navDashboard && navDashboard.classList.contains('active')) loadAttente();
    }, 30000);
});
