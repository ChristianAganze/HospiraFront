/**
 * theme.js - Bascule clair / sombre pour Hospira.
 * Le choix est sauvegardé dans localStorage et appliqué dès le chargement.
 */

(function () {
    'use strict';

    var STORAGE_KEY = 'hospira-theme';

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
            /* stockage indisponible : on ignore */
        }
    }

    function applyTheme(theme) {
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
    }

    function toggleTheme() {
        var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        var next = isDark ? 'light' : 'dark';
        applyTheme(next);
        saveTheme(next);
        updateToggleButton(next);
    }

    function updateToggleButton(theme) {
        var btn = document.getElementById('theme-toggle');
        if (!btn) return;
        if (theme === 'dark') {
            btn.innerHTML = '☀️';
            btn.setAttribute('title', 'Activer le mode clair');
        } else {
            btn.innerHTML = '🌙';
            btn.setAttribute('title', 'Activer le mode sombre');
        }
    }

    function init() {
        var saved = getSavedTheme();
        var theme = saved === 'dark' ? 'dark' : 'light';
        applyTheme(theme);

        var btn = document.createElement('button');
        btn.id = 'theme-toggle';
        btn.type = 'button';
        btn.setAttribute('aria-label', 'Changer de thème');
        btn.style.position = 'fixed';
        btn.style.bottom = '20px';
        btn.style.left = '20px';
        btn.style.zIndex = '9999';
        btn.style.width = '42px';
        btn.style.height = '42px';
        btn.style.borderRadius = '50%';
        btn.style.border = '1px solid var(--secondary-color)';
        btn.style.background = 'var(--bg-card)';
        btn.style.boxShadow = 'var(--shadow-md)';
        btn.style.cursor = 'pointer';
        btn.style.fontSize = '1.2rem';
        btn.style.display = 'flex';
        btn.style.alignItems = 'center';
        btn.style.justifyContent = 'center';
        btn.style.lineHeight = '1';
        btn.addEventListener('click', toggleTheme);
        document.body.appendChild(btn);

        updateToggleButton(theme);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
