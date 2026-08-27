/**
 * theme.js - Bascule clair / sombre haute fidélité & Gestion globale de l'affichage des mots de passe.
 * Sauvegarde le thème dans localStorage et synchronise l'ensemble des composants d'interface.
 */

(function () {
    'use strict';

    var STORAGE_KEY = 'hospira-theme';

    var SUN_ICON = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #fbbf24;"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
    var MOON_ICON = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #0284c7;"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';

    var EYE_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
    var EYE_OFF_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';

    function getSavedTheme() {
        try {
            return localStorage.getItem(STORAGE_KEY);
        } catch (e) {
            return null;
        }
    }

    function saveTheme(theme) {
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch (e) {
            /* ignore */
        }
    }

    function applyTheme(theme) {
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            document.body && document.body.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
            document.body && document.body.removeAttribute('data-theme');
        }
    }

    function updateToggleButtons(theme) {
        var isDark = theme === 'dark';
        var btns = document.querySelectorAll('#theme-toggle, .theme-toggle-btn, [data-theme-toggle]');
        btns.forEach(function (btn) {
            btn.innerHTML = isDark ? SUN_ICON : MOON_ICON;
            btn.setAttribute('title', isDark ? 'Passer au mode clair' : 'Passer au mode sombre');
            btn.setAttribute('aria-label', isDark ? 'Passer au mode clair' : 'Passer au mode sombre');
        });
    }

    function toggleTheme() {
        var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        var next = isDark ? 'light' : 'dark';
        applyTheme(next);
        saveTheme(next);
        updateToggleButtons(next);
    }

    window.toggleTheme = toggleTheme;

    // Gestion globale du clic sur les boutons de thème via délégation
    document.addEventListener('click', function (e) {
        var themeBtn = e.target.closest('#theme-toggle, .theme-toggle-btn, [data-theme-toggle]');
        if (themeBtn) {
            e.preventDefault();
            e.stopPropagation();
            toggleTheme();
            return;
        }

        // Gestion globale de l'affichage/masquage de mot de passe
        var pwdBtn = e.target.closest('.toggle-password-btn, [data-toggle-password]');
        if (pwdBtn) {
            e.preventDefault();
            var targetId = pwdBtn.getAttribute('data-target');
            var input = targetId ? document.getElementById(targetId) : (pwdBtn.parentElement ? pwdBtn.parentElement.querySelector('input') : null);
            if (input) {
                var isPassword = input.type === 'password';
                input.type = isPassword ? 'text' : 'password';
                pwdBtn.innerHTML = isPassword ? EYE_OFF_ICON : EYE_ICON;
                pwdBtn.setAttribute('title', isPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
                pwdBtn.setAttribute('aria-label', isPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
            }
        }
    });

    function init() {
        var saved = getSavedTheme();
        var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        var theme = saved ? (saved === 'dark' ? 'dark' : 'light') : (prefersDark ? 'dark' : 'light');
        applyTheme(theme);
        updateToggleButtons(theme);

        // Si la page n'a aucun bouton de thème dans son DOM, on ajoute un bouton discret et élégant
        var existingBtn = document.querySelector('#theme-toggle, .theme-toggle-btn, [data-theme-toggle]');
        if (!existingBtn && document.body) {
            var floatingBtn = document.createElement('button');
            floatingBtn.id = 'theme-toggle';
            floatingBtn.type = 'button';
            floatingBtn.className = 'theme-toggle-floating';
            floatingBtn.style.position = 'fixed';
            floatingBtn.style.bottom = '20px';
            floatingBtn.style.left = '20px';
            floatingBtn.style.zIndex = '9999';
            floatingBtn.style.width = '42px';
            floatingBtn.style.height = '42px';
            floatingBtn.style.borderRadius = '50%';
            floatingBtn.style.border = '1px solid var(--border-color)';
            floatingBtn.style.background = 'var(--bg-card)';
            floatingBtn.style.boxShadow = 'var(--shadow-md)';
            floatingBtn.style.cursor = 'pointer';
            floatingBtn.style.display = 'flex';
            floatingBtn.style.alignItems = 'center';
            floatingBtn.style.justifyContent = 'center';
            floatingBtn.style.transition = 'all var(--transition-fast)';
            document.body.appendChild(floatingBtn);
            updateToggleButtons(theme);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();


