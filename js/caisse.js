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
                if (data && data.prescriptions && data.prescriptions.length > 0) {
                    tbody.innerHTML = '';
                    data.prescriptions.forEach(item => {
                        const tr = document.createElement('tr');
                        tr.style.borderBottom = '1px solid rgba(0,0,0,0.05)';
                        tr.innerHTML = `
                            <td style="padding: 1rem 0.5rem; font-weight: 500;">${escapeHtml(item.patient_prenom)} ${escapeHtml(item.patient_nom)}</td>
                            <td style="padding: 1rem 0.5rem;"><strong>${escapeHtml(item.examen_nom)}</strong><br><small style="color: var(--text-muted);">${escapeHtml(item.examen_desc || '')}</small></td>
                            <td style="padding: 1rem 0.5rem;">Dr. ${escapeHtml(item.medecin_prenom)} ${escapeHtml(item.medecin_nom)}</td>
                            <td style="padding: 1rem 0.5rem; font-weight: bold; color: var(--success-color);">${escapeHtml(item.examen_prix)} FC</td>
                            <td style="padding: 1rem 0.5rem;"><button class="btn btn-primary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;">Encaisser & Générer Ticket Labo</button></td>
                        `;
                        tr.querySelector('button').addEventListener('click', () => payerExamenCaisse([item.id], `${item.patient_prenom} ${item.patient_nom}`, item.examen_nom, item.examen_prix));
                        tbody.appendChild(tr);
                    });
                } else {
                    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted" style="padding: 1.5rem;">Aucun examen en attente de paiement.</td></tr>';
                }
            })
            .catch(err => {
                tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger" style="padding: 1.5rem;">Erreur : ${escapeHtml(err.message)}</td></tr>`;
            });
    }

    window.payerExamenCaisse = function(prescriptionIds, patientName, examenNom, prix) {
        if (!confirm(`Confirmer le paiement de ${prix} FC pour l'examen "${examenNom}" de ${patientName} ?`)) return;
        ApiClient.request('/labo/payer-examens', 'POST', { prescription_ids: prescriptionIds })
            .then(res => {
                showToast(`Paiement validé ! Ticket attribué : ${res.ticket_labo}`, "success");
                loadExamensCaisse();
                document.getElementById('recu-ref').textContent = res.ticket_labo;
                document.getElementById('recu-patient').textContent = patientName;
                document.getElementById('recu-date').textContent = new Date().toLocaleString('fr-FR');
                document.getElementById('recu-motif').textContent = `Examen Labo: ${examenNom}`;
                document.getElementById('recu-montant').textContent = prix;
                document.getElementById('modal-recu').style.display = 'flex';
            })
            .catch(err => showToast("Erreur lors de l'encaissement : " + err.message, "danger"));
    };

    fetchTarif().then(() => loadFactures());
    loadExamensCaisse();

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
