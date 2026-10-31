/**
 * admin.js - Logique pour le tableau de bord Administrateur
 */

document.addEventListener('DOMContentLoaded', () => {
    const user = Auth.requireAuth(['Admin']);
    if (!user) return;

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

    document.getElementById('btn-logout').addEventListener('click', () => Auth.logout());
    document.getElementById('btn-profil').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('modal-profile').style.display = 'flex';
    });
    document.getElementById('close-modal-profile').addEventListener('click', () => {
        document.getElementById('modal-profile').style.display = 'none';
    });

    // Mobile Sidebar Toggle
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
    if (backdrop) {
        backdrop.addEventListener('click', closeSidebar);
    }

    // 3. Navigation Sidebar
    const navDashboard = document.getElementById('nav-dashboard');
    const navStaff = document.getElementById('nav-staff');
    const navMessages = document.getElementById('nav-messages');

    const viewDashboard = document.getElementById('view-dashboard-admin');
    const viewStaff = document.getElementById('view-staff');
    const viewMessages = document.getElementById('view-messages');

    function switchView(activeNav, activeView) {
        [navDashboard, navStaff, navMessages].forEach(nav => nav.classList.remove('active'));
        [viewDashboard, viewStaff, viewMessages].forEach(view => view.style.display = 'none');
        activeNav.classList.add('active');
        activeView.style.display = 'block';
        if(window.innerWidth <= 768) closeSidebar();
    }

    navDashboard.addEventListener('click', (e) => {
        e.preventDefault();
        switchView(navDashboard, viewDashboard);
        loadDashboardStats();
        loadChartStats(currentPeriod);
    });
    navStaff.addEventListener('click', (e) => {
        e.preventDefault();
        switchView(navStaff, viewStaff);
        loadStaff();
    });
    navMessages.addEventListener('click', (e) => {
        e.preventDefault();
        switchView(navMessages, viewMessages);
        loadMessages();
    });

    // 4. Charger Statistiques Dashboard
    function loadDashboardStats() {
        ApiClient.request('/stats', 'GET')
            .then(data => {
                if (data) {
                    document.getElementById('stat-patients').textContent = data.patients ?? 0;
                    document.getElementById('stat-consultations').textContent = data.consultations ?? 0;
                    document.getElementById('stat-rendezvous').textContent = data.rendezvous ?? 0;
                    const rev = data.revenus_jour ?? data.revenus ?? 0;
                    document.getElementById('stat-revenus').textContent = Number(rev).toLocaleString('fr-FR');
                }
            })
            .catch(() => {
                ['stat-patients', 'stat-consultations', 'stat-rendezvous', 'stat-revenus'].forEach(id => {
                    document.getElementById(id).textContent = "Erreur";
                });
            });
    }

    // 4.b Graphiques d'analyse (Chart.js)
    const chartsStatus = document.getElementById('charts-status');
    const periodSelect = document.getElementById('charts-period');
    const chartInstances = {};
    const CHART_CANVASES = [
        'chart-activite',
        'chart-revenus',
        'chart-rdv-statuts',
        'chart-examens-statuts',
        'chart-top-medecins',
        'chart-paiements-methodes'
    ];

    let chartsData = null;
    let currentPeriod = Number(periodSelect && periodSelect.value) || 14;
    let chartRequestId = 0;

    const nfFC = new Intl.NumberFormat('fr-FR');
    const nfCompact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });

    function cssVar(name, fallback) {
        const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        return value || fallback;
    }

    function withAlpha(color, alpha) {
        const value = String(color || '').trim();
        const match = /^#([0-9a-f]{6})$/i.exec(value);
        if (!match) return value;
        const int = parseInt(match[1], 16);
        return `rgba(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}, ${alpha})`;
    }

    function chartPalette() {
        return {
            primary: cssVar('--primary-color', '#0d4848'),
            secondary: cssVar('--secondary-color', '#1e6b68'),
            success: cssVar('--success-color', '#059669'),
            warning: cssVar('--warning-color', '#d97706'),
            danger: cssVar('--danger-color', '#dc2626'),
            info: cssVar('--info-color', '#0284c7'),
            text: cssVar('--text-main', '#0f172a'),
            muted: cssVar('--text-muted', '#64748b'),
            grid: cssVar('--border-color', '#e2e8f0'),
            card: cssVar('--bg-card', '#ffffff')
        };
    }

    function formatDayLabel(iso) {
        const date = new Date(String(iso) + 'T00:00:00');
        if (isNaN(date.getTime())) return String(iso);
        return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
    }

    function tooltipStyle(palette) {
        return {
            backgroundColor: palette.card,
            titleColor: palette.text,
            bodyColor: palette.muted,
            borderColor: palette.grid,
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8,
            boxPadding: 4,
            titleFont: { weight: '600' }
        };
    }

    function cartesianOptions(palette, opts = {}) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    display: opts.legend !== false,
                    position: 'top',
                    align: 'end',
                    labels: {
                        color: palette.muted,
                        usePointStyle: true,
                        pointStyle: 'circle',
                        boxWidth: 8,
                        boxHeight: 8,
                        padding: 14,
                        font: { size: 11 }
                    }
                },
                tooltip: tooltipStyle(palette)
            },
            scales: {
                x: {
                    grid: { display: false },
                    border: { color: palette.grid },
                    ticks: {
                        color: palette.muted,
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: opts.maxTicks || 8,
                        font: { size: 11 }
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: palette.grid },
                    border: { display: false },
                    ticks: {
                        color: palette.muted,
                        precision: opts.integer ? 0 : undefined,
                        callback: opts.yTick || undefined,
                        font: { size: 11 }
                    }
                }
            }
        };
    }

    function doughnutOptions(palette) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '62%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: palette.muted,
                        usePointStyle: true,
                        pointStyle: 'circle',
                        boxWidth: 8,
                        boxHeight: 8,
                        padding: 14,
                        font: { size: 11 }
                    }
                },
                tooltip: tooltipStyle(palette)
            }
        };
    }

    function setChartEmpty(canvasId, isEmpty) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const wrap = canvas.closest('.chart-canvas-wrap');
        const overlay = wrap ? wrap.querySelector('.chart-empty') : null;
        if (overlay) overlay.hidden = !isEmpty;
    }

    function destroyCharts() {
        Object.keys(chartInstances).forEach(id => {
            try {
                chartInstances[id].destroy();
            } catch (_e) { /* ignore */ }
            delete chartInstances[id];
        });
    }

    function toEntries(obj, order, colorMap, palette) {
        const source = obj || {};
        const keys = (order && order.length ? order : Object.keys(source)).filter(key => Number(source[key] || 0) > 0);
        return keys.map(key => ({
            label: key,
            value: Number(source[key] || 0),
            color: (colorMap && colorMap[key]) || palette.info
        }));
    }

    function renderCharts(data) {
        if (typeof window.Chart === 'undefined') {
            if (chartsStatus) {
                chartsStatus.hidden = false;
                chartsStatus.classList.add('is-error');
                chartsStatus.textContent = 'Chart.js n\'a pas pu être chargé : les graphiques sont indisponibles.';
            }
            return;
        }

        destroyCharts();

        const palette = chartPalette();
        const labels = (data.labels || []).map(formatDayLabel);
        const total = arr => (arr || []).reduce((sum, value) => sum + Number(value || 0), 0);

        Chart.defaults.font.family = "'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        Chart.defaults.color = palette.muted;

        // 1. Activité quotidienne (courbes)
        const activite = data.activite || {};
        const activiteEmpty = total(activite.consultations) === 0 && total(activite.rendezvous) === 0;
        setChartEmpty('chart-activite', activiteEmpty);
        if (!activiteEmpty) {
            chartInstances['chart-activite'] = new Chart(document.getElementById('chart-activite'), {
                type: 'line',
                data: {
                    labels,
                    datasets: [
                        {
                            label: 'Consultations',
                            data: activite.consultations || [],
                            borderColor: palette.success,
                            backgroundColor: withAlpha(palette.success, 0.14),
                            pointBackgroundColor: palette.success,
                            tension: 0.35,
                            fill: true,
                            borderWidth: 2,
                            pointRadius: 2,
                            pointHoverRadius: 4
                        },
                        {
                            label: 'Demandes de RDV',
                            data: activite.rendezvous || [],
                            borderColor: palette.info,
                            backgroundColor: withAlpha(palette.info, 0.10),
                            pointBackgroundColor: palette.info,
                            tension: 0.35,
                            fill: true,
                            borderWidth: 2,
                            pointRadius: 2,
                            pointHoverRadius: 4
                        }
                    ]
                },
                options: cartesianOptions(palette, { integer: true })
            });
        }

        // 2. Encaissements journaliers (barres)
        const revenusEmpty = total(data.revenus) === 0;
        setChartEmpty('chart-revenus', revenusEmpty);
        if (!revenusEmpty) {
            const options = cartesianOptions(palette, {
                legend: false,
                integer: false,
                maxTicks: 10,
                yTick: value => nfCompact.format(value)
            });
            options.plugins.tooltip.callbacks = {
                label: context => `${nfFC.format(context.parsed.y)} FC`
            };
            chartInstances['chart-revenus'] = new Chart(document.getElementById('chart-revenus'), {
                type: 'bar',
                data: {
                    labels,
                    datasets: [{
                        label: 'Encaissements',
                        data: data.revenus || [],
                        backgroundColor: withAlpha(palette.primary, 0.72),
                        hoverBackgroundColor: palette.primary,
                        borderRadius: 6,
                        maxBarThickness: 38
                    }]
                },
                options
            });
        }

        // 3. Rendez-vous par statut
        const rdvEntries = toEntries(data.rdv_statuts, ['En attente', 'À payer', 'Confirmé', 'Terminé', 'Planifié', 'Annulé'], {
            'En attente': palette.warning,
            'À payer': palette.info,
            'Confirmé': palette.success,
            'Terminé': palette.primary,
            'Planifié': palette.secondary,
            'Annulé': palette.danger
        }, palette);
        const rdvEmpty = rdvEntries.length === 0;
        setChartEmpty('chart-rdv-statuts', rdvEmpty);
        if (!rdvEmpty) {
            const options = doughnutOptions(palette);
            options.plugins.tooltip.callbacks = {
                label: context => {
                    const value = Number(context.parsed || 0);
                    const sum = rdvEntries.reduce((acc, entry) => acc + entry.value, 0) || 1;
                    return `${context.label} : ${value} (${Math.round((value / sum) * 100)}%)`;
                }
            };
            chartInstances['chart-rdv-statuts'] = new Chart(document.getElementById('chart-rdv-statuts'), {
                type: 'doughnut',
                data: {
                    labels: rdvEntries.map(entry => entry.label),
                    datasets: [{
                        data: rdvEntries.map(entry => entry.value),
                        backgroundColor: rdvEntries.map(entry => entry.color),
                        borderColor: palette.card,
                        borderWidth: 2,
                        hoverOffset: 6
                    }]
                },
                options
            });
        }

        // 4. Examens par statut
        const examEntries = toEntries(data.examens_statuts, ['En attente', 'En cours', 'Termine'], {
            'En attente': palette.warning,
            'En cours': palette.info,
            'Termine': palette.success
        }, palette);
        const examEmpty = examEntries.length === 0;
        setChartEmpty('chart-examens-statuts', examEmpty);
        if (!examEmpty) {
            const options = doughnutOptions(palette);
            options.plugins.tooltip.callbacks = {
                label: context => {
                    const value = Number(context.parsed || 0);
                    const sum = examEntries.reduce((acc, entry) => acc + entry.value, 0) || 1;
                    return `${context.label} : ${value} (${Math.round((value / sum) * 100)}%)`;
                }
            };
            chartInstances['chart-examens-statuts'] = new Chart(document.getElementById('chart-examens-statuts'), {
                type: 'doughnut',
                data: {
                    labels: examEntries.map(entry => entry.label === 'Termine' ? 'Terminé' : entry.label),
                    datasets: [{
                        data: examEntries.map(entry => entry.value),
                        backgroundColor: examEntries.map(entry => entry.color),
                        borderColor: palette.card,
                        borderWidth: 2,
                        hoverOffset: 6
                    }]
                },
                options
            });
        }

        // 5. Top médecins (barres horizontales)
        const top = data.top_medecins || {};
        const topLabels = top.labels || [];
        const topEmpty = topLabels.length === 0;
        setChartEmpty('chart-top-medecins', topEmpty);
        if (!topEmpty) {
            const options = cartesianOptions(palette, {
                legend: false,
                integer: true,
                maxTicks: 5
            });
            options.indexAxis = 'y';
            options.interaction = { mode: 'nearest', intersect: true };
            options.scales.x.grid = { color: palette.grid };
            options.scales.x.border = { display: false };
            options.scales.y.grid = { display: false };
            options.scales.y.border = { color: palette.grid };
            options.scales.y.ticks.autoSkip = false;
            chartInstances['chart-top-medecins'] = new Chart(document.getElementById('chart-top-medecins'), {
                type: 'bar',
                data: {
                    labels: topLabels,
                    datasets: [{
                        label: 'Consultations',
                        data: top.data || [],
                        backgroundColor: withAlpha(palette.secondary, 0.8),
                        hoverBackgroundColor: palette.secondary,
                        borderRadius: 6,
                        maxBarThickness: 26
                    }]
                },
                options
            });
        }

        // 6. Moyens de paiement
        const methodEntries = toEntries(data.paiements_methodes, ['Espèces', 'Carte', 'Mobile Money', 'Assurance'], {
            'Espèces': palette.success,
            'Carte': palette.info,
            'Mobile Money': palette.warning,
            'Assurance': palette.primary
        }, palette);
        const methodEmpty = methodEntries.length === 0;
        setChartEmpty('chart-paiements-methodes', methodEmpty);
        if (!methodEmpty) {
            const options = doughnutOptions(palette);
            options.plugins.tooltip.callbacks = {
                label: context => `${context.label} : ${nfFC.format(Number(context.parsed || 0))} FC`
            };
            chartInstances['chart-paiements-methodes'] = new Chart(document.getElementById('chart-paiements-methodes'), {
                type: 'doughnut',
                data: {
                    labels: methodEntries.map(entry => entry.label),
                    datasets: [{
                        data: methodEntries.map(entry => entry.value),
                        backgroundColor: methodEntries.map(entry => entry.color),
                        borderColor: palette.card,
                        borderWidth: 2,
                        hoverOffset: 6
                    }]
                },
                options
            });
        }
    }

    function loadChartStats(days) {
        currentPeriod = Number(days) || currentPeriod;
        const requestId = ++chartRequestId;
        if (chartsStatus) {
            chartsStatus.hidden = false;
            chartsStatus.classList.remove('is-error');
            chartsStatus.textContent = 'Chargement des graphiques…';
        }

        ApiClient.request(`/stats/charts?days=${currentPeriod}`, 'GET')
            .then(data => {
                if (requestId !== chartRequestId) return;
                if (!data || data.status === 'error') {
                    throw new Error((data && data.message) || 'Données indisponibles.');
                }
                chartsData = data;
                renderCharts(data);
                if (chartsStatus) chartsStatus.hidden = true;
            })
            .catch(error => {
                if (requestId !== chartRequestId) return;
                if (chartsStatus) {
                    chartsStatus.hidden = false;
                    chartsStatus.classList.add('is-error');
                    chartsStatus.textContent = 'Impossible de charger les graphiques : ' + error.message;
                }
            });
    }

    if (periodSelect) {
        periodSelect.addEventListener('change', () => loadChartStats(periodSelect.value));
    }

    // Re-rendre les graphiques quand le thème clair/sombre change.
    const themeObserver = new MutationObserver(() => {
        if (chartsData) renderCharts(chartsData);
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });


    // 5. Gestion du Personnel
    function loadStaff() {
        ApiClient.request('/staff', 'GET')
            .then(res => {
                const staff = (res && res.records) ? res.records : [];
                const tbody = document.getElementById('staff-table-body');
                tbody.innerHTML = '';
                if (!staff || staff.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding: 2rem;">Aucun membre du personnel enregistré.</td></tr>';
                    return;
                }
                staff.forEach(member => {
                    const date = member.created_at ? new Date(member.created_at).toLocaleDateString('fr-FR') : '-';
                    const imgHtml = member.profile_image
                        ? `<img src="${escapeHtml(ApiClient.staticUrl(member.profile_image))}" style="width:30px; height:30px; border-radius:50%; object-fit:cover; vertical-align:middle; margin-right:8px;">`
                        : `<span style="display:inline-block; width:30px; height:30px; border-radius:50%; background:var(--primary-color); color:white; text-align:center; line-height:30px; font-weight:bold; font-size:0.8rem; margin-right:8px;">${escapeHtml((member.prenom || 'S').charAt(0).toUpperCase())}</span>`;

                    const specialiteHtml = (member.specialite || (member.is_assistant == 1 ? 'Assistant' : ''))
                        ? `<small style="color: var(--text-muted);">${escapeHtml(member.specialite || '')}${member.is_assistant == 1 ? '<br>Assistant' : ''}</small>`
                        : '-';

                    const tr = document.createElement('tr');
                    tr.style.borderBottom = '1px solid rgba(0,0,0,0.05)';
                    tr.innerHTML = `
                        <td style="padding: 1rem 0.5rem; font-weight: 500;">${imgHtml} ${escapeHtml(member.prenom)} ${escapeHtml(member.nom)}</td>
                        <td style="padding: 1rem 0.5rem;"><span class="badge ${getRoleBadgeClass(member.role)}">${escapeHtml(member.role)}</span></td>
                        <td style="padding: 1rem 0.5rem;">${specialiteHtml}</td>
                        <td style="padding: 1rem 0.5rem; color: var(--text-muted);">${escapeHtml(member.email)}</td>
                        <td style="padding: 1rem 0.5rem; color: var(--text-muted);">${escapeHtml(date)}</td>
                        <td style="padding: 1rem 0.5rem; text-align: right;">
                            <button class="btn btn-secondary" onclick="deleteStaffMember(${Number(member.id)}, '${escapeHtml(member.prenom)} ${escapeHtml(member.nom)}')" style="padding:0.3rem 0.6rem; font-size:0.8rem; color:var(--danger-color); border-color:var(--danger-color);">Supprimer</button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            })
            .catch(error => {
                document.getElementById('staff-table-body').innerHTML = `<tr><td colspan="6" class="text-center text-danger">Erreur: ${escapeHtml(error.message)}</td></tr>`;
            });
    }

    window.deleteStaffMember = function(id, name) {
        if (!confirm(`Êtes-vous sûr de vouloir supprimer ${name} du personnel ?`)) return;
        ApiClient.request(`/staff/${id}`, 'DELETE')
            .then(() => {
                showToast("Membre du personnel supprimé.", "success");
                loadStaff();
            })
            .catch(err => showToast("Erreur de suppression : " + err.message, "danger"));
    };

    function getRoleBadgeClass(role) {
        const r = Auth.normalizeRole(role);
        switch(r) {
            case 'admin': return 'badge-danger';
            case 'medecin': return 'badge-info';
            case 'secretaire': return 'badge-warning';
            case 'caissier': return 'badge-success';
            case 'laborantin': return 'badge-info';
            case 'infirmier': return 'badge-info';
            default: return 'badge-info';
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

    function loadSuperviseurOptions(selectedId) {
        const select = document.getElementById('staff-superviseur');
        ApiClient.request('/users/staff', 'GET')
            .then(staff => {
                const medecins = staff.filter(s => Auth.normalizeRole(s.role) === 'medecin' && !(s.is_assistant == 1));
                select.innerHTML = '<option value="">Sélectionnez le médecin</option>';
                medecins.forEach(m => {
                    const label = `Dr. ${escapeHtml(m.prenom)} ${escapeHtml(m.nom)}` + (m.specialite ? ` — ${escapeHtml(m.specialite)}` : '');
                    select.innerHTML += `<option value="${escapeHtml(m.id)}"${String(m.id) === String(selectedId) ? ' selected' : ''}>${label}</option>`;
                });
            })
            .catch(() => {});
    }

    function updateStaffFieldsVisibility() {
        const isMedecin = Auth.normalizeRole(roleSelect.value) === 'medecin';
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

        if (Auth.normalizeRole(roleSelect.value) === 'medecin') {
            staffData.append('specialite', document.getElementById('staff-specialite').value.trim() || '');
            if (assistantCheck.checked) {
                staffData.append('is_assistant', '1');
                staffData.append('superviseur_id', document.getElementById('staff-superviseur').value || '');
            }
        }
        const imgFile = document.getElementById('staff-image').files[0];
        if (imgFile) staffData.append('profile_image', imgFile);

        try {
            await ApiClient.request('/users/staff', 'POST', staffData);
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

    // 6. Messages de Contact
    function loadMessages() {
        ApiClient.request('/contact/messages', 'GET')
            .then(res => {
                const messages = (res && res.data) ? res.data : [];
                const tbody = document.getElementById('messages-table-body');
                tbody.innerHTML = '';
                const nonlus = messages.filter(m => m.statut === 'nouveau').length;
                document.getElementById('messages-nonlus').textContent = nonlus > 0 ? `${nonlus} nouveau(x) message(s)` : 'Aucun nouveau message';
                if (messages.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding: 2rem;">Aucun message de contact pour le moment.</td></tr>';
                    return;
                }
                messages.forEach(m => {
                    const tr = document.createElement('tr');
                    tr.style.borderBottom = '1px solid rgba(0,0,0,0.05)';
                    const isNouveau = m.statut === 'nouveau';
                    tr.innerHTML = `
                        <td style="padding: 1rem 0.5rem; font-weight: 500;">${escapeHtml(m.nom)}</td>
                        <td style="padding: 1rem 0.5rem; color: var(--text-muted);">${escapeHtml(m.email)}</td>
                        <td style="padding: 1rem 0.5rem; color: var(--text-main); max-width: 320px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(m.message)}">${escapeHtml(m.message)}</td>
                        <td style="padding: 1rem 0.5rem; color: var(--text-muted);">${escapeHtml(m.created_at || '')}</td>
                        <td style="padding: 1rem 0.5rem;">
                            ${isNouveau ? '<span style="background:rgba(245,158,11,0.12); color:#b45309; padding:4px 12px; border-radius:20px; font-weight:600; font-size:0.85rem;">Nouveau</span>' : '<span style="background:rgba(16,185,129,0.12); color:var(--success-color); padding:4px 12px; border-radius:20px; font-weight:600; font-size:0.85rem;">Lu</span>'}
                        </td>
                        <td style="padding: 1rem 0.5rem; text-align: right;">
                            ${isNouveau ? `<button class="btn btn-secondary" onclick="markMessageRead(${Number(m.id)})" style="padding:0.3rem 0.6rem; font-size:0.8rem;">Marquer lu</button>` : ''}
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            })
            .catch(error => {
                document.getElementById('messages-table-body').innerHTML = `<tr><td colspan="6" class="text-center text-danger">Erreur: ${escapeHtml(error.message)}</td></tr>`;
            });
    }

    window.markMessageRead = function(id) {
        ApiClient.request(`/contact/messages/${id}/read`, 'POST')
            .then(() => { showToast("Message marqué comme lu.", "success"); loadMessages(); })
            .catch(err => showToast("Erreur : " + err.message, "danger"));
    };

    document.getElementById('btn-mark-all-read').addEventListener('click', () => {
        ApiClient.request('/contact/messages/read-all', 'POST')
            .then(() => { showToast("Tous les messages sont marqués comme lus.", "success"); loadMessages(); })
            .catch(err => showToast("Erreur : " + err.message, "danger"));
    });

    // Les notifications sont gérées par js/notifications.js (cloche + polling).
    // On rafraîchit simplement les données visibles quand une alerte arrive.
    document.addEventListener('hospira:notification', () => {
        if (viewMessages.style.display === 'block') loadMessages();
        loadDashboardStats();
        if (viewDashboard.style.display !== 'none') loadChartStats(currentPeriod);
    });

    loadDashboardStats();
    loadChartStats(currentPeriod);

    function showToast(message, type = "success") {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        const accent = type === 'danger' ? 'var(--danger-color)' : type === 'warning' ? 'var(--warning-color)' : type === 'info' ? 'var(--info-color)' : 'var(--success-color)';
        toast.style.borderLeftColor = accent;
        const content = document.createElement('span');
        content.className = 'toast-content';
        content.textContent = message;
        const close = document.createElement('button');
        close.className = 'toast-close';
        close.innerHTML = '&times;';
        close.onclick = () => toast.remove();
        toast.appendChild(content);
        toast.appendChild(close);
        container.appendChild(toast);
        setTimeout(() => { toast.style.animation = 'fadeOutRight 0.4s forwards'; setTimeout(() => toast.remove(), 400); }, 5000);
    }
    window.showToast = showToast;
});
