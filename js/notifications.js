/**
 * notifications.js - Cloche de notifications partagée par tous les tableaux de bord.
 *
 * - Injecte automatiquement la cloche dans la topbar.
 * - Interroge /notifications toutes les 20 s pour les alertes non lues.
 * - Affiche un toast une seule fois par nouvelle notification.
 * - Ouvre un panneau d'historique (/notifications/all) et marque les alertes
 *   comme lues à l'ouverture du panneau (ou via "Tout marquer lu").
 * - Émet l'événement `hospira:notification` pour que chaque page rafraîchisse
 *   ses propres listes.
 */
(function () {
    'use strict';

    var POLL_INTERVAL = 20000;
    var initialized = false;
    var firstPoll = true;
    var panelOpen = false;
    var seenIds = Object.create(null);
    var pollTimer = null;

    var bellBtn = null;
    var badgeEl = null;
    var panelEl = null;
    var listEl = null;
    var emptyEl = null;
    var markAllBtn = null;

    function isAuthenticated() {
        try {
            return !!(window.Auth && typeof Auth.isAuthenticated === 'function' && Auth.isAuthenticated());
        } catch (_e) {
            return false;
        }
    }

    function safeEscape(value) {
        if (typeof window.escapeHtml === 'function') return window.escapeHtml(value);
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function normalizeList(payload) {
        if (!payload) return [];
        if (Array.isArray(payload)) return payload;
        if (Array.isArray(payload.notifications)) return payload.notifications;
        if (Array.isArray(payload.data)) return payload.data;
        if (payload.data && Array.isArray(payload.data.notifications)) return payload.data.notifications;
        if (payload.data && Array.isArray(payload.data.data)) return payload.data.data;
        return [];
    }

    function formatDate(value) {
        if (!value) return '';
        var date = new Date(String(value).replace(' ', 'T'));
        if (isNaN(date.getTime())) return String(value);
        try {
            return date.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
        } catch (_e) {
            return date.toLocaleString('fr-FR');
        }
    }

    function showToast(message, type, duration) {
        if (typeof window.showToast === 'function') {
            window.showToast(message, type || 'info', duration || 6000);
        }
    }

    function injectBell() {
        var topbar = document.querySelector('.topbar');
        if (!topbar || document.getElementById('notification-bell')) return false;

        var wrap = document.createElement('div');
        wrap.className = 'notification-bell-wrap';
        wrap.innerHTML =
            '<button type="button" id="notification-bell" class="notification-bell" aria-label="Notifications" aria-haspopup="true" aria-expanded="false" title="Notifications">' +
                '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                    '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>' +
                    '<path d="M13.73 21a2 2 0 0 1-3.46 0"></path>' +
                '</svg>' +
                '<span class="notification-badge" id="notification-badge" hidden>0</span>' +
            '</button>' +
            '<div class="notification-panel" id="notification-panel" hidden>' +
                '<div class="notification-panel-header">' +
                    '<h4>Notifications</h4>' +
                    '<button type="button" class="notification-mark-all" id="notification-mark-all">Tout marquer lu</button>' +
                '</div>' +
                '<div class="notification-list" id="notification-list"></div>' +
                '<div class="notification-empty" id="notification-empty">Aucune notification pour le moment.</div>' +
            '</div>';

        // Placer la cloche dans le groupe de droite de la topbar, juste avant
        // le bouton de thème, pour rester cohérent sur toutes les pages.
        var themeBtn = topbar.querySelector('#theme-toggle, .theme-toggle-btn, [data-theme-toggle]');
        if (themeBtn && themeBtn.parentElement && themeBtn.parentElement !== topbar) {
            themeBtn.parentElement.insertBefore(wrap, themeBtn);
        } else {
            topbar.appendChild(wrap);
        }

        bellBtn = document.getElementById('notification-bell');
        badgeEl = document.getElementById('notification-badge');
        panelEl = document.getElementById('notification-panel');
        listEl = document.getElementById('notification-list');
        emptyEl = document.getElementById('notification-empty');
        markAllBtn = document.getElementById('notification-mark-all');

        bellBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            togglePanel();
        });

        markAllBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            markAllRead(false);
        });

        document.addEventListener('click', function (e) {
            if (!panelOpen) return;
            if (wrap.contains(e.target)) return;
            togglePanel(false);
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && panelOpen) togglePanel(false);
        });

        return true;
    }

    function updateBadge(count) {
        var value = Math.max(0, Number(count) || 0);
        if (badgeEl) {
            badgeEl.textContent = value > 99 ? '99+' : String(value);
            badgeEl.hidden = value <= 0;
        }
        if (bellBtn) bellBtn.classList.toggle('has-unread', value > 0);
    }

    function renderHistory(items) {
        if (!listEl || !emptyEl) return;

        if (!items.length) {
            listEl.innerHTML = '';
            emptyEl.hidden = false;
            return;
        }

        emptyEl.hidden = true;
        listEl.innerHTML = items.map(function (notif) {
            var unread = Number(notif.is_read) === 0;
            return '<div class="notification-item' + (unread ? ' is-unread' : '') + '">' +
                '<span class="notification-item-dot" aria-hidden="true"></span>' +
                '<div class="notification-item-body">' +
                    '<p>' + safeEscape(notif.message) + '</p>' +
                    '<time datetime="' + safeEscape(notif.created_at || '') + '">' + safeEscape(formatDate(notif.created_at)) + '</time>' +
                '</div>' +
            '</div>';
        }).join('');
    }

    async function loadHistory() {
        if (!listEl) return;
        listEl.innerHTML = '<div class="notification-loading">Chargement des notifications…</div>';
        try {
            var data = await ApiClient.request('/notifications/all', 'GET');
            var items = normalizeList(data);
            renderHistory(items);
            var unread = (data && typeof data.unread_count === 'number')
                ? data.unread_count
                : items.filter(function (n) { return Number(n.is_read) === 0; }).length;
            updateBadge(unread);
        } catch (_e) {
            listEl.innerHTML = '<div class="notification-error">Impossible de charger les notifications.</div>';
            if (emptyEl) emptyEl.hidden = true;
        }
    }

    async function markAllRead(silent) {
        try {
            await ApiClient.request('/notifications/read-all', 'POST');
            updateBadge(0);
            if (listEl) {
                Array.prototype.forEach.call(listEl.querySelectorAll('.notification-item.is-unread'), function (el) {
                    el.classList.remove('is-unread');
                });
            }
            if (!silent) showToast('Toutes les notifications ont été marquées comme lues.', 'success');
        } catch (_e) {
            if (!silent) showToast('Impossible de marquer les notifications comme lues.', 'danger');
        }
    }

    function togglePanel(force) {
        if (!panelEl || !bellBtn) return;
        var open = (typeof force === 'boolean') ? force : !panelOpen;
        panelOpen = open;
        panelEl.hidden = !open;
        bellBtn.setAttribute('aria-expanded', open ? 'true' : 'false');

        if (open) {
            // L'historique est chargé puis les alertes sont marquées lues :
            // elles restent visibles dans l'historique, mais ne réapparaissent
            // plus en toast au prochain chargement de page.
            loadHistory().then(function () { return markAllRead(true); });
        }
    }

    async function poll() {
        if (!isAuthenticated()) return;
        try {
            var data = await ApiClient.request('/notifications', 'GET');
            var items = normalizeList(data);
            var newOnes = [];

            items.forEach(function (notif) {
                var id = String(notif.id);
                if (!seenIds[id]) {
                    seenIds[id] = true;
                    newOnes.push(notif);
                }
            });

            updateBadge(items.length);

            if (!firstPoll && newOnes.length > 0) {
                newOnes.forEach(function (notif) {
                    showToast(notif.message, 'info', 6000);
                });
                document.dispatchEvent(new CustomEvent('hospira:notification', {
                    detail: { notifications: newOnes }
                }));
            }

            firstPoll = false;

            if (panelOpen) loadHistory();
        } catch (_e) {
            // Silencieux : une API momentanément indisponible ne doit pas
            // polluer l'interface avec des erreurs répétées.
        }
    }

    function init() {
        if (initialized) return;
        if (!isAuthenticated()) return;
        if (!document.querySelector('.topbar')) return;
        if (!injectBell()) return;

        initialized = true;

        // Laisser les scripts de la page s'initialiser avant le premier appel.
        setTimeout(poll, 1200);
        pollTimer = setInterval(poll, POLL_INTERVAL);

        window.addEventListener('focus', function () {
            if (isAuthenticated()) poll();
        });

        document.addEventListener('visibilitychange', function () {
            if (!document.hidden && isAuthenticated()) poll();
        });
    }

    window.HospiraNotifications = {
        refresh: poll,
        open: function () { togglePanel(true); },
        close: function () { togglePanel(false); },
        markAllRead: function () { return markAllRead(false); }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
