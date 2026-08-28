/**
 * laborantin.js - Gestion du tableau de bord Laboratoire
 */

document.addEventListener('DOMContentLoaded', () => {
    const user = Auth.requireAuth(['Laborantin', 'Admin']);
    if (!user) return;

    document.getElementById('user-name-top').textContent = `${user.prenom} ${user.nom}`;
    document.getElementById('user-role-top').textContent = user.role;
    const topUserInitials = document.getElementById('topbar-user-initials');
    if (topUserInitials) topUserInitials.textContent = (user.prenom.charAt(0) + user.nom.charAt(0)).toUpperCase();

    const userMenu = document.getElementById('topbar-user-menu');
    const userDropdown = document.getElementById('user-dropdown');
    if (userMenu && userDropdown) {
        userMenu.addEventListener('click', (e) => {
            userDropdown.style.display = userDropdown.style.display === 'none' ? 'block' : 'none';
            e.stopPropagation();
        });
        window.addEventListener('click', () => { userDropdown.style.display = 'none'; });
    }

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) btnLogout.addEventListener('click', () => Auth.logout());

    const btnProfil = document.getElementById('btn-profil');
    const modalProfile = document.getElementById('modal-profile');
    const closeModalProfile = document.getElementById('close-modal-profile');
    if (btnProfil && modalProfile) {
        btnProfil.addEventListener('click', (e) => {
            e.preventDefault();
            modalProfile.style.display = 'flex';
        });
    }
    if (closeModalProfile && modalProfile) {
        closeModalProfile.addEventListener('click', () => { modalProfile.style.display = 'none'; });
    }

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

    loadLaboQueue();

    const modalResultat = document.getElementById('modal-resultat');
    const closeModalResultat = document.getElementById('close-modal-resultat');
    if (closeModalResultat) {
        closeModalResultat.addEventListener('click', () => { modalResultat.style.display = 'none'; });
    }

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
            if (fileInput.files.length > 0) formData.append('fichier', fileInput.files[0]);
            try {
                await ApiClient.request('/resultats-examens', 'POST', formData, true);
                showToast("Résultat d'examen enregistré et publié avec succès !", "success");
                modalResultat.style.display = 'none';
                formResultat.reset();
                loadLaboQueue();
            } catch (err) {
                showToast("Erreur lors de l'enregistrement : " + err.message, "danger");
            }
        });
    }
});

async function loadLaboQueue() {
    const tbody = document.getElementById('table-labo-queue');
    if (!tbody) return;
    try {
        const response = await ApiClient.request('/labo/queue', 'GET');
        if (response && response.queue && response.queue.length > 0) {
            tbody.innerHTML = '';
            response.queue.forEach(item => {
                const isTermine = item.statut_examen === 'Termine';
                const badgeClass = isTermine ? 'badge-success' : 'badge-warning';
                const statusText = isTermine ? 'Résultat Publié' : 'En Attente';
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid rgba(0,0,0,0.05)';
                tr.innerHTML = `
                    <td style="padding: 1rem; font-weight: bold; color: var(--primary-color);"><span style="background: rgba(37, 99, 235, 0.1); padding: 4px 10px; border-radius: var(--radius-pill);">${escapeHtml(item.ticket_labo || 'LAB-000')}</span></td>
                    <td style="padding: 1rem;"><strong>${escapeHtml(item.patient_prenom)} ${escapeHtml(item.patient_nom)}</strong><br><small style="color: var(--text-muted);">${item.sexe === 'M' ? 'Homme' : 'Femme'} - ${escapeHtml(item.age || '?')} ans</small></td>
                    <td style="padding: 1rem;"><strong>${escapeHtml(item.examen_nom)}</strong><br><small style="color: var(--text-muted);">${escapeHtml(item.examen_desc || '')}</small></td>
                    <td style="padding: 1rem;">Dr. ${escapeHtml(item.medecin_prenom)} ${escapeHtml(item.medecin_nom)}</td>
                    <td style="padding: 1rem;"><span class="badge ${badgeClass}">${statusText}</span></td>
                    <td style="padding: 1rem; text-align: right;"><button class="btn ${isTermine ? 'btn-secondary' : 'btn-primary'}">${isTermine ? 'Modifier' : 'Saisir Résultat'}</button></td>
                `;
                tr.querySelector('button').addEventListener('click', () => openModalResultat(item.id, `${item.patient_prenom} ${item.patient_nom}`, item.examen_nom, item.resultat_texte || ''));
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="padding: 2rem; color: var(--text-muted);">Aucun examen en attente pour le moment.</td></tr>`;
        }
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger" style="padding: 2rem;">Erreur de chargement des examens.</td></tr>`;
    }
}

function openModalResultat(id, patientName, examenNom, existingText) {
    document.getElementById('res-prescription-id').value = id;
    document.getElementById('res-patient-name').textContent = patientName;
    document.getElementById('res-examen-nom').textContent = examenNom;
    document.getElementById('res-texte').value = existingText || '';
    document.getElementById('modal-resultat').style.display = 'flex';
}
window.openModalResultat = openModalResultat;
