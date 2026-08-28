/**
 * loginVM.js - ViewModel pour la page de connexion
 */

document.addEventListener('DOMContentLoaded', () => {
    // Si déjà authentifié, rediriger
    if (window.Auth && !Auth.requireGuest()) return;

    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('login-btn');
    const errorAlert = document.getElementById('error-alert');
    const togglePasswordBtn = document.getElementById('toggle-password');

    if (emailInput) emailInput.value = '';
    if (passwordInput) passwordInput.value = '';
    window.addEventListener('load', () => {
        setTimeout(() => {
            if (emailInput) emailInput.value = '';
            if (passwordInput) passwordInput.value = '';
        }, 100);
    });

    const eyeIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-eye"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
    const eyeOffIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-eye-off"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';

    if (togglePasswordBtn && passwordInput) {
        togglePasswordBtn.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            togglePasswordBtn.innerHTML = type === 'password' ? eyeIcon : eyeOffIcon;
        });
    }

    if (!loginForm) return;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        errorAlert.style.display = 'none';
        loginBtn.classList.add('btn-loading');
        loginBtn.disabled = true;

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        try {
            const response = await ApiClient.login(email, password);

            if (response.token) {
                Auth.setSession(response.token, response.user);

                if (response.user.must_change_password) {
                    window.location.href = 'motdepasse.html';
                    return;
                }

                const target = Auth.getRouteForRole(response.user.role);
                if (target === 'login.html') {
                    const msg = 'Rôle utilisateur inconnu : ' + escapeHtml(response.user.role);
                    if (typeof showToast === 'function') showToast(msg, 'danger');
                    else { errorAlert.textContent = msg; errorAlert.style.display = 'block'; }
                    Auth.clearSession();
                    return;
                }
                window.location.href = target;
            } else {
                throw new Error(response.message || 'Identifiants incorrects.');
            }
        } catch (error) {
            errorAlert.textContent = error.message;
            errorAlert.style.display = 'block';
        } finally {
            loginBtn.classList.remove('btn-loading');
            loginBtn.disabled = false;
        }
    });

    // --- Modal Register Patient ---
    const registerModal = document.getElementById('register-modal');
    const showRegisterModalBtn = document.getElementById('show-register-modal');
    const closeRegisterModalBtn = document.getElementById('close-register-modal');
    const registerForm = document.getElementById('register-form');
    const regError = document.getElementById('register-error');
    const regSuccess = document.getElementById('register-success');
    const btnRegister = document.getElementById('btn-register');

    const regImage = document.getElementById('reg-image');
    const imagePreview = document.getElementById('image-preview');

    if (regImage && imagePreview) {
        regImage.addEventListener('change', function() {
            const file = this.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    imagePreview.innerHTML = `<img src="${escapeHtml(e.target.result)}" style="width: 100%; height: 100%; object-fit: cover;">`;
                    imagePreview.style.border = 'none';
                };
                reader.readAsDataURL(file);
            } else {
                imagePreview.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>';
                imagePreview.style.border = '2px dashed var(--primary-color)';
            }
        });
    }

    if (showRegisterModalBtn && registerModal) {
        showRegisterModalBtn.addEventListener('click', (e) => {
            e.preventDefault();
            registerModal.style.display = 'flex';
            regError.style.display = 'none';
            regSuccess.style.display = 'none';
        });

        closeRegisterModalBtn.addEventListener('click', () => {
            registerModal.style.display = 'none';
        });

        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            regError.style.display = 'none';
            regSuccess.style.display = 'none';
            btnRegister.disabled = true;
            btnRegister.textContent = 'Inscription en cours...';

            const formData = new FormData();

            const password = document.getElementById('reg-password').value;
            const passwordConfirm = document.getElementById('reg-password-confirm').value;
            if (password !== passwordConfirm) {
                regError.textContent = 'Les mots de passe ne correspondent pas.';
                regError.style.display = 'block';
                btnRegister.disabled = false;
                btnRegister.textContent = 'Créer mon compte';
                return;
            }

            formData.append('nom', document.getElementById('reg-nom').value.trim());
            formData.append('prenom', document.getElementById('reg-prenom').value.trim());
            formData.append('date_naissance', document.getElementById('reg-dob').value);
            formData.append('sexe', document.getElementById('reg-sexe').value);
            formData.append('email', document.getElementById('reg-email').value.trim());
            formData.append('password', password);

            const imageFile = document.getElementById('reg-image').files[0];
            if (imageFile) {
                formData.append('profile_image', imageFile);
            }

            try {
                await ApiClient.register(formData);
                regSuccess.textContent = 'Compte créé avec succès ! Vous pouvez maintenant vous connecter.';
                regSuccess.style.display = 'block';
                registerForm.reset();
                if(imagePreview) {
                    imagePreview.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>';
                    imagePreview.style.border = '2px dashed var(--primary-color)';
                }

                setTimeout(() => {
                    registerModal.style.display = 'none';
                }, 2000);
            } catch (error) {
                regError.textContent = error.message || "Erreur lors de l'inscription.";
                regError.style.display = 'block';
            } finally {
                btnRegister.disabled = false;
                btnRegister.textContent = 'Créer mon compte';
            }
        });
    }
});
