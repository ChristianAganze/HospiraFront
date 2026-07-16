/**
 * patientsVM.js - ViewModel pour la gestion des patients
 */

document.addEventListener('DOMContentLoaded', () => {
    // Éléments du DOM
    const tableBody = document.getElementById('patients-table-body');
    const btnAddPatient = document.getElementById('btn-add-patient');
    const modal = document.getElementById('patient-modal');
    const btnCloseModal = document.getElementById('close-patient-modal');
    const formAddPatient = document.getElementById('form-add-patient');
    const searchInput = document.getElementById('search-patient');

    let patientsList = []; // Stockage local des patients

    // 1. Charger les patients depuis l'API
    async function fetchPatients() {
        try {
            const data = await ApiClient.getPatients();
            patientsList = data.records || [];
            renderTable(patientsList);
        } catch (error) {
            console.error("Erreur lors de la récupération des patients:", error);
            tableBody.innerHTML = `<tr><td colspan="6" class="text-center" style="color:var(--danger-color)">Erreur de chargement des données.</td></tr>`;
        }
    }

    // 2. Afficher les patients dans le tableau
    function renderTable(patients) {
        tableBody.innerHTML = '';
        
        if (patients.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" class="text-center">Aucun patient trouvé.</td></tr>`;
            return;
        }

        patients.forEach(patient => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid rgba(0,0,0,0.05)';
            
            // Format de la date (FR)
            const dateObj = new Date(patient.date_naissance);
            const dateStr = dateObj.toLocaleDateString('fr-FR');
            
            tr.innerHTML = `
                <td style="padding: 1rem 0.5rem; font-weight: 500;">${patient.id_iup}</td>
                <td style="padding: 1rem 0.5rem;"><strong>${patient.nom}</strong> ${patient.prenom}</td>
                <td style="padding: 1rem 0.5rem;">${dateStr}</td>
                <td style="padding: 1rem 0.5rem;">${patient.sexe}</td>
                <td style="padding: 1rem 0.5rem;">${patient.telephone || '-'}</td>
                <td style="padding: 1rem 0.5rem;">
                        <button class="btn-icon btn-start-consultation" data-id="${patient.id}" title="Démarrer consultation">🩺</button>
                    <button class="btn btn-primary" style="padding: 0.25rem 0.5rem; font-size: 0.8rem; background-color: var(--secondary-color);">Rdv</button>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        // Ajouter écouteurs d'événements pour les boutons de consultation
        tableBody.querySelectorAll('.btn-start-consultation').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const patientId = e.currentTarget.getAttribute('data-id');
                const patient = patientsList.find(p => p.id == patientId);
                if(patient) {
                    window.dispatchEvent(new CustomEvent('startConsultation', { detail: { patient: patient, rendezvousId: null } }));
                }
            });
        });
    }

    // 3. Gestion de la modale
    btnAddPatient.addEventListener('click', () => {
        modal.style.display = 'flex';
    });

    btnCloseModal.addEventListener('click', () => {
        modal.style.display = 'none';
        formAddPatient.reset();
    });

    // Fermer la modale si on clique à l'extérieur
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
            formAddPatient.reset();
        }
    });

    // 4. Ajouter un patient
    formAddPatient.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const newPatient = {
            nom: document.getElementById('patient-nom').value.toUpperCase(),
            prenom: document.getElementById('patient-prenom').value,
            date_naissance: document.getElementById('patient-dob').value,
            sexe: document.getElementById('patient-sexe').value,
            telephone: document.getElementById('patient-tel').value
        };

        try {
            await ApiClient.createPatient(newPatient);
            // Succès
            modal.style.display = 'none';
            formAddPatient.reset();
            // Recharger la liste
            fetchPatients();
        } catch (error) {
            alert("Erreur: " + error.message);
        }
    });

    // 5. Recherche
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = patientsList.filter(p => 
            p.nom.toLowerCase().includes(term) || 
            p.prenom.toLowerCase().includes(term) || 
            p.id_iup.toLowerCase().includes(term)
        );
        renderTable(filtered);
    });

    // Initialisation
    fetchPatients();
});
