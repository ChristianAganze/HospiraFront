const fs = require('fs');
let html = fs.readFileSync('F:/Hospira/HospiraFront/index.html', 'utf8');

const targetRegex = /<textarea id="cons-notes" class="form-control" rows="2"><\/textarea>\s*<\/div>/;
const match = html.match(targetRegex);

if (match) {
    const idx = match.index;
    const startHtml = html.substring(0, idx + match[0].length);
    const replacement = `

                                <h4 style="color: var(--primary-color); margin-top: 1.5rem; margin-bottom: 0.5rem;">Ordonnance / Prescriptions</h4>
                                <div id="prescription-list" style="margin-bottom: 1rem;">
                                    <!-- Liste des médicaments ajoutés -->
                                </div>
                                
                                <div style="background-color: var(--bg-main); padding: 1rem; border-radius: var(--radius-sm); border: 1px dashed rgba(0,0,0,0.1);">
                                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.5rem;">
                                        <input type="text" id="med-nom" class="form-control" placeholder="Médicament" style="flex: 2; min-width: 150px;">
                                        <input type="text" id="med-posologie" class="form-control" placeholder="Posologie (ex: 1 cp matin)" style="flex: 2; min-width: 150px;">
                                        <input type="text" id="med-duree" class="form-control" placeholder="Durée (ex: 7 jours)" style="flex: 1; min-width: 100px;">
                                    </div>
                                    <button type="button" class="btn btn-secondary" id="btn-add-medicament" style="padding: 0.5rem 1rem; font-size: 0.85rem;">+ Ajouter à l'ordonnance</button>
                                </div>

                                <div style="margin-top: 2rem; border-top: 1px solid rgba(0,0,0,0.05); padding-top: 1rem; text-align: right;">
                                    <button type="submit" class="btn btn-primary" style="padding: 0.75rem 2rem;">Clôturer la Consultation</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Vue Caisse -->
            <div id="view-caisse" style="display: none;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h3>Factures et Encaissements</h3>
                    <button class="btn btn-primary" id="btn-create-facture">+ Nouvelle Facture</button>
                </div>
                
                <div class="card">
                    <div style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse; text-align: left;">
                            <thead>
                                <tr style="border-bottom: 2px solid rgba(0,0,0,0.05);">
                                    <th style="padding: 1rem 0.5rem; color: var(--text-muted); font-weight: 500;">N° Facture</th>
                                    <th style="padding: 1rem 0.5rem; color: var(--text-muted); font-weight: 500;">Patient</th>
                                    <th style="padding: 1rem 0.5rem; color: var(--text-muted); font-weight: 500;">Date</th>
                                    <th style="padding: 1rem 0.5rem; color: var(--text-muted); font-weight: 500;">Montant</th>
                                    <th style="padding: 1rem 0.5rem; color: var(--text-muted); font-weight: 500;">Statut</th>
                                    <th style="padding: 1rem 0.5rem; color: var(--text-muted); font-weight: 500;">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="factures-list">
                                <!-- Données chargées en JS -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </section>
    </main>

    <!-- Modal Ajouter Patient -->
    <div id="patient-modal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2>Nouveau Patient</h2>
                <button class="close-modal" id="close-patient-modal">&times;</button>
            </div>
            <form id="form-add-patient">
                <div style="display: flex; gap: 1rem;">
                    <div class="form-group" style="flex: 1;">
                        <label class="form-label">Nom *</label>
                        <input type="text" id="patient-nom" class="form-control" required>
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <label class="form-label">Prénom *</label>
                        <input type="text" id="patient-prenom" class="form-control" required>
                    </div>
                </div>
                
                <div style="display: flex; gap: 1rem;">
                    <div class="form-group" style="flex: 1;">
                        <label class="form-label">Date de naissance *</label>
                        <input type="date" id="patient-dob" class="form-control" required>
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <label class="form-label">Sexe *</label>
                        <select id="patient-sexe" class="form-control" required>
                            <option value="M">Masculin</option>
                            <option value="F">Féminin</option>
                        </select>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Téléphone</label>
                    <input type="tel" id="patient-tel" class="form-control">
                </div>

                <button type="submit" class="btn btn-primary btn-block mt-2">Enregistrer le patient</button>
            </form>
        </div>
    </div>

    <script src="js/api.js"></script>
    <script src="js/app.js"></script>
    <script src="js/viewmodels/patientsVM.js"></script>
    <script src="js/viewmodels/rendezvousVM.js"></script>
    <script src="js/viewmodels/caisseVM.js"></script>
</body>
</html>`;

    fs.writeFileSync('F:/Hospira/HospiraFront/index.html', startHtml + replacement);
    console.log('Successfully fixed index.html end');
} else {
    console.log('Could not find cons-notes textarea');
}
