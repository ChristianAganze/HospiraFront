/**
 * admin.js - Logique pour le tableau de bord Administrateur
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
    if (roleLower !== 'admin' && roleLower !== 'administrateur') {
        window.location.href = 'login.html'; 
        return;
    }

    // 2. Initialisation de l'interface (Topbar)
    document.getElementById('user-name-top').textContent = `${user.prenom} ${user.nom}`;
    document.getElementById('user-role-top').textContent = user.role;
    
    const topUserImg = document.getElementById('topbar-user-img');
    const topUserInitials = document.getElementById('topbar-user-initials');
    if (user.profile_image) {
        topUserImg.src = ApiClient.staticUrl(user.profile_image);
        topUserImg.style.display = 'block';
        topUserInitials.style.display = 'none';
    } else {
        topUserImg.style.display = 'none';
        topUserInitials.textContent = user.prenom.charAt(0).toUpperCase() + user.nom.charAt(0).toUpperCase();
        topUserInitials.style.display = 'flex';
        topUserInitials.style.alignItems = 'center';
        topUserInitials.style.justifyContent = 'center';
    }

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

    // 3. Navigation Sidebar
    const navDashboard = document.getElementById('nav-dashboard');
    const navStaff = document.getElementById('nav-staff');
    
    const viewDashboard = document.getElementById('view-dashboard-admin');
    const viewStaff = document.getElementById('view-staff');

    function switchView(activeNav, activeView) {
        // Reset navs
        [navDashboard, navStaff].forEach(nav => nav.classList.remove('active'));
        // Reset views
        [viewDashboard, viewStaff].forEach(view => view.style.display = 'none');
        
        // Set active
        activeNav.classList.add('active');
        activeView.style.display = 'block';

        if(window.innerWidth <= 768) {
             document.querySelector('.nav-menu').classList.remove('show');
        }
    }

    navDashboard.addEventListener('click', (e) => {
        e.preventDefault();
        switchView(navDashboard, viewDashboard);
        loadDashboardStats();
    });

    navStaff.addEventListener('click', (e) => {
        e.preventDefault();
        switchView(navStaff, viewStaff);
        loadStaff();
    });

    // 4. Charger Statistiques Dashboard
    function loadDashboardStats() {
        ApiClient.request('/api/stats', 'GET')
            .then(data => {
                if (data) {
                    document.getElementById('stat-patients').textContent = data.patients ?? 0;
                    document.getElementById('stat-consultations').textContent = data.consultations ?? 0;
                    document.getElementById('stat-rendezvous').textContent = data.rendezvous ?? 0;
                    const rev = data.revenus_jour ?? data.revenus ?? 0;
                    document.getElementById('stat-revenus').textContent = Number(rev).toLocaleString('fr-FR');
                }
            })
            .catch(error => {
                console.error("Erreur chargement statistiques:", error);
                ['stat-patients', 'stat-consultations', 'stat-rendezvous', 'stat-revenus'].forEach(id => {
                    document.getElementById(id).textContent = "Erreur";
                });
            });
    }

    // 5. Gestion du Personnel
    function loadStaff() {
        ApiClient.request('/api/staff', 'GET')
            .then(res => {
                const staff = (res && res.records) ? res.records : [];
                const tbody = document.getElementById('staff-table-body');
                tbody.innerHTML = '';
                
                if (!staff || staff.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding: 2rem;">Aucun membre du personnel enregistré.</td></tr>';
                    return;
                }

                staff.forEach(member => {
                    const date = new Date(member.created_at).toLocaleDateString('fr-FR');
                    const imgHtml = member.profile_image 
                        ? `<img src="${ApiClient.staticUrl(member.profile_image)}" style="width:30px; height:30px; border-radius:50%; object-fit:cover; vertical-align:middle; margin-right:8px;">`
                        : `<span style="display:inline-block; width:30px; height:30px; border-radius:50%; background:var(--primary-color); color:white; text-align:center; line-height:30px; font-weight:bold; font-size:0.8rem; margin-right:8px;">${(member.prenom || 'S').charAt(0).toUpperCase()}</span>`;

                    const specialiteHtml = (member.specialite || (member.is_assistant == 1 ? 'Assistant' : ''))
                        ? `<small style="color: var(--text-muted);">${member.specialite || ''}${member.is_assistant == 1 ? '<br>🩺 Assistant' : ''}</small>`
                        : '-';

                    const tr = document.createElement('tr');
                    tr.style.borderBottom = '1px solid rgba(0,0,0,0.05)';
                    tr.innerHTML = `
                        <td style="padding: 1rem 0.5rem; font-weight: 500;">${imgHtml} ${member.prenom} ${member.nom}</td>
                        <td style="padding: 1rem 0.5rem;"><span class="badge ${getRoleBadgeClass(member.role)}">${member.role}</span></td>
                        <td style="padding: 1rem 0.5rem;">${specialiteHtml}</td>
                        <td style="padding: 1rem 0.5rem; color: var(--text-muted);">${member.email}</td>
                        <td style="padding: 1rem 0.5rem; color: var(--text-muted);">${date}</td>
                        <td style="padding: 1rem 0.5rem; text-align: right;">
                            <button class="btn btn-secondary" onclick="deleteStaffMember(${member.id}, '${member.prenom} ${member.nom}')" style="padding:0.3rem 0.6rem; font-size:0.8rem; color:var(--danger-color); border-color:var(--danger-color);">🗑️ Supprimer</button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            })
            .catch(error => {
                console.error("Erreur personnel:", error);
                document.getElementById('staff-table-body').innerHTML = `<tr><td colspan="6" class="text-center text-danger">Erreur: ${error.message}</td></tr>`;
            });
    }

    window.deleteStaffMember = function(id, name) {
        if (!confirm(`Êtes-vous sûr de vouloir supprimer ${name} du personnel ?`)) return;

        ApiClient.request(`/api/staff/${id}`, 'DELETE')
            .then(() => {
                showToast("Membre du personnel supprimé.", "success");
                loadStaff();
            })
            .catch(err => {
                showToast("Erreur de suppression : " + err.message, "danger");
            });
    };

    function getRoleBadgeClass(role) {
        switch(role) {
            case 'Admin': return 'bg-danger';
            case 'Medecin': return 'bg-primary';
            case 'Secretaire': return 'bg-info';
            case 'Caissier': return 'bg-success';
            default: return 'bg-secondary';
        }
    }

    // Modal Nouveau Staff
    const modalStaff = document.getElementById('modal-staff');
    const btnAddStaff = document.getElementById('btn-add-staff');
    const btnCloseStaff = document.getElementById('close-modal-staff');
    const formStaff = document.getElementById('form-staff');
    const staffMessage = document.getElementById('staff-message');

    const specialiteGroup = document.getElementById('staff-specialite-group');
    const assistantGroup = document.getElementById('staff-assistant-group');
    const superviseurGroup = document.getElementById('staff-superviseur-group');
    const roleSelect = document.getElementById('staff-role');
    const assistantCheck = document.getElementById('staff-assistant');

    // Charger les médecins pour le select "assiste le médecin"
    function loadSuperviseurOptions(selectedId) {
        const select = document.getElementById('staff-superviseur');
        ApiClient.request('/api/users/staff', 'GET')
            .then(staff => {
                const medecins = staff.filter(s => s.role === 'Medecin' && !(s.is_assistant == 1));
                select.innerHTML = '<option value="">Sélectionnez le médecin</option>';
                medecins.forEach(m => {
                    const label = `Dr. ${m.prenom} ${m.nom}` + (m.specialite ? ` — ${m.specialite}` : '');
                    select.innerHTML += `<option value="${m.id}"${String(m.id) === String(selectedId) ? ' selected' : ''}>${label}</option>`;
                });
            })
            .catch(() => {});
    }

    function updateStaffFieldsVisibility() {
        const isMedecin = roleSelect.value === 'Medecin';
        specialiteGroup.style.display = isMedecin ? 'block' : 'none';
        assistantGroup.style.display = isMedecin ? 'block' : 'none';
        superviseurGroup.style.display = (isMedecin && assistantCheck.checked) ? 'block' : 'none';
        if (!isMedecin) assistantCheck.checked = false;
    }

    roleSelect.addEventListener('change', updateStaffFieldsVisibility);
    assistantCheck.addEventListener('change', updateStaffFieldsVisibility);

    btnAddStaff.addEventListener('click', () => {
        modalStaff.style.display = 'flex';
        staffMessage.style.display = 'none';
        formStaff.reset();
        loadSuperviseurOptions(null);
        updateStaffFieldsVisibility();
    });

    btnCloseStaff.addEventListener('click', () => modalStaff.style.display = 'none');
    window.addEventListener('click', (e) => {
        if(e.target === modalStaff) modalStaff.style.display = 'none';
    });

    formStaff.addEventListener('submit', async (e) => {
        e.preventDefault();
        staffMessage.style.display = 'none';
        
        const btnSave = document.getElementById('btn-save-staff');
        btnSave.disabled = true;
        btnSave.textContent = "Création...";

        const staffData = new FormData();
        staffData.append('nom', document.getElementById('staff-nom').value.trim());
        staffData.append('prenom', document.getElementById('staff-prenom').value.trim());
        staffData.append('email', document.getElementById('staff-email').value.trim());
        staffData.append('role', document.getElementById('staff-role').value);
        staffData.append('password', document.getElementById('staff-password').value);

        if (roleSelect.value === 'Medecin') {
            staffData.append('specialite', document.getElementById('staff-specialite').value.trim() || '');
            if (assistantCheck.checked) {
                staffData.append('is_assistant', '1');
                staffData.append('superviseur_id', document.getElementById('staff-superviseur').value || '');
            }
        }
        
        const imgFile = document.getElementById('staff-image').files[0];
        if (imgFile) {
            staffData.append('profile_image', imgFile);
        }

        try {
            await ApiClient.request('/api/users/staff', 'POST', staffData);
            modalStaff.style.display = 'none';
            loadStaff();
            showToast("Membre du personnel ajouté avec succès !", "success");
        } catch (error) {
            staffMessage.textContent = error.message || "Erreur lors de la création.";
            staffMessage.className = "error-message";
            staffMessage.style.display = 'block';
        } finally {
            btnSave.disabled = false;
            btnSave.textContent = "Créer le compte";
        }
    });

    // 6. Init
    loadDashboardStats();

    // Système de Toast
    function showToast(message, type = "success") {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()" style="background:none; border:none; color:white; cursor:pointer;">&times;</button>
        `;
        
        container.appendChild(toast);
        
        // Force reflow pour l'animation
        toast.offsetHeight;
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(100%)';
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }
});
