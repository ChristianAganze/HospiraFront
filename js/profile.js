document.addEventListener('DOMContentLoaded', () => {
    // Fonction globale pour mettre à jour l'affichage de l'image de profil
    window.updateProfileDisplay = function() {
        const userStr = localStorage.getItem('hospira_user');
        if (!userStr) return;
        const user = JSON.parse(userStr);
        const imgEl = document.getElementById('topbar-user-img');
        const initEl = document.getElementById('topbar-user-initials');
        
        const modalImg = document.getElementById('profile-avatar-preview-img');
        const modalInit = document.getElementById('profile-avatar-preview-initials');
        const modalName = document.getElementById('profile-user-fullname');
        const modalRole = document.getElementById('profile-user-role-badge');

        const letter = (user.prenom || user.nom || 'U').charAt(0).toUpperCase();

        if (user.profile_image) {
            const fullUrl = ApiClient.staticUrl(user.profile_image);
            if (imgEl) { imgEl.src = fullUrl; imgEl.style.display = 'block'; }
            if (initEl) { initEl.style.display = 'none'; }
            if (modalImg) { modalImg.src = fullUrl; modalImg.style.display = 'block'; }
            if (modalInit) { modalInit.style.display = 'none'; }
        } else {
            if (imgEl) { imgEl.style.display = 'none'; }
            if (initEl) { initEl.textContent = letter; initEl.style.display = 'flex'; }
            if (modalImg) { modalImg.style.display = 'none'; }
            if (modalInit) { modalInit.textContent = letter; modalInit.style.display = 'flex'; }
        }

        if (modalName) modalName.textContent = `${user.prenom || ''} ${user.nom || ''}`;
        if (modalRole) modalRole.textContent = user.role || 'Utilisateur';
    };

    // Appeler au chargement
    updateProfileDisplay();

    const formProfile = document.getElementById('form-profile');
    if(formProfile) {
        formProfile.addEventListener('submit', async (e) => {
            e.preventDefault();
            const msgDiv = document.getElementById('profile-message');
            msgDiv.style.display = 'none';

            const oldPwd = document.getElementById('profile-old-pwd').value;
            const newPwd = document.getElementById('profile-new-pwd').value;
            const imgFile = document.getElementById('profile-image-update').files[0];

            if (!oldPwd && !newPwd && !imgFile) {
                msgDiv.style.display = 'block';
                msgDiv.style.color = 'var(--text-muted)';
                msgDiv.textContent = 'Veuillez sélectionner une nouvelle photo ou saisir vos mots de passe.';
                return;
            }

            if ((oldPwd && !newPwd) || (!oldPwd && newPwd)) {
                msgDiv.style.display = 'block';
                msgDiv.style.color = 'var(--danger-color)';
                msgDiv.textContent = 'Pour changer de mot de passe, veuillez remplir l\'ancien ET le nouveau mot de passe.';
                return;
            }

            const formData = new FormData();
            if (oldPwd && newPwd) {
                formData.append('old_password', oldPwd);
                formData.append('new_password', newPwd);
            }
            if (imgFile) {
                formData.append('profile_image', imgFile);
            }

            const btn = document.getElementById('btn-update-profile');
            btn.disabled = true;
            btn.textContent = 'Enregistrement en cours...';

            try {
                const res = await ApiClient.updateProfile(formData);
                msgDiv.style.display = 'block';
                msgDiv.style.color = 'var(--success-color)';

                if (imgFile && oldPwd && newPwd) {
                    msgDiv.textContent = '🎉 Votre photo de profil et votre mot de passe ont été mis à jour avec succès !';
                } else if (imgFile) {
                    msgDiv.textContent = '📷 Votre photo de profil a été mise à jour avec succès !';
                } else {
                    msgDiv.textContent = '🔒 Votre mot de passe a été modifié avec succès !';
                }
                
                // Mettre à jour l'image en local
                if (res.profile_image) {
                    const user = JSON.parse(localStorage.getItem('hospira_user'));
                    user.profile_image = res.profile_image;
                    localStorage.setItem('hospira_user', JSON.stringify(user));
                    updateProfileDisplay();
                }

                formProfile.reset();
            } catch (err) {
                msgDiv.style.display = 'block';
                msgDiv.style.color = 'var(--danger-color)';
                if (err.message && err.message.includes('Ancien mot de passe incorrect')) {
                    msgDiv.textContent = '❌ L\'ancien mot de passe saisi est incorrect. Veuillez réessayer.';
                } else {
                    msgDiv.textContent = '❌ ' + (err.message || 'Une erreur est survenue lors de la mise à jour.');
                }
            } finally {
                btn.disabled = false;
                btn.textContent = 'Enregistrer les modifications';
            }
        });
    }
});
