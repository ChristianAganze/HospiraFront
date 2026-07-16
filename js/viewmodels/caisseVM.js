class CaisseViewModel {
    constructor() {
        this.facturesList = document.getElementById('caisse-table-body');
        this.btnCreateFacture = document.getElementById('btn-create-facture');
        this.modalRecu = document.getElementById('modal-recu');
        this.init();
    }

    init() {
        if (!this.facturesList) return;
        
        // On load
        this.loadFactures();

        // Add event listener for loading dynamically
        window.addEventListener('loadCaisse', () => {
            this.loadFactures();
        });

        // Add new facture button
        if (this.btnCreateFacture) {
            this.btnCreateFacture.addEventListener('click', () => {
                alert('La fonctionnalité de création de facture sera implémentée prochainement.');
            });
        }

        const closeRecu = document.getElementById('close-modal-recu');
        if (closeRecu) {
            closeRecu.addEventListener('click', () => {
                this.modalRecu.style.display = 'none';
            });
        }

        const btnPrint = document.getElementById('btn-print-recu');
        if (btnPrint) {
            btnPrint.addEventListener('click', () => {
                const prtContent = document.getElementById("ticket-caisse");
                const WinPrint = window.open('', '', 'left=0,top=0,width=800,height=900,toolbar=0,scrollbars=0,status=0');
                WinPrint.document.write('<html><head><title>Reçu Hôpital</title>');
                WinPrint.document.write('<style>body{font-family: sans-serif; padding: 20px;} hr{border: 1px dashed #eee;}</style>');
                WinPrint.document.write('</head><body>');
                WinPrint.document.write(prtContent.innerHTML);
                WinPrint.document.write('</body></html>');
                WinPrint.document.close();
                WinPrint.focus();
                WinPrint.print();
                WinPrint.close();
            });
        }
    }

    async loadFactures() {
        try {
            this.facturesList.innerHTML = '<tr><td colspan="5" class="text-center">Chargement des factures...</td></tr>';
            const response = await api.request('/api/factures', 'GET');
            this.renderFactures(response);
        } catch (error) {
            console.error('Erreur lors du chargement des factures:', error);
            this.facturesList.innerHTML = `<tr><td colspan="6" class="text-center" style="color:var(--danger-color)">Erreur de connexion : Veuillez démarrer MySQL sur XAMPP.</td></tr>`;
        }
    }

    renderFactures(response) {
        let factures = response.records || response;
        if (!factures || factures.length === 0) {
            this.facturesList.innerHTML = '<tr><td colspan="5" class="text-center">Aucune facture trouvée.</td></tr>';
            return;
        }

        this.facturesList.innerHTML = factures.map(f => `
            <tr style="border-bottom: 1px solid rgba(0,0,0,0.05);">
                <td style="padding: 1rem 0.5rem; font-weight: 500;">FAC-${f.id.toString().padStart(4, '0')}</td>
                <td style="padding: 1rem 0.5rem;">
                    <strong>${f.patient_nom}</strong><br>
                    <small style="color: var(--text-muted);">${f.id_iup}</small>
                </td>
                <td style="padding: 1rem 0.5rem;">${new Date(f.date_facturation).toLocaleDateString('fr-FR')}</td>
                <td style="padding: 1rem 0.5rem; font-weight: bold;">${parseFloat(f.montant_total).toFixed(2)} $</td>
                <td style="padding: 1rem 0.5rem;">
                    <span style="display: inline-block; padding: 0.25rem 0.75rem; border-radius: 50px; font-size: 0.85rem; font-weight: 500; 
                        background-color: ${f.statut === 'Payé' ? 'rgba(0, 184, 148, 0.1)' : 'rgba(253, 203, 110, 0.1)'};
                        color: ${f.statut === 'Payé' ? 'var(--primary-color)' : '#e1b12c'};">
                        ${f.statut}
                    </span>
                </td>
                <td style="padding: 1rem 0.5rem;">
                    ${f.statut === 'En attente' ? 
                        `<button class="btn btn-primary btn-payer" data-id="${f.id}" data-patient="${f.patient_nom} ${f.patient_prenom}" data-montant="${f.montant_total}" style="padding: 0.25rem 0.75rem; font-size: 0.85rem;">Encaisser</button>` 
                        : `<button class="btn btn-secondary btn-recu" data-patient="${f.patient_nom} ${f.patient_prenom}" data-montant="${f.montant_total}" data-date="${f.date_facturation}" style="padding: 0.25rem 0.75rem; font-size: 0.85rem;">Reçu</button>`}
                </td>
            </tr>
        `).join('');

        // Attacher les événements aux boutons "Encaisser"
        document.querySelectorAll('.btn-payer').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const factureId = e.target.getAttribute('data-id');
                const patientNom = e.target.getAttribute('data-patient');
                const montant = e.target.getAttribute('data-montant');
                
                if (confirm(`Confirmer l'encaissement de ${montant} FC pour ${patientNom} ?`)) {
                    try {
                        await api.request(`/api/factures/${factureId}/payer`, 'POST', { montant_paye: montant });
                        this.showRecu(patientNom, montant, new Date().toISOString());
                        this.loadFactures();
                    } catch (error) {
                        alert('Erreur lors du paiement');
                    }
                }
            });
        });

        // Attacher les événements aux boutons "Reçu"
        document.querySelectorAll('.btn-recu').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const patientNom = e.target.getAttribute('data-patient');
                const montant = e.target.getAttribute('data-montant');
                const dateF = e.target.getAttribute('data-date');
                this.showRecu(patientNom, montant, dateF);
            });
        });
    }

    showRecu(patientNom, montant, dateF) {
        document.getElementById('recu-patient').textContent = patientNom;
        document.getElementById('recu-montant').textContent = parseFloat(montant).toFixed(2);
        document.getElementById('recu-date').textContent = new Date(dateF).toLocaleString('fr-FR');
        this.modalRecu.style.display = 'flex';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new CaisseViewModel();
});
