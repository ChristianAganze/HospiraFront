const fs = require('fs');

let content = fs.readFileSync('F:/Hospira/HospiraFront/index.html', 'utf8');

const mainStart = content.indexOf('<main class="main-content">');
const tableStart = content.indexOf('<input type="text" id="search-patient"');

if (mainStart !== -1 && tableStart !== -1) {
    const newHeader = `
        <header class="topbar">
            <h1 id="page-title">Tableau de bord</h1>
            <button class="btn btn-primary" id="btn-add-patient">+ Nouveau Patient</button>
        </header>

        <section class="content-area" id="main-view">
            
            <!-- Vue Dashboard (Admin) -->
            <div id="view-dashboard" style="display: none;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h3>Aperçu des Statistiques</h3>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
                    <div class="card" style="text-align: center;">
                        <h4 style="color: var(--text-muted); margin-bottom: 0.5rem;">Patients Inscrits</h4>
                        <h2 style="font-size: 2.5rem; color: var(--primary-color); margin: 0;" id="stat-patients">...</h2>
                    </div>
                    <div class="card" style="text-align: center;">
                        <h4 style="color: var(--text-muted); margin-bottom: 0.5rem;">Consultations</h4>
                        <h2 style="font-size: 2.5rem; color: #00b894; margin: 0;" id="stat-consultations">...</h2>
                    </div>
                    <div class="card" style="text-align: center;">
                        <h4 style="color: var(--text-muted); margin-bottom: 0.5rem;">Rendez-vous</h4>
                        <h2 style="font-size: 2.5rem; color: #e17055; margin: 0;" id="stat-rendezvous">...</h2>
                    </div>
                    <div class="card" style="text-align: center;">
                        <h4 style="color: var(--text-muted); margin-bottom: 0.5rem;">Revenus du jour (FC)</h4>
                        <h2 style="font-size: 2.5rem; color: #fdccb6; margin: 0;" id="stat-revenus">...</h2>
                    </div>
                </div>
            </div>

            <!-- Vue Patients -->
            <div id="view-patients" style="display: none;">
                <div class="card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                        <h3>Liste des patients enregistrés</h3>
                        `;
    const finalContent = content.substring(0, mainStart + '<main class="main-content">'.length) + newHeader + content.substring(tableStart);
    fs.writeFileSync('F:/Hospira/HospiraFront/index.html', finalContent);
    console.log("Fixed index.html");
} else {
    console.log("Could not fix index.html", mainStart, tableStart);
}
