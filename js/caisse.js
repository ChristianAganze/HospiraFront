/**
 * caisse.js - Logique pour le tableau de bord Caissier
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
    if (roleLower !== 'caissier' && roleLower !== 'caisse' && roleLower !== 'admin' && roleLower !== 'administrateur') {
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

    // Mobile Menu Toggle
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            document.querySelector('.nav-menu').classList.toggle('show');
        });
    }

    // 3. Charger les Factures (RDV "À payer")
    function loadFactures() {
        ApiClient.request('/api/rendezvous', 'GET')
            .then(res => {
                const rdvs = (res && res.records) ? res.records : (Array.isArray(res) ? res : []);
                const tbody = document.getElementById('caisse-table-body');
                tbody.innerHTML = '';
                
                // Filtrer seulement les statuts "À payer"
                const aPayer = rdvs.filter(r => r.statut === 'À payer');
                
                // Calculer les revenus du jour (RDV "Confirmé" ou "Terminé" aujourd'hui)
                const revenusJour = rdvs.filter(r => {
                    const today = new Date().toDateString();
                    const isToday = new Date(r.date_heure).toDateString() === today;
                    return isToday && (r.statut === 'Confirmé' || r.statut === 'Terminé');
                }).reduce((sum, r) => sum + 15000, 0);
                
                document.getElementById('caisse-total-jour').textContent = revenusJour.toLocaleString('fr-FR') + ' FC';

                if (aPayer.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted" style="padding: 2rem;">Aucune facture en attente de paiement.</td></tr>';
                    return;
                }

                aPayer.forEach(facture => {
                    const montant = 15000; // Tarif consultation standard
                    const annee = facture.date_heure ? new Date(facture.date_heure).getFullYear() : new Date().getFullYear();
                    const ref = `FAC-${annee}-${facture.id.toString().padStart(4, '0')}`;
                    const motif = facture.motif || 'Consultation Médicale';
                    // Support objet imbriqué patient.prenom/nom ou champs plats
                    const patientPrenom = facture.patient ? facture.patient.prenom : (facture.patient_prenom || '');
                    const patientNom = facture.patient ? facture.patient.nom : (facture.patient_nom || '');
                    const ticket = facture.numero_passage || '-';

                    const tr = document.createElement('tr');
                    tr.style.borderBottom = '1px solid rgba(0,0,0,0.05)';
                    tr.innerHTML = `
                        <td style="padding: 1rem 0.5rem; font-weight:500;">${ref} <span style="font-size:0.75rem; color:var(--text-muted)">Ticket #${ticket}</span></td>
                        <td style="padding: 1rem 0.5rem;">${patientPrenom} ${patientNom}</td>
                        <td style="padding: 1rem 0.5rem;">${motif}</td>
                        <td style="padding: 1rem 0.5rem; font-weight: bold; color: var(--text-main);">${montant.toLocaleString('fr-FR')} FC</td>
                        <td style="padding: 1rem 0.5rem;">
                            <button class="btn btn-success" onclick="payerFacture(${facture.id}, '${ref}', '${patientPrenom} ${patientNom}', '${motif}', ${montant})" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;">💰 Encaisser</button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            })
            .catch(error => {
                document.getElementById('caisse-table-body').innerHTML = `<tr><td colspan="5" class="text-center text-danger">⚠️ Erreur de chargement : ${error.message}</td></tr>`;
            });
    }

    // Payer Facture
    window.payerFacture = function(id, ref, patient, motif, montant) {
        if(!confirm(`Confirmer le paiement de ${montant} FC pour ${patient} ?`)) return;

        ApiClient.request(`/api/rendezvous/${id}/payer`, 'POST')
            .then(() => {
                loadFactures();
                showToast("Paiement validé avec succès !", "success");
                
                // Afficher le reçu
                const modalRecu = document.getElementById('modal-recu');
                document.getElementById('recu-ref').textContent = ref;
                document.getElementById('recu-patient').textContent = patient;
                document.getElementById('recu-date').textContent = new Date().toLocaleString('fr-FR');
                document.getElementById('recu-motif').textContent = motif;
                document.getElementById('recu-montant').textContent = montant;
                modalRecu.style.display = 'flex';
            })
            .catch(err => {
                showToast(err.message || "Erreur lors de l'encaissement", "danger");
            });
    };

    // Impression
    const modalRecu = document.getElementById('modal-recu');
    document.getElementById('close-modal-recu').addEventListener('click', () => modalRecu.style.display = 'none');
    
    document.getElementById('btn-print-recu').addEventListener('click', () => {
        const ticket = document.getElementById('ticket-caisse').innerHTML;
        const a = window.open('', '', 'height=500, width=500');
        a.document.write('<html><body style="font-family: monospace;">');
        a.document.write(ticket);
        a.document.write('</body></html>');
        a.document.close();
        a.print();
    });

    // 4. Charger les examens prescrits à encaisser
    function loadExamensCaisse() {
        const tbody = document.getElementById('examens-caisse-table-body');
        if (!tbody) return;

        ApiClient.request('/api/prescriptions-examens?statut_paiement=Non paye', 'GET')
            .then(data => {
                if (data && data.prescriptions && data.prescriptions.length > 0) {
                    tbody.innerHTML = data.prescriptions.map(item => `
                        <tr style="border-bottom: 1px solid rgba(0,0,0,0.05);">
                            <td style="padding: 1rem 0.5rem; font-weight: 500;">${item.patient_prenom} ${item.patient_nom}</td>
                            <td style="padding: 1rem 0.5rem;">
                                <strong>${item.examen_nom}</strong><br>
                                <small style="color: var(--text-muted);">${item.examen_desc || ''}</small>
                            </td>
                            <td style="padding: 1rem 0.5rem;">Dr. ${item.medecin_prenom} ${item.medecin_nom}</td>
                            <td style="padding: 1rem 0.5rem; font-weight: bold; color: var(--success-color);">${item.examen_prix} FC</td>
                            <td style="padding: 1rem 0.5rem;">
                                <button class="btn btn-primary" onclick="payerExamenCaisse([${item.id}], '${item.patient_prenom} ${item.patient_nom}', '${item.examen_nom}', ${item.examen_prix})" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;">Encaisser & Générer Ticket Labo</button>
                            </td>
                        </tr>
                    `).join('');
                } else {
                    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted" style="padding: 1.5rem;">Aucun examen en attente de paiement.</td></tr>';
                }
            })
            .catch(err => {
                tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger" style="padding: 1.5rem;">Erreur : ${err.message}</td></tr>`;
            });
    }

    window.payerExamenCaisse = function(prescriptionIds, patientName, examenNom, prix) {
        if (!confirm(`Confirmer le paiement de ${prix} FC pour l'examen "${examenNom}" de ${patientName} ?`)) return;

        ApiClient.request('/api/labo/payer-examens', 'POST', { prescription_ids: prescriptionIds })
            .then(res => {
                showToast(`Paiement validé ! Ticket attribué : ${res.ticket_labo}`, "success");
                loadExamensCaisse();

                // Afficher le reçu
                document.getElementById('recu-ref').textContent = res.ticket_labo;
                document.getElementById('recu-patient').textContent = patientName;
                document.getElementById('recu-date').textContent = new Date().toLocaleString('fr-FR');
                document.getElementById('recu-motif').textContent = `Examen Labo: ${examenNom}`;
                document.getElementById('recu-montant').textContent = prix;
                document.getElementById('modal-recu').style.display = 'flex';
            })
            .catch(err => {
                showToast("Erreur lors de l'encaissement : " + err.message, "danger");
            });
    };

    // Init
    loadFactures();
    loadExamensCaisse();

    // Utility: Notifications
    window.showToast = function(message, type = "success") {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span>${message}</span><button onclick="this.parentElement.remove()" style="background:none; border:none; color:white; cursor:pointer;">&times;</button>`;
        container.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 5000);
        setTimeout(() => { toast.style.opacity = '1'; }, 10);
    }
});
