/**
 * laborantin.js - Gestion du tableau de bord Laboratoire
 */

document.addEventListener('DOMContentLoaded', () => {
    // Check Auth
    const token = localStorage.getItem('hospira_token');
    const userStr = localStorage.getItem('hospira_user');

    if (!token || !userStr) {
        window.location.href = 'login.html';
        return;
    }

    const user = JSON.parse(userStr);
    const roleLower = user.role.toLowerCase();
    if (roleLower !== 'laborantin' && roleLower !== 'admin') {
        window.location.href = 'login.html';
        return;
    }

    // Topbar User Info
    document.getElementById('user-name-top').textContent = `${user.prenom} ${user.nom}`;
    document.getElementById('user-role-top').textContent = user.role;

    // Load Queue
    loadLaboQueue();

    // Modal Events
    const modalResultat = document.getElementById('modal-resultat');
    const closeModalResultat = document.getElementById('close-modal-resultat');
    if (closeModalResultat) {
        closeModalResultat.addEventListener('click', () => {
            modalResultat.style.display = 'none';
        });
    }

    // Form Resultat Submit
    const formResultat = document.getElementById('form-resultat');
    if (formResultat) {
        formResultat.addEventListener('submit', async (e) => {
            e.preventDefault();

            const prescriptionId = document.getElementById('res-prescription-id').value;
            const texte = document.getElementById('res-texte').value.trim();
            const fileInput = document.getElementById('res-fichier');

            const formData = new FormData();
            formData.append('prescription_examen_id', prescriptionId);
            formData.append('laborantin_id', user.id);
            formData.append('resultat_texte', texte);

            if (fileInput.files.length > 0) {
                formData.append('fichier', fileInput.files[0]);
            }

            try {
                const response = await ApiClient.request('/api/resultats-examens', 'POST', formData, true);
                if (typeof showToast === 'function') {
                    showToast("Résultat d'examen enregistré et publié !");
                } else {
                    alert("Résultat d'examen enregistré et publié !");
                }
                modalResultat.style.display = 'none';
                formResultat.reset();
                loadLaboQueue();
            } catch (err) {
                alert("Erreur lors de l'enregistrement du résultat : " + err.message);
            }
        });
    }
});

async function loadLaboQueue() {
    const tbody = document.getElementById('table-labo-queue');
    if (!tbody) return;

    try {
        const response = await ApiClient.request('/api/labo/queue', 'GET');
        if (response && response.queue && response.queue.length > 0) {
            tbody.innerHTML = response.queue.map(item => {
                const isTermine = item.statut_examen === 'Termine';
                const badgeClass = isTermine ? 'badge-success' : 'badge-warning';
                const statusText = isTermine ? 'Résultat Publié' : 'En Attente';

                return `
                    <tr style="border-bottom: 1px solid rgba(0,0,0,0.05);">
                        <td style="padding: 1rem; font-weight: bold; color: var(--primary-color);">
                            <span style="background: rgba(37, 99, 235, 0.1); padding: 4px 10px; border-radius: var(--radius-pill);">
                                ${item.ticket_labo || 'LAB-000'}
                            </span>
                        </td>
                        <td style="padding: 1rem;">
                            <strong>${item.patient_prenom} ${item.patient_nom}</strong><br>
                            <small style="color: var(--text-muted);">${item.sexe === 'M' ? 'Homme' : 'Femme'} - ${item.age || '?'} ans</small>
                        </td>
                        <td style="padding: 1rem;">
                            <strong>${item.examen_nom}</strong><br>
                            <small style="color: var(--text-muted);">${item.examen_desc || ''}</small>
                        </td>
                        <td style="padding: 1rem;">
                            Dr. ${item.medecin_prenom} ${item.medecin_nom}
                        </td>
                        <td style="padding: 1rem;">
                            <span class="badge ${badgeClass}">${statusText}</span>
                        </td>
                        <td style="padding: 1rem; text-align: right;">
                            <button class="btn ${isTermine ? 'btn-secondary' : 'btn-primary'}" onclick="openModalResultat(${item.id}, '${item.patient_prenom} ${item.patient_nom}', '${item.examen_nom}', '${encodeURIComponent(item.resultat_texte || '')}')">
                                ${isTermine ? '✏️ Modifier' : '🧪 Saisir Résultat'}
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        } else {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="padding: 2rem; color: var(--text-muted);">Aucun examen en attente pour le moment.</td></tr>`;
        }
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger" style="padding: 2rem;">Erreur de chargement des examens.</td></tr>`;
    }
}

function openModalResultat(id, patientName, examenNom, existingTextEncoded) {
    document.getElementById('res-prescription-id').value = id;
    document.getElementById('res-patient-name').textContent = patientName;
    document.getElementById('res-examen-nom').textContent = examenNom;
    document.getElementById('res-texte').value = decodeURIComponent(existingTextEncoded || '');
    
    document.getElementById('modal-resultat').style.display = 'flex';
}
