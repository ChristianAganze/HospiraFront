/**
 * rendezvousVM.js - ViewModel pour la gestion des rendez-vous
 */

document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.getElementById('rendezvous-table-body');
    let rendezvousList = [];

    // 1. Charger les rendez-vous depuis l'API
    async function fetchRendezvous() {
        try {
            const data = await ApiClient.getRendezvous();
            rendezvousList = data.records || [];
            renderTable(rendezvousList);
        } catch (error) {
            console.error("Erreur lors de la récupération des rendez-vous:", error);
            tableBody.innerHTML = `<tr><td colspan="4" class="text-center" style="color:var(--danger-color)">Erreur de chargement des données.</td></tr>`;
        }
    }

    // 2. Afficher les rendez-vous dans le tableau
    function renderTable(rvs) {
        tableBody.innerHTML = '';
        
        if (rvs.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="4" class="text-center">Aucun rendez-vous planifié.</td></tr>`;
            return;
        }

        rvs.forEach(rv => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid rgba(0,0,0,0.05)';
            
            // Format de la date et heure (FR)
            const dateObj = new Date(rv.date_heure);
            const dateStr = dateObj.toLocaleDateString('fr-FR');
            const timeStr = dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            
            // Couleur du statut
            let badgeClass = 'var(--primary-light)';
            if (rv.statut === 'Terminé') badgeClass = 'var(--success-color)';
            else if (rv.statut === 'Annulé') badgeClass = 'var(--danger-color)';

            tr.innerHTML = `
                <td style="padding: 1rem 0.5rem; font-weight: 500;">
                    ${dateStr} à <span style="color:var(--primary-color)">${timeStr}</span>
                </td>
                <td style="padding: 1rem 0.5rem;">
                    <strong>${rv.patient.nom} ${rv.patient.prenom}</strong><br>
                    <span style="font-size: 0.8rem; color: var(--text-muted);">${rv.patient.id_iup}</span>
                </td>
                <td style="padding: 1rem 0.5rem;">${rv.motif || '-'}</td>
                <td style="padding: 1rem 0.5rem;">
                    <span style="background-color: ${badgeClass}; color: white; padding: 0.25rem 0.5rem; border-radius: var(--radius-pill); font-size: 0.8rem;">
                        ${rv.statut}
                    </span>
                </td>
                <td style="padding: 1rem 0.5rem;">
                    ${rv.statut === 'Planifié' ? `
                        <button class="btn-icon btn-start-consultation" data-rvid="${rv.id}" data-patientid="${rv.patient_id}" title="Démarrer la consultation" style="color: var(--primary-color);">🩺</button>
                    ` : ''}
                </td>
            `;
            tableBody.appendChild(tr);
        });

        // Ajouter écouteurs d'événements pour les boutons de consultation
        tableBody.querySelectorAll('.btn-start-consultation').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const rvId = e.currentTarget.getAttribute('data-rvid');
                const patientId = e.currentTarget.getAttribute('data-patientid');
                
                // Retrouver le patient complet (rendezvousList contient l'objet patient)
                const rv = rendezvousList.find(r => r.id == rvId);
                if(rv && rv.patient) {
                    window.dispatchEvent(new CustomEvent('startConsultation', { detail: { patient: rv.patient, rendezvousId: rvId } }));
                }
            });
        });
    }

    // 3. Écouter l'événement de navigation depuis app.js
    window.addEventListener('loadRendezvous', () => {
        fetchRendezvous();
    });
});
