/**
 * caisse.js - Logique pour le tableau de bord Caissier
 */

document.addEventListener('DOMContentLoaded', () => {
    const user = Auth.requireAuth(['Caissier', 'Admin']);
    if (!user) return;

    document.getElementById('user-name-top').textContent = `${user.prenom} ${user.nom}`;
    document.getElementById('user-role-top').textContent = user.role;
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

    // Tarif depuis le backend (avec fallback discret si indisponible)
    let tarifConsultation = null;
    async function fetchTarif() {
        try {
            const res = await ApiClient.request('/config/tarif', 'GET');
            // Backend peut retourner { tarif: 15000 } ou { prix: ... } ou { data: ... }
            tarifConsultation = Number(res.tarif ?? res.prix ?? res.montant ?? res.data?.tarif ?? 15000);
        } catch (_e) {
            tarifConsultation = 15000;
        }
        return tarifConsultation;
    }

    async function loadFactures() {
        const tarif = tarifConsultation ?? await fetchTarif();
        ApiClient.request('/rendezvous', 'GET')
            .then(res => {
                const rdvs = (res && res.records) ? res.records : (Array.isArray(res) ? res : []);
                const tbody = document.getElementById('caisse-table-body');
                tbody.innerHTML = '';
                const aPayer = rdvs.filter(r => r.statut === 'À payer');
                const revenusJour = rdvs.filter(r => {
                    const today = new Date().toDateString();
                    const isToday = new Date(r.date_heure).toDateString() === today;
                    return isToday && (r.statut === 'Confirmé' || r.statut === 'Terminé');
                }).reduce((sum) => sum + tarif, 0);
                document.getElementById('caisse-total-jour').textContent = revenusJour.toLocaleString('fr-FR') + ' FC';

                if (aPayer.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted" style="padding: 2rem;">Aucune facture en attente de paiement.</td></tr>';
                    return;
                }
                aPayer.forEach(facture => {
                    const montant = tarif;
                    const annee = facture.date_heure ? new Date(facture.date_heure).getFullYear() : new Date().getFullYear();
                    const ref = `FAC-${annee}-${String(facture.id).padStart(4, '0')}`;
                    const motif = facture.motif || 'Consultation Médicale';
                    const patientPrenom = facture.patient ? facture.patient.prenom : (facture.patient_prenom || '');
                    const patientNom = facture.patient ? facture.patient.nom : (facture.patient_nom || '');
                    const ticket = facture.numero_passage || '-';
                    const patientLabel = `${patientPrenom} ${patientNom}`.trim();
                    const tr = document.createElement('tr');
                    tr.style.borderBottom = '1px solid rgba(0,0,0,0.05)';
                    tr.innerHTML = `
                        <td style="padding: 1rem 0.5rem; font-weight:500;">${escapeHtml(ref)} <span style="font-size:0.75rem; color:var(--text-muted)">Ticket #${escapeHtml(ticket)}</span></td>
                        <td style="padding: 1rem 0.5rem;">${escapeHtml(patientLabel)}</td>
                        <td style="padding: 1rem 0.5rem;">${escapeHtml(motif)}</td>
                        <td style="padding: 1rem 0.5rem; font-weight: bold; color: var(--text-main);">${montant.toLocaleString('fr-FR')} FC</td>
                        <td style="padding: 1rem 0.5rem;"><button class="btn btn-success" data-facture-id="${Number(facture.id)}" data-ref="${escapeHtml(ref)}" data-patient="${escapeHtml(patientLabel)}" data-motif="${escapeHtml(motif)}" data-montant="${montant}" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;">Encaisser</button></td>
                    `;
                    const btn = tr.querySelector('button');
                    btn.addEventListener('click', () => payerFacture(facture.id, ref, patientLabel, motif, montant));
                    tbody.appendChild(tr);
                });
            })
            .catch(error => {
                document.getElementById('caisse-table-body').innerHTML = `<tr><td colspan="5" class="text-center text-danger">Erreur de chargement : ${escapeHtml(error.message)}</td></tr>`;
            });
    }

    function payerFacture(id, ref, patient, motif, montant) {
        if(!confirm(`Confirmer le paiement de ${montant} FC pour ${patient} ?`)) return;
        ApiClient.request(`/rendezvous/${id}/payer`, 'POST')
            .then(() => {
                loadFactures();
                showToast("Paiement validé avec succès !", "success");
                const modalRecu = document.getElementById('modal-recu');
                document.getElementById('recu-ref').textContent = ref;
                document.getElementById('recu-patient').textContent = patient;
                document.getElementById('recu-date').textContent = new Date().toLocaleString('fr-FR');
                document.getElementById('recu-motif').textContent = motif;
                document.getElementById('recu-montant').textContent = montant;
                modalRecu.style.display = 'flex';
            })
            .catch(err => showToast(err.message || "Erreur lors de l'encaissement", "danger"));
    }
    window.payerFacture = payerFacture;

    const modalRecu = document.getElementById('modal-recu');
    document.getElementById('close-modal-recu').addEventListener('click', () => modalRecu.style.display = 'none');
    document.getElementById('btn-print-recu').addEventListener('click', () => {
        const ticket = document.getElementById('ticket-caisse');
        if (!ticket) return;
        let printFrame = document.getElementById('hidden-print-frame');
        if (!printFrame) {
            printFrame = document.createElement('iframe');
            printFrame.id = 'hidden-print-frame';
            printFrame.style.position = 'fixed';
            printFrame.style.right = '0';
            printFrame.style.bottom = '0';
            printFrame.style.width = '0';
            printFrame.style.height = '0';
            printFrame.style.border = '0';
            document.body.appendChild(printFrame);
        }
        const doc = printFrame.contentWindow.document;
        doc.open();
        doc.write(`<!DOCTYPE html><html><head><title>Reçu de Caisse - Hospira</title><style>body { font-family: 'Courier New', Courier, monospace; padding: 20px; color: #000; font-size: 13px; } .header { text-align: center; margin-bottom: 15px; } .header h2 { margin: 0; font-size: 16px; text-transform: uppercase; } .divider { border-bottom: 1px dashed #000; margin: 10px 0; } .row { display: flex; justify-content: space-between; margin-bottom: 5px; } .total { font-weight: bold; font-size: 15px; margin-top: 10px; } .footer { text-align: center; margin-top: 20px; font-size: 11px; }</style></head><body>${ticket.innerHTML}</body></html>`);
        doc.close();
        setTimeout(() => { printFrame.contentWindow.focus(); printFrame.contentWindow.print(); }, 250);
    });

    function loadExamensCaisse() {
        const tbody = document.getElementById('examens-caisse-table-body');
        if (!tbody) return;
        ApiClient.request('/prescriptions-examens?statut_paiement=Non paye', 'GET')
            .then(data => {
                const prescriptions = (data && data.prescriptions) ? data.prescriptions : [];
                if (prescriptions.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted" style="padding: 1.5rem;">Aucun examen en attente de paiement.</td></tr>';
                    return;
                }

                // Grouper par patient
                const parPatient = {};
                prescriptions.forEach(item => {
                    const pid = item.patient_id;
                    if (!parPatient[pid]) {
                        parPatient[pid] = {
                            patient_id: pid,
                            patient_nom: item.patient_nom,
                            patient_prenom: item.patient_prenom,
                            patient_iup: item.patient_iup,
                            medecin_nom: item.medecin_nom,
                            medecin_prenom: item.medecin_prenom,
                            items: []
                        };
                    }
                    parPatient[pid].items.push(item);
                });

                tbody.innerHTML = '';
                Object.values(parPatient).forEach(groupe => {
                    const patientLabel = `${groupe.patient_prenom} ${groupe.patient_nom}`.trim();
                    const iupLabel = groupe.patient_iup ? ` (${groupe.patient_iup})` : '';
                    const medecinLabel = `Dr. ${groupe.medecin_prenom} ${groupe.medecin_nom}`.trim();

                    // Ligne entête du patient
                    const trHeader = document.createElement('tr');
                    trHeader.style.background = 'var(--bg-main, #f8f9fa)';
                    trHeader.style.borderTop = '2px solid var(--border-color, #e0e0e0)';
                    trHeader.innerHTML = `
                        <td colspan="3" style="padding: 0.75rem 0.5rem; font-weight: 600; color: var(--primary-color);">
                            👤 ${escapeHtml(patientLabel)} <span style="font-size:0.8rem; font-weight:normal; color:var(--text-muted);">${escapeHtml(iupLabel)}</span>
                            <span style="margin-left: 1rem; font-weight: normal; font-size: 0.85rem; color: var(--text-muted);">Prescrit par ${escapeHtml(medecinLabel)}</span>
                        </td>
                        <td colspan="2" style="padding: 0.75rem 0.5rem; text-align: right;">
                            <label style="font-size: 0.8rem; cursor: pointer; user-select: none;">
                                <input type="checkbox" class="toggle-all-patient" data-patient="${groupe.patient_id}" checked style="margin-right: 4px; vertical-align: middle;">
                                Tout sélectionner
                            </label>
                        </td>
                    `;
                    tbody.appendChild(trHeader);

                    // Lignes d'examens individuels avec cases à cocher
                    groupe.items.forEach(item => {
                        const trItem = document.createElement('tr');
                        trItem.style.borderBottom = '1px solid rgba(0,0,0,0.05)';
                        const prixNum = Number(item.examen_prix) || 0;
                        trItem.innerHTML = `
                            <td style="padding: 0.6rem 0.5rem 0.6rem 1.5rem;">
                                <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                                    <input type="checkbox" class="examen-check examen-check-${groupe.patient_id}" 
                                           data-patient="${groupe.patient_id}"
                                           data-id="${item.id}"
                                           data-nom="${escapeHtml(item.examen_nom)}"
                                           data-prix="${prixNum}"
                                           checked>
                                    <span><strong>${escapeHtml(item.examen_nom)}</strong></span>
                                </label>
                            </td>
                            <td colspan="2" style="padding: 0.6rem 0.5rem; font-size: 0.85rem; color: var(--text-muted);">
                                ${escapeHtml(item.examen_desc || 'Examen de laboratoire')}
                            </td>
                            <td style="padding: 0.6rem 0.5rem; font-weight: bold; color: var(--success-color);">
                                ${prixNum.toLocaleString('fr-FR')} FC
                            </td>
                            <td style="padding: 0.6rem 0.5rem; color: var(--text-muted); font-size: 0.8rem;">
                                En attente
                            </td>
                        `;
                        tbody.appendChild(trItem);
                    });

                    // Ligne de validation pour ce patient
                    const trFooter = document.createElement('tr');
                    trFooter.style.borderBottom = '2px solid var(--border-color, #e0e0e0)';
                    trFooter.style.background = 'rgba(0,0,0,0.02)';
                    trFooter.innerHTML = `
                        <td colspan="3" style="padding: 0.75rem 0.5rem 0.75rem 1.5rem; font-weight: 500;">
                            Total sélectionné : <span id="total-patient-${groupe.patient_id}" style="font-weight: bold; color: var(--primary-color);">0 FC</span>
                            <span id="count-patient-${groupe.patient_id}" style="font-size: 0.8rem; color: var(--text-muted); margin-left: 8px;"></span>
                        </td>
                        <td colspan="2" style="padding: 0.75rem 0.5rem; text-align: right;">
                            <button class="btn btn-primary btn-encaisser-patient" id="btn-encaisser-${groupe.patient_id}" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;">
                                💳 Encaisser & Générer Ticket Labo
                            </button>
                        </td>
                    `;
                    tbody.appendChild(trFooter);

                    // Recalcul du total dynamique pour ce patient
                    function recalculerTotalPatient() {
                        const checks = tbody.querySelectorAll(`.examen-check-${groupe.patient_id}:checked`);
                        let sum = 0;
                        const ids = [];
                        const noms = [];
                        checks.forEach(chk => {
                            sum += Number(chk.dataset.prix) || 0;
                            ids.push(Number(chk.dataset.id));
                            noms.push(chk.dataset.nom);
                        });
                        const totalEl = document.getElementById(`total-patient-${groupe.patient_id}`);
                        const countEl = document.getElementById(`count-patient-${groupe.patient_id}`);
                        const btn = document.getElementById(`btn-encaisser-${groupe.patient_id}`);
                        if (totalEl) totalEl.textContent = `${sum.toLocaleString('fr-FR')} FC`;
                        if (countEl) countEl.textContent = `(${ids.length} sur ${groupe.items.length} examen${groupe.items.length > 1 ? 's' : ''})`;
                        if (btn) {
                            btn.disabled = ids.length === 0;
                            btn.style.opacity = ids.length === 0 ? '0.5' : '1';
                        }
                        return { sum, ids, noms };
                    }

                    // Écouter les changements de case
                    const checkboxes = tbody.querySelectorAll(`.examen-check-${groupe.patient_id}`);
                    checkboxes.forEach(chk => {
                        chk.addEventListener('change', () => {
                            const allChk = tbody.querySelectorAll(`.examen-check-${groupe.patient_id}`);
                            const checkedChk = tbody.querySelectorAll(`.examen-check-${groupe.patient_id}:checked`);
                            const toggleAll = trHeader.querySelector(`.toggle-all-patient`);
                            if (toggleAll) toggleAll.checked = (allChk.length === checkedChk.length);
                            recalculerTotalPatient();
                        });
                    });

                    // Écouter le "Tout sélectionner"
                    const toggleAll = trHeader.querySelector(`.toggle-all-patient`);
                    if (toggleAll) {
                        toggleAll.addEventListener('change', (e) => {
                            checkboxes.forEach(chk => { chk.checked = e.target.checked; });
                            recalculerTotalPatient();
                        });
                    }

                    // Bouton Encaisser
                    const btnEncaisser = trFooter.querySelector(`#btn-encaisser-${groupe.patient_id}`);
                    if (btnEncaisser) {
                        btnEncaisser.addEventListener('click', () => {
                            const { sum, ids, noms } = recalculerTotalPatient();
                            if (ids.length === 0) {
                                showToast("Veuillez sélectionner au moins un examen à payer.", "warning");
                                return;
                            }
                            if (!confirm(`Confirmer l'encaissement de ${sum.toLocaleString('fr-FR')} FC pour ${ids.length} examen(s) de ${patientLabel} ?`)) return;

                            btnEncaisser.disabled = true;
                            ApiClient.request('/labo/payer-examens', 'POST', { prescription_ids: ids })
                                .then(res => {
                                    showToast(`Paiement validé ! Ticket attribué : ${res.ticket_labo}`, "success");
                                    loadExamensCaisse();
                                    document.getElementById('recu-ref').textContent = res.ticket_labo;
                                    document.getElementById('recu-patient').textContent = patientLabel;
                                    document.getElementById('recu-date').textContent = new Date().toLocaleString('fr-FR');
                                    document.getElementById('recu-motif').textContent = `Examens Labo: ${noms.join(', ')}`;
                                    document.getElementById('recu-montant').textContent = sum.toLocaleString('fr-FR');
                                    document.getElementById('modal-recu').style.display = 'flex';
                                })
                                .catch(err => {
                                    btnEncaisser.disabled = false;
                                    showToast("Erreur lors de l'encaissement : " + err.message, "danger");
                                });
                        });
                    }

                    // Calcul initial
                    recalculerTotalPatient();
                });
            })
            .catch(err => {
                tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger" style="padding: 1.5rem;">Erreur : ${escapeHtml(err.message)}</td></tr>`;
            });
    }

    // Compatibilité
    window.payerExamenCaisse = function(prescriptionIds, patientName, examenNom, prix) {
        ApiClient.request('/labo/payer-examens', 'POST', { prescription_ids: prescriptionIds })
            .then(res => {
                showToast(`Paiement validé ! Ticket attribué : ${res.ticket_labo}`, "success");
                loadExamensCaisse();
            })
            .catch(err => showToast("Erreur : " + err.message, "danger"));
    };

        fetchTarif().then(() => loadFactures());
    loadExamensCaisse();

    // Les notifications (paiements, nouveaux examens, résultats) sont gérées
    // par js/notifications.js ; on rafraîchit les files visibles à leur arrivée.
    document.addEventListener('hospira:notification', () => {
        loadFactures();
        loadExamensCaisse();
    });

    window.showToast = function(message, type = "success") {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span>${escapeHtml(message)}</span><button onclick="this.parentElement.remove()" style="background:none; border:none; color:white; cursor:pointer;">&times;</button>`;
        container.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 5000);
        setTimeout(() => { toast.style.opacity = '1'; }, 10);
    };
});
