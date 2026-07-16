/**
 * staffVM.js - ViewModel pour la gestion du personnel
 */

document.addEventListener('DOMContentLoaded', () => {
    const navStaff = document.getElementById('nav-staff');
    const viewStaff = document.getElementById('view-staff');
    const staffTableBody = document.getElementById('staff-table-body');
    const btnAddStaff = document.getElementById('btn-add-staff');
    
    const modalStaff = document.getElementById('modal-staff');
    const closeStaffBtn = document.getElementById('close-modal-staff');
    const formStaff = document.getElementById('form-staff');
    const staffMessage = document.getElementById('staff-message');

    // N'afficher le menu Personnel que pour les Admins
    const userDataStr = localStorage.getItem('hospira_user');
    if (userDataStr) {
        const user = JSON.parse(userDataStr);
        if (user.role === 'Admin') {
            document.getElementById('menu-staff').style.display = 'block';
        }
    }

    if (navStaff) {
        navStaff.addEventListener('click', (e) => {
            e.preventDefault();
            // Masquer les autres vues (réutiliser la logique de app.js)
            document.querySelectorAll('.content-area > div').forEach(div => div.style.display = 'none');
            document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
            
            navStaff.classList.add('active');
            viewStaff.style.display = 'block';
            document.getElementById('page-title').textContent = 'Gestion du Personnel';
            document.getElementById('btn-add-patient').style.display = 'none';

            loadStaff();
        });
    }

    async function loadStaff() {
        staffTableBody.innerHTML = '<tr><td colspan="4" class="text-center" style="padding: 2rem;">Chargement...</td></tr>';
        try {
            const data = await ApiClient.getStaff();
            if (data.records && data.records.length > 0) {
                staffTableBody.innerHTML = data.records.map(staff => `
                    <tr>
                        <td style="padding: 1rem 0.5rem; display: flex; align-items: center; gap: 10px;">
                            ${staff.profile_image 
                                ? `<img src="http://localhost/Hospira/HospiraBackend/public/${staff.profile_image}" style="width:30px; height:30px; border-radius:50%; object-fit:cover;">` 
                                : `<div style="width:30px; height:30px; border-radius:50%; background:var(--primary-color); color:white; display:flex; align-items:center; justify-content:center; font-size:12px;">${staff.prenom.charAt(0)}${staff.nom.charAt(0)}</div>`
                            }
                            <strong>${staff.prenom} ${staff.nom}</strong>
                        </td>
                        <td style="padding: 1rem 0.5rem;"><span class="badge badge-info">${staff.role}</span></td>
                        <td style="padding: 1rem 0.5rem;">${staff.email}</td>
                        <td style="padding: 1rem 0.5rem;">${staff.created_at.substring(0, 10)}</td>
                    </tr>
                `).join('');
            } else {
                staffTableBody.innerHTML = '<tr><td colspan="4" class="text-center" style="padding: 2rem;">Aucun membre du personnel trouvé.</td></tr>';
            }
        } catch (error) {
            staffTableBody.innerHTML = `<tr><td colspan="4" class="text-center text-danger" style="padding: 2rem;">Erreur: ${error.message}</td></tr>`;
        }
    }

    // Modal Nouveau Staff
    if (btnAddStaff && modalStaff) {
        btnAddStaff.addEventListener('click', () => {
            modalStaff.style.display = 'flex';
            staffMessage.style.display = 'none';
        });

        closeStaffBtn.addEventListener('click', () => {
            modalStaff.style.display = 'none';
        });

        formStaff.addEventListener('submit', async (e) => {
            e.preventDefault();
            staffMessage.style.display = 'none';
            const btn = document.getElementById('btn-save-staff');
            btn.disabled = true;

            const staffData = {
                nom: document.getElementById('staff-nom').value.trim(),
                prenom: document.getElementById('staff-prenom').value.trim(),
                email: document.getElementById('staff-email').value.trim(),
                role: document.getElementById('staff-role').value,
                password: document.getElementById('staff-password').value
            };

            try {
                await ApiClient.createStaff(staffData);
                formStaff.reset();
                modalStaff.style.display = 'none';
                loadStaff(); // Recharger la liste
            } catch (error) {
                staffMessage.textContent = error.message;
                staffMessage.style.display = 'block';
                staffMessage.style.color = 'var(--danger-color)';
                staffMessage.style.backgroundColor = 'rgba(var(--danger-color-rgb), 0.1)';
            } finally {
                btn.disabled = false;
            }
        });
    }

    // Modal Profil
    const modalProfile = document.getElementById('modal-profile');
    const closeProfileBtn = document.getElementById('close-modal-profile');
    const formProfile = document.getElementById('form-profile');
    const profileMessage = document.getElementById('profile-message');

    window.addEventListener('openProfileModal', () => {
        if(modalProfile) {
            modalProfile.style.display = 'flex';
            profileMessage.style.display = 'none';
            formProfile.reset();
        }
    });

    if (closeProfileBtn) {
        closeProfileBtn.addEventListener('click', () => {
            modalProfile.style.display = 'none';
        });
    }

    if (formProfile) {
        formProfile.addEventListener('submit', async (e) => {
            e.preventDefault();
            profileMessage.style.display = 'none';
            const btn = document.getElementById('btn-change-pwd');
            btn.disabled = true;

            const oldPwd = document.getElementById('profile-old-pwd').value;
            const newPwd = document.getElementById('profile-new-pwd').value;

            try {
                const response = await ApiClient.changePassword(oldPwd, newPwd);
                profileMessage.textContent = "Mot de passe mis à jour avec succès.";
                profileMessage.style.display = 'block';
                profileMessage.style.color = 'var(--success-color)';
                profileMessage.style.backgroundColor = 'rgba(0,184,148,0.1)';
                profileMessage.style.borderColor = 'var(--success-color)';
                formProfile.reset();
                setTimeout(() => { modalProfile.style.display = 'none'; }, 2000);
            } catch (error) {
                profileMessage.textContent = error.message;
                profileMessage.style.display = 'block';
                profileMessage.style.color = 'var(--danger-color)';
                profileMessage.style.backgroundColor = 'rgba(214,48,49,0.1)';
                profileMessage.style.borderColor = 'var(--danger-color)';
            } finally {
                btn.disabled = false;
            }
        });
    }
});
