class ConsultationVM {
    constructor() {
        this.currentPatient = null;
        this.currentRendezvousId = null;
        this.prescriptions = [];

        this.initElements();
        this.bindEvents();
    }

    initElements() {
        // Vues et conteneurs
        this.viewConsultation = document.getElementById('view-consultation');
        this.historiqueContainer = document.getElementById('consultation-historique');
        this.prescriptionList = document.getElementById('prescription-list');
        
        // Headers patient
        this.patientNameHeader = document.getElementById('consultation-patient-name');
        this.patientInfoHeader = document.getElementById('consultation-patient-info');

        // Formulaire et champs
        this.form = document.getElementById('form-nouvelle-consultation');
        this.poids = document.getElementById('cons-poids');
        this.taille = document.getElementById('cons-taille');
        this.temp = document.getElementById('cons-temp');
        this.tension = document.getElementById('cons-tension');
        this.symptomes = document.getElementById('cons-symptomes');
        this.diagnostic = document.getElementById('cons-diagnostic');
        this.notes = document.getElementById('cons-notes');

        // Médicaments
        this.medNom = document.getElementById('med-nom');
        this.medPosologie = document.getElementById('med-posologie');
        this.medDuree = document.getElementById('med-duree');
        this.btnAddMed = document.getElementById('btn-add-medicament');
        this.btnBack = document.getElementById('btn-back-patients');
    }

    bindEvents() {
        // Écouter l'événement global pour démarrer une consultation
        window.addEventListener('startConsultation', (e) => {
            const data = e.detail;
            this.startConsultation(data.patient, data.rendezvousId);
        });

        this.btnBack.addEventListener('click', () => {
            window.dispatchEvent(new Event('loadPatients'));
        });

        this.btnAddMed.addEventListener('click', () => this.addMedicament());

        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveConsultation();
        });
    }

    async startConsultation(patient, rendezvousId) {
        this.currentPatient = patient;
        this.currentRendezvousId = rendezvousId;
        this.prescriptions = []; // Reset l'ordonnance
        this.renderPrescriptions();
        this.form.reset(); // Reset le formulaire

        // Mettre à jour l'en-tête
        this.patientNameHeader.textContent = `Consultation : ${patient.nom} ${patient.prenom}`;
        this.patientInfoHeader.textContent = `IUP: ${patient.id_iup} | Né(e) le: ${new Date(patient.date_naissance).toLocaleDateString('fr-FR')} | Sexe: ${patient.sexe} | Groupe Sanguin: ${patient.groupe_sanguin || 'Non renseigné'}`;

        // Charger l'historique
        await this.loadHistorique();

        // Afficher la vue
        document.getElementById('view-patients').style.display = 'none';
        document.getElementById('view-rendezvous').style.display = 'none';
        this.viewConsultation.style.display = 'block';
        document.getElementById('page-title').textContent = "Dossier Patient & Consultation";
    }

    async loadHistorique() {
        this.historiqueContainer.innerHTML = '<div class="text-center"><div class="loading-spinner" style="display:inline-block; border-color:var(--primary-color); border-top-color:transparent;"></div></div>';
        
        try {
            const data = await ApiClient.getConsultations(this.currentPatient.id);
            if (data && data.records && data.records.length > 0) {
                this.historiqueContainer.innerHTML = '';
                data.records.forEach(cons => {
                    const dateCons = new Date(cons.date_consultation).toLocaleString('fr-FR');
                    
                    let prescriptionsHtml = '';
                    if (cons.prescriptions && cons.prescriptions.length > 0) {
                        prescriptionsHtml = `
                            <div style="margin-top: 10px; background: rgba(0,0,0,0.03); padding: 10px; border-radius: var(--radius-sm);">
                                <strong>Ordonnance :</strong>
                                <ul style="margin: 5px 0 0 0; padding-left: 20px; font-size: 0.9rem;">
                                    ${cons.prescriptions.map(p => `<li>${p.medicament} - ${p.posologie} (${p.duree})</li>`).join('')}
                                </ul>
                            </div>
                        `;
                    }

                    const cardHtml = `
                        <div style="border-left: 3px solid var(--primary-color); background: var(--bg-main); padding: 1rem; margin-bottom: 1rem; border-radius: 0 var(--radius-sm) var(--radius-sm) 0;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                                <strong style="color: var(--primary-color);">${dateCons}</strong>
                                <span style="font-size: 0.8rem; color: var(--text-muted);">Dr. ${cons.medecin_nom}</span>
                            </div>
                            <div style="font-size: 0.9rem; margin-bottom: 0.5rem; display: flex; gap: 10px; flex-wrap: wrap; color: var(--text-muted);">
                                ${cons.poids ? `<span><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 2px;"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>${cons.poids}kg</span>` : ''}
                                ${cons.tension ? `<span>❤️ ${cons.tension}</span>` : ''}
                                ${cons.temperature ? `<span>🌡️ ${cons.temperature}°C</span>` : ''}
                            </div>
                            <p style="margin: 0 0 0.5rem 0; font-size: 0.95rem;"><strong>Symptômes :</strong> ${cons.symptomes || 'Non renseignés'}</p>
                            <p style="margin: 0; font-size: 0.95rem;"><strong>Diagnostic :</strong> ${cons.diagnostic}</p>
                            ${prescriptionsHtml}
                        </div>
                    `;
                    this.historiqueContainer.insertAdjacentHTML('beforeend', cardHtml);
                });
            } else {
                this.historiqueContainer.innerHTML = '<p class="text-center text-muted">Aucun historique disponible pour ce patient.</p>';
            }
        } catch (error) {
            console.error('Erreur lors du chargement de l\'historique', error);
            this.historiqueContainer.innerHTML = '<p class="text-center text-muted" style="color: var(--danger-color);">Erreur lors du chargement.</p>';
        }
    }

    addMedicament() {
        const nom = this.medNom.value.trim();
        const posologie = this.medPosologie.value.trim();
        const duree = this.medDuree.value.trim();

        if (!nom || !posologie || !duree) {
            alert("Veuillez remplir tous les champs du médicament (Nom, Posologie, Durée).");
            return;
        }

        this.prescriptions.push({
            medicament: nom,
            posologie: posologie,
            duree: duree,
            instructions: ""
        });

        // Nettoyer les champs d'entrée
        this.medNom.value = '';
        this.medPosologie.value = '';
        this.medDuree.value = '';

        this.renderPrescriptions();
    }

    removeMedicament(index) {
        this.prescriptions.splice(index, 1);
        this.renderPrescriptions();
    }

    renderPrescriptions() {
        this.prescriptionList.innerHTML = '';
        if (this.prescriptions.length === 0) {
            this.prescriptionList.innerHTML = '<p style="font-size: 0.9rem; color: var(--text-muted); font-style: italic;">Aucun médicament ajouté.</p>';
            return;
        }

        this.prescriptions.forEach((presc, index) => {
            const itemHtml = `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: white; border: 1px solid rgba(0,0,0,0.1); border-radius: var(--radius-sm); margin-bottom: 0.5rem;">
                    <div>
                        <strong style="color: var(--primary-color);">${presc.medicament}</strong>
                        <span style="margin: 0 10px; color: var(--text-muted);">|</span>
                        <span>${presc.posologie}</span>
                        <span style="margin: 0 10px; color: var(--text-muted);">|</span>
                        <span style="font-size: 0.9rem; color: var(--secondary-color);">${presc.duree}</span>
                    </div>
                    <button type="button" onclick="window.consultationVM.removeMedicament(${index})" style="background: none; border: none; color: var(--danger-color); cursor: pointer; padding: 5px;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            `;
            this.prescriptionList.insertAdjacentHTML('beforeend', itemHtml);
        });
    }

    async saveConsultation() {
        const userStr = localStorage.getItem('hospira_user');
        if (!userStr) return;
        const user = JSON.parse(userStr);

        const consultationData = {
            rendezvous_id: this.currentRendezvousId, // Peut être null si consultation sans RDV
            patient_id: this.currentPatient.id,
            medecin_id: user.id,
            poids: this.poids.value || null,
            taille: this.taille.value || null,
            temperature: this.temp.value || null,
            tension: this.tension.value || null,
            symptomes: this.symptomes.value,
            diagnostic: this.diagnostic.value,
            notes: this.notes.value,
            prescriptions: this.prescriptions
        };

        const btnSubmit = this.form.querySelector('button[type="submit"]');
        const originalText = btnSubmit.textContent;
        btnSubmit.textContent = "Enregistrement...";
        btnSubmit.disabled = true;

        try {
            const response = await ApiClient.createConsultation(consultationData);
            alert("Consultation enregistrée avec succès !");
            
            // Retourner aux patients ou aux rendez-vous
            if (this.currentRendezvousId) {
                window.dispatchEvent(new Event('loadRendezvous'));
            } else {
                window.dispatchEvent(new Event('loadPatients'));
            }
        } catch (error) {
            console.error(error);
            alert("Erreur lors de l'enregistrement de la consultation.");
        } finally {
            btnSubmit.textContent = originalText;
            btnSubmit.disabled = false;
        }
    }
}

// Initialiser le ViewModel une fois le DOM chargé
document.addEventListener('DOMContentLoaded', () => {
    window.consultationVM = new ConsultationVM();
});
