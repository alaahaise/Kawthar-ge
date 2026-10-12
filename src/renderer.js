(() => {
  'use strict';

  // ============================================================
  //  OUTILS
  // ============================================================

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel, scope) => Array.from((scope || document).querySelectorAll(sel));

  const MOIS_LONGS = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];
  const MOIS_COURTS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

  /** Échappe le HTML — y compris l'apostrophe, qui casserait les attributs. */
  function escapeHtml(v) {
    if (v === null || v === undefined) return '';
    return String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
  const formatAmount = (n) => nf.format(Number(n) || 0);

  function formatTodayDDMMYYYY() {
    const d = new Date();
    const p = (x) => String(x).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
  }

  function yearFromDisplayDate(s) {
    const m = String(s || '').match(/(\d{4})/);
    return m ? m[1] : String(new Date().getFullYear());
  }

  /** Accepte jj/mm/aaaa et renvoie l'ISO, pour trier et filtrer correctement. */
  function toIsoDate(s) {
    const m = String(s || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
  }

  /** Insère les-slashes pendant la saisie d'une date. */
  function attachDateMask(input) {
    if (!input) return;
    input.addEventListener('input', () => {
      let v = input.value.replace(/\D/g, '').slice(0, 8);
      if (v.length >= 3) v = `${v.slice(0, 2)}/${v.slice(2)}`;
      if (v.length >= 6) v = `${v.slice(0, 5)}/${v.slice(5)}`;
      input.value = v;
    });
    input.addEventListener('blur', () => {
      if (toIsoDate(input.value)) input.value = input.value;
    });
  }

  function teacherLabel(t) {
    if (!t) return '';
    const full = [t.prenom, t.nom].filter(Boolean).join(' ').trim();
    return t.code ? `${full} (${t.code})` : full;
  }

  function photoUrl(fileName) {
    if (!fileName) return '';
    const dir = String(photosDir || '').replace(/\\/g, '/');
    return `file:///${dir}/${encodeURIComponent(fileName)}`;
  }

  function avatarHtml(student, size) {
    const url = photoUrl(student.photo);
    const cls = `row-avatar-img ${size === 'sm' ? 'is-sm' : ''}`;
    if (url) {
      return `<img class="${cls}" src="${url}" alt="" onerror="this.remove()" />`;
    }
    const initial = escapeHtml((student.prenom || student.nom || '?').charAt(0).toUpperCase());
    return `<span class="${cls} is-placeholder">${initial}</span>`;
  }

  function clearWillPrint() {
    document.querySelectorAll('.will-print').forEach((el) => el.classList.remove('will-print'));
  }

  // ============================================================
  //  ICÔNES
  // ============================================================

  const svg = (d, extra) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra || ''}>${d}</svg>`;

  const ICONS = {
    home: svg('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 10v10h14V10"/>'),
    clipboard: svg('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9z"/>'),
    users: svg('<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.4"/><path d="M16 14.5a5 5 0 0 1 5 5.5"/>'),
    user: svg('<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>'),
    wallet: svg('<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><circle cx="17" cy="14.5" r="1.2" fill="currentColor"/>'),
    idcard: svg('<rect x="2.5" y="5" width="19" height="14" rx="2"/><circle cx="8.5" cy="11" r="2.2"/><path d="M5 16a3.6 3.6 0 0 1 7 0"/><path d="M14.5 10h4M14.5 13.5h4"/>'),
    book: svg('<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M8 3v18"/>'),
    search: svg('<circle cx="11" cy="11" r="6"/><path d="m20 20-3.6-3.6"/>'),
    excel: svg('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="m9 13 5 5M14 13l-5 5"/>'),
    upload: svg('<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>'),
    download: svg('<path d="M12 4v12"/><path d="m7 11 5 5 5-5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>'),
    camera: svg('<path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>'),
    calendar: svg('<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
    printer: svg('<path d="M7 9V3h10v6"/><rect x="3.5" y="9" width="17" height="7" rx="2"/><path d="M7 14h10v7H7z"/>'),
    grid: svg('<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    phone: svg('<path d="M6 3h4l2 5-2.5 1.5a12 12 0 0 0 5 5L16 12l5 2v4a2 2 0 0 1-2.2 2A17 17 0 0 1 4 5.2 2 2 0 0 1 6 3z"/>'),
    email: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/>'),
    money: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7v10M9.5 9.5h4a1.8 1.8 0 0 1 0 3.6h-3a1.8 1.8 0 0 0 0 3.5h4"/>'),
    link: svg('<path d="M10 13.5a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 1 0-5.7-5.7l-1.3 1.3"/><path d="M14 10.5a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 1 0 5.7 5.7l1.3-1.3"/>'),
    close: svg('<path d="m6 6 12 12M18 6 6 18"/>'),
    check: svg('<path d="m5 12.5 4.5 4.5L19 7"/>'),
    edit: svg('<path d="M4 20h4L20 8l-4-4L4 16z"/>'),
    trash: svg('<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/>'),
    eye: svg('<path d="M2 12s3.8-6 10-6 10 6 10 6-3.8 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.8"/>'),
    graduationCap: svg('<path d="M2.5 8.5 12 4l9.5 4.5L12 13z"/><path d="M6.5 10.8V16c0 1.5 2.5 3 5.5 3s5.5-1.5 5.5-3v-5.2"/>'),
    pin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>',
    chart: svg('<path d="M4 20V4"/><path d="M4 20h16"/><path d="M8 17v-5M12.5 17V8M17 17v-7"/>'),
    warning: svg('<path d="M12 4 2.5 20h19z"/><path d="M12 10v4M12 17.2v.1"/>')
  };

  /** Remplit tous les <span data-icon="..."> du document. */
  function applyStaticIcons(root) {
    (root || document).querySelectorAll('[data-icon]').forEach((el) => {
      const name = el.dataset.icon;
      if (ICONS[name]) el.innerHTML = ICONS[name];
    });
  }

  // ============================================================
  //  ÉTAT
  // ============================================================

  let photosDir = '';
  let allMatieres = [];
  let allTeachers = [];
  let allCours = [];
  let allClasses = [];
  let allStudentsCache = [];

  let anneeTravail = new Date().getFullYear();
  let anneesDisponibles = [];
  let mapStatutPaiement = {}; // student_id -> [{teacher_id, teacher_nom, paye, montant}]
  let matieresByStudent = {};

  let editingStudent = null; // { id, matricule, photo }
  let pendingPhotoPath = null;
  let editingTeacherId = null;
  let editingMatiereId = null;

  // Inscriptions en cours dans le formulaire : matiere_id -> Set(teacher_ids)
  let formEnrollments = new Map();

  let payState = { matiere_id: null, teacher_id: null, annee: new Date().getFullYear(), mois: new Date().getMonth() + 1, data: null };

  let cardsCache = [];
  const selectedCardIds = new Set();
  let stateCardsSort = { champ: 'nom', dir: 'asc' };
  let stateStudentSort = { champ: 'nom', dir: 'asc' };
  let stateCoursSort = { champ: 'matiere_nom', dir: 'asc' };
  let coursFilterText = '';
  let dashAnnee = new Date().getFullYear();
  let dashTeacher = '';
  let dashRepartition = 'matiere';

  const chartRefs = { revenue: null, repartition: null, matiere: null };

  // ============================================================
  //  NAVIGATION
  // ============================================================

  function showView(name) {
    $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${name}`));
    $$('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
    if (name === 'etudiants') refreshStudentList();
    if (name === 'paiements') refreshPayments();
    if (name === 'cartes') refreshCardsList();
    if (name === 'enseignants') renderTeachersView();
    if (name === 'matieres') renderMatieresView();
    if (name === 'accueil') {
      refreshStats();
      refreshDashboardCharts();
    }
  }

  $$('.nav-item').forEach((btn) => btn.addEventListener('click', () => showView(btn.dataset.view)));

  const raccourcis = {
    'stat-goto-inscription': 'inscription',
    'stat-goto-liste': 'etudiants',
    'stat-goto-paiements': 'paiements',
    'stat-goto-matieres': 'matieres'
  };
  Object.keys(raccourcis).forEach((id) => {
    const el = $('#' + id);
    if (el) el.addEventListener('click', () => showView(raccourcis[id]));
  });

  // ============================================================
  //  ACCUEIL — STATS & GRAPHIQUES
  // ============================================================

  async function refreshStats() {
    const g = await window.api.statsGlobales({ teacher_id: dashTeacher || null });
    const set = (id, v) => {
      const el = $(id);
      if (el) el.textContent = v;
    };
    set('#stat-total', formatAmount(g.eleves));
    set('#stat-matieres', formatAmount(g.matieres));
    set('#stat-teachers', formatAmount(g.enseignants));
    set('#stat-impayes', formatAmount(g.impayes));
  }

  /** Barres horizontales (pas Chart.js) — « inscriptions par matière ». */
  function renderMatieresStats(matieres) {
    const wrap = $('#matieres-bar-chart');
    if (!wrap) return;
    const rows = (matieres || [])
      .filter((m) => Number(m.student_count) > 0)
      .sort((a, b) => Number(b.student_count) - Number(a.student_count));
    const total = $('#matieres-bar-total');
    if (total) total.textContent = rows.length ? `${formatAmount(rows.reduce((s, m) => s + Number(m.student_count), 0))} inscription(s)` : '';
    if (!rows.length) {
      wrap.innerHTML = '<p class="hint-inline">Aucune inscription pour le moment.</p>';
      return;
    }
    const max = Math.max(...rows.map((r) => Number(r.student_count)), 1);
    wrap.innerHTML = rows
      .map(
        (m) => `
      <div class="bar-row">
        <span class="bar-label" title="${escapeHtml(m.nom)}">${escapeHtml(m.nom)}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${(Number(m.student_count) / max) * 100}%"></span></span>
        <span class="bar-value">${formatAmount(m.student_count)}</span>
      </div>`
      )
      .join('');
  }

  async function refreshMatieresStats() {
    const matieres = await window.api.matieresStats();
    renderMatieresStats(matieres);
  }

  const PALETTE = ['#2f6bd8', '#1f9d55', '#e08a1e', '#8b5cf6', '#e0524a', '#0d9aa8', '#c2418f', '#6b7280', '#7a9c2f', '#b45309'];

  async function refreshDashboardCharts() {
    if (typeof Chart === 'undefined') return;
    const teacherId = dashTeacher || null;

    // --- Encaissements par mois (barres) + attendu (trait) ---
    const rev = await window.api.statsRevenue({ annee: dashAnnee, teacher_id: teacherId });
    const ctxR = $('#chart-revenue');
    if (ctxR) {
      if (chartRefs.revenue) chartRefs.revenue.destroy();
      chartRefs.revenue = new Chart(ctxR, {
        data: {
          labels: MOIS_COURTS,
          datasets: [
            {
              type: 'bar',
              label: 'Encaissé (DA)',
              data: rev.par_mois.map((b) => b.montant),
              backgroundColor: PALETTE[0] + 'cc',
              borderRadius: 5,
              order: 2
            },
            {
              type: 'line',
              label: 'Attendu (DA)',
              data: rev.par_mois.map((b) => b.attendu),
              borderColor: PALETTE[3],
              backgroundColor: PALETTE[3],
              borderWidth: 2,
              borderDash: [6, 4],
              tension: 0.3,
              pointRadius: 2,
              order: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { boxWidth: 12, font: { size: 11 } } } },
          scales: {
            y: { beginAtZero: true, ticks: { callback: (v) => formatAmount(v), font: { size: 10 } } },
            x: { ticks: { font: { size: 10 } } }
          }
        }
      });
    }
    const totalAnnee = $('#dash-total-annee');
    if (totalAnnee) {
      totalAnnee.textContent = `${formatAmount(rev.total)} DA encaissés · ${formatAmount(rev.attendu_annuel)} DA attendus`;
    }

    // --- Encaissements par matière ---
    const parMatiere = await window.api.statsRevenueParMatiere({ annee: dashAnnee, teacher_id: teacherId });
    const ctxM = $('#chart-revenue-matiere');
    const videM = $('#chart-matiere-empty');
    if (ctxM) {
      if (videM) videM.style.display = parMatiere.some((r) => r.montant > 0) ? 'none' : 'block';
      if (chartRefs.matiere) chartRefs.matiere.destroy();
      chartRefs.matiere = parMatiere.length
        ? new Chart(ctxM, {
            type: 'bar',
            data: {
              labels: parMatiere.map((r) => r.matiere_nom),
              datasets: [
                {
                  label: 'Encaissé (DA)',
                  data: parMatiere.map((r) => r.montant),
                  backgroundColor: PALETTE[1] + 'cc',
                  borderRadius: 5
                }
              ]
            },
            options: {
              indexAxis: 'y',
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: {
                x: { beginAtZero: true, ticks: { callback: (v) => formatAmount(v), font: { size: 10 } } },
                y: { ticks: { font: { size: 10 } } }
              }
            }
          })
        : null;
    }

    await renderRepartitionChart();
  }

  async function renderRepartitionChart() {
    if (typeof Chart === 'undefined') return;
    const cours = dashTeacher ? allCours.filter((c) => String(c.teacher_id) === String(dashTeacher)) : allCours;

    // Un élève peut suivre la même matière chez deux professeurs : il compte
    // une fois dans « par matière » (sinon le camemberb ment), mais reste
    // compté dans chaque cours pour « par enseignant ».
    const parMatiere = new Map();
    const parProf = new Map();

    cours.forEach((c) => {
      if (!c.student_count) return;
      parProf.set(c.teacher_full_name, (parProf.get(c.teacher_full_name) || 0) + Number(c.student_count));
    });

    if (!dashTeacher) {
      // On a besoin du détail des inscriptions pour compter les élèves uniques.
      const rows = await window.api.listStudents({ sort: 'nom', dir: 'asc' });
      const map = await window.api.studentMatieresMap();
      rows.forEach((s) => {
        (map[s.id] || []).forEach((libelle) => {
          const cle = libelle.split(' · ')[0];
          parMatiere.set(cle, (parMatiere.get(cle) || 0) + 1);
        });
      });
    } else {
      cours.forEach((c) => {
        if (c.student_count) parMatiere.set(c.matiere_nom, (parMatiere.get(c.matiere_nom) || 0) + Number(c.student_count));
      });
    }
    const parProfMode = dashRepartition === 'prof';
    const data = parProfMode ? Array.from(parProf.entries()) : Array.from(parMatiere.entries());
    data.sort((a, b) => b[1] - a[1]);

    const ctx = $('#chart-repartition');
    const vide = $('#chart-repartition-empty');
    if (!ctx) return;
    if (vide) vide.style.display = data.length ? 'none' : 'block';

    if (chartRefs.repartition) {
      chartRefs.repartition.destroy();
      chartRefs.repartition = null;
    }
    if (!data.length) return;

    chartRefs.repartition = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: data.map((d) => d[0]),
        datasets: [
          {
            data: data.map((d) => d[1]),
            backgroundColor: data.map((_, i) => PALETTE[i % PALETTE.length]),
            borderWidth: 2,
            borderColor: '#fff'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '55%',
        plugins: {
          legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: (c) => ` ${c.label} : ${formatAmount(c.parsed)} élève(s)`
            }
          }
        }
      }
    });
  }

  // ============================================================
  //  MATIÈRES + COURS
  // ============================================================

  async function refreshMatieresData() {
    allMatieres = await window.api.listMatieres();
    allTeachers = await window.api.listTeachers();
    allCours = await window.api.listCours();
    populateMatiereSelects();
    populateTeacherSelects();
    renderCoursTable();
    refreshMatieresStats();
  }

  function populateMatiereSelects() {
    const html = allMatieres.map((m) => `<option value="${m.id}">${escapeHtml(m.nom)}</option>`).join('');
    ['#assign-matiere'].forEach((sel) => {
      const el = $(sel);
      if (el) el.innerHTML = html;
    });
  }

  function populateTeacherSelects() {
    const html = allTeachers.map((t) => `<option value="${t.id}">${escapeHtml(teacherLabel(t))}</option>`).join('');
    ['#assign-teacher'].forEach((sel) => {
      const el = $(sel);
      if (el) el.innerHTML = html;
    });
  }

  function paintSortIndicators(scope, selector, state) {
    $$(`${scope} ${selector}`).forEach((th) => {
      const champ = th.dataset.sort || th.dataset.cardsSort || th.dataset.coursSort;
      const active = champ === state.champ;
      th.classList.toggle('is-active', active);
      th.classList.toggle('is-desc', active && state.dir === 'desc');
      th.setAttribute('aria-sort', active ? (state.dir === 'asc' ? 'ascending' : 'descending') : 'none');
    });
  }

  function renderCoursTable() {
    const body = $('#cours-body');
    if (!body) return;
    const q = coursFilterText;
    let rows = allCours.slice();
    if (q) rows = rows.filter((c) => `${c.matiere_nom} ${c.teacher_full_name}`.toLowerCase().includes(q));

    const champ = stateCoursSort.champ;
    const sens = stateCoursSort.dir === 'desc' ? -1 : 1;
    rows.sort((a, b) => {
      if (champ === 'prix_mensuel' || champ === 'student_count') return (a[champ] - b[champ]) * sens;
      return String(a[champ] || '').localeCompare(String(b[champ] || ''), 'fr', { sensitivity: 'base' }) * sens;
    });

    paintSortIndicators('#cours-head', '[data-cours-sort]', stateCoursSort);

    const vide = $('#cours-empty');
    const count = $('#cours-count');
    if (count) count.textContent = allCours.length;
    if (vide) vide.style.display = rows.length ? 'none' : 'block';
    if (!rows.length) {
      body.innerHTML = '';
      return;
    }

    body.innerHTML = rows
      .map(
        (c) => `
      <tr>
        <td><b>${escapeHtml(c.matiere_nom)}</b></td>
        <td>${escapeHtml(c.teacher_full_name || '—')}</td>
        <td class="is-num">${c.prix_mensuel ? formatAmount(c.prix_mensuel) + ' DA' : '—'}</td>
        <td class="is-num">${formatAmount(c.student_count)}</td>
        <td class="actions-cell">
          <button class="btn-icon" data-edit-cours="${c.id}" title="Modifier le tarif">${ICONS.edit}</button>
          <button class="btn-icon is-danger" data-del-cours="${c.id}" title="Supprimer le cours">${ICONS.trash}</button>
        </td>
      </tr>`
      )
      .join('');

    body.querySelectorAll('[data-edit-cours]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const c = await window.api.coursInfo({ id: parseInt(btn.dataset.editCours, 10) });
        if (!c) return;
        $('#assign-matiere').value = String(c.matiere_id);
        $('#assign-teacher').value = String(c.teacher_id);
        $('#assign-prix').value = c.prix_mensuel || '';
        $('#assign-matiere').disabled = true;
        $('#assign-teacher').disabled = true;
        $('#assign-prix').scrollIntoView({ block: 'center', behavior: 'smooth' });
        $('#assign-prix').focus();
      });
    });

    body.querySelectorAll('[data-del-cours]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const c = allCours.find((x) => String(x.id) === btn.dataset.delCours);
        if (!c) return;
        if (!confirm(`Supprimer le cours « ${c.matiere_nom} — ${c.teacher_full_name} » ?\n\nLes élèves inscrits à ce cours perdront cette inscription.`)) return;
        await window.api.removeMatiereTeacher({ matiere_id: c.matiere_id, teacher_id: c.teacher_id });
        await refreshMatieresData();
        await afterDataChange();
      });
    });
  }

  function setupCoursSorting() {
    $$('#cours-head .sortable').forEach((th) => {
      th.addEventListener('click', () => {
        const champ = th.dataset.coursSort;
        stateCoursSort =
          stateCoursSort.champ === champ
            ? { champ, dir: stateCoursSort.dir === 'asc' ? 'desc' : 'asc' }
            : { champ, dir: 'asc' };
        renderCoursTable();
      });
    });
    const search = $('#cours-search');
    if (search) {
      search.addEventListener('input', () => {
        coursFilterText = search.value.trim().toLowerCase();
        renderCoursTable();
      });
    }
  }

  function renderMatieresView() {
    const grid = $('#matieres-list');
    const vide = $('#matieres-empty');
    const count = $('#matieres-count');
    if (count) count.textContent = allMatieres.length;
    if (!grid) return;
    if (vide) vide.style.display = allMatieres.length ? 'none' : 'block';

    grid.innerHTML = allMatieres
      .map(
        (m) => `
      <div class="entity-card">
        <div class="entity-card-head">
          <span class="entity-icon">${ICONS.book}</span>
          <div>
            <div class="entity-title">${escapeHtml(m.nom)}</div>
            <div class="entity-sub">${m.prix_mensuel ? formatAmount(m.prix_mensuel) + ' DA / mois' : 'Tarif non défini'}</div>
          </div>
        </div>
        ${m.description ? `<p class="entity-desc">${escapeHtml(m.description)}</p>` : ''}
        <div class="entity-tags">
          <span class="chip">${formatAmount(m.student_count || 0)} élève(s)</span>
          <span class="chip chip-teacher">${formatAmount(m.teacher_count || 0)} enseignant(s)</span>
        </div>
        <div class="entity-actions">
          <button class="btn btn-light btn-sm" data-matiere-detail="${m.id}">${ICONS.eye} Détail</button>
          <button class="btn-icon" data-edit-matiere="${m.id}" title="Modifier">${ICONS.edit}</button>
          <button class="btn-icon is-danger" data-del-matiere="${m.id}" title="Supprimer">${ICONS.trash}</button>
        </div>
      </div>`
      )
      .join('');

    grid.querySelectorAll('[data-matiere-detail]').forEach((b) =>
      b.addEventListener('click', () => openMatiereDetail(parseInt(b.dataset.matiereDetail, 10)))
    );
    grid.querySelectorAll('[data-edit-matiere]').forEach((b) =>
      b.addEventListener('click', () => startEditMatiere(parseInt(b.dataset.editMatiere, 10)))
    );
    grid.querySelectorAll('[data-del-matiere]').forEach((b) =>
      b.addEventListener('click', () => deleteMatiere(parseInt(b.dataset.delMatiere, 10)))
    );
  }

  async function deleteMatiere(id) {
    const m = allMatieres.find((x) => x.id === id);
    if (!m) return;
    if (!confirm(`Supprimer la matière « ${m.nom} » ?\n\nSes cours, inscriptions et paiements seront également supprimés.`)) return;
    await window.api.deleteMatiere(id);
    await refreshMatieresData();
    await afterDataChange();
  }

  // --- Formulaire matière ---
  function resetMatiereForm() {
    editingMatiereId = null;
    $('#editing-matiere-id').value = '';
    $('#matiere-form').reset();
    $('#matiere-form-title').textContent = 'Nouvelle matière';
    $('#btn-save-matiere').innerHTML = `${ICONS.plus} Ajouter`;
    $('#btn-cancel-matiere-edit').style.display = 'none';
  }

  function startEditMatiere(id) {
    const m = allMatieres.find((x) => x.id === id);
    if (!m) return;
    editingMatiereId = id;
    $('#editing-matiere-id').value = String(id);
    $('#new-matiere-nom').value = m.nom;
    $('#new-matiere-prix').value = m.prix_mensuel || '';
    $('#new-matiere-desc').value = m.description || '';
    $('#matiere-form-title').textContent = 'Modifier la matière';
    $('#btn-save-matiere').textContent = 'Enregistrer';
    $('#btn-cancel-matiere-edit').style.display = '';
    showView('matieres');
    $('#new-matiere-nom').focus();
  }

  $('#matiere-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      nom: $('#new-matiere-nom').value.trim(),
      description: $('#new-matiere-desc').value.trim(),
      prix_mensuel: $('#new-matiere-prix').value
    };
    if (!payload.nom) return;
    const res = editingMatiereId
      ? await window.api.updateMatiere({ ...payload, id: editingMatiereId })
      : await window.api.addMatiere(payload);
    if (!res.success) {
      alert(res.error || 'Enregistrement impossible.');
      return;
    }
    resetMatiereForm();
    await refreshMatieresData();
    await afterDataChange();
  });

  $('#btn-cancel-matiere-edit').addEventListener('click', resetMatiereForm);

  // --- Création d'un cours ---
  $('#assign-matiere').addEventListener('change', () => {
    const m = allMatieres.find((x) => String(x.id) === $('#assign-matiere').value);
    if (m && !$('#assign-prix').value) $('#assign-prix').value = m.prix_mensuel || '';
  });

  $('#assign-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const matiereId = parseInt($('#assign-matiere').value, 10);
    const teacherId = parseInt($('#assign-teacher').value, 10);
    if (!matiereId || !teacherId) {
      alert('Choisissez une matière et un enseignant.');
      return;
    }
    const res = await window.api.addMatiereTeacher({
      matiere_id: matiereId,
      teacher_id: teacherId,
      prix_mensuel: $('#assign-prix').value
    });
    if (!res.success) {
      alert(res.error || 'Création impossible.');
      return;
    }
    $('#assign-matiere').disabled = false;
    $('#assign-teacher').disabled = false;
    $('#assign-prix').value = '';
    await refreshMatieresData();
    await afterDataChange();
  });

  // ============================================================
  //  ENSEIGNANTS
  // ============================================================

  function renderTeachersView() {
    const grid = $('#teachers-list');
    const vide = $('#teachers-empty');
    const count = $('#teachers-count');
    if (count) count.textContent = allTeachers.length;
    if (!grid) return;

    const q = ($('#teachers-search').value || '').trim().toLowerCase();
    const rows = q
      ? allTeachers.filter((t) => `${t.full_name} ${t.code} ${t.specialite} ${t.email}`.toLowerCase().includes(q))
      : allTeachers;

    if (vide) vide.style.display = rows.length ? 'none' : 'block';

    grid.innerHTML = rows
      .map(
        (t) => `
      <div class="entity-card">
        <div class="entity-card-head">
          <span class="entity-icon">${ICONS.user}</span>
          <div>
            <div class="entity-title">${escapeHtml(t.full_name || t.nom)}</div>
            <div class="entity-sub">${escapeHtml(t.code)}${t.specialite ? ' · ' + escapeHtml(t.specialite) : ''}</div>
          </div>
        </div>
        <div class="entity-tags">
          <span class="chip">${formatAmount(t.matiere_count || 0)} cours</span>
          <span class="chip">${formatAmount(t.student_count || 0)} élève(s)</span>
          <span class="chip chip-money">${formatAmount(t.revenus_annee)} DA</span>
        </div>
        <div class="entity-actions">
          <button class="btn btn-light btn-sm" data-teacher-detail="${t.id}">${ICONS.eye} Fiche</button>
          <button class="btn-icon" data-edit-teacher="${t.id}" title="Modifier">${ICONS.edit}</button>
          <button class="btn-icon is-danger" data-del-teacher="${t.id}" title="Supprimer">${ICONS.trash}</button>
        </div>
      </div>`
      )
      .join('');

    grid.querySelectorAll('[data-teacher-detail]').forEach((b) =>
      b.addEventListener('click', () => openTeacherDetail(parseInt(b.dataset.teacherDetail, 10)))
    );
    grid.querySelectorAll('[data-edit-teacher]').forEach((b) =>
      b.addEventListener('click', () => startEditTeacher(parseInt(b.dataset.editTeacher, 10)))
    );
    grid.querySelectorAll('[data-del-teacher]').forEach((b) =>
      b.addEventListener('click', () => deleteTeacher(parseInt(b.dataset.delTeacher, 10)))
    );
  }

  async function openTeacherDetail(id) {
    const t = await window.api.teacherDetail(id);
    if (!t) return;
    const eleves = await window.api.listStudentsForTeacher(id);
    const annee = new Date().getFullYear();

    const body = `
      <div class="detail-grid">
        <div class="detail-item"><span>Code</span><b>${escapeHtml(t.code)}</b></div>
        <div class="detail-item"><span>Spécialité</span><b>${escapeHtml(t.specialite || '—')}</b></div>
        <div class="detail-item"><span>Téléphone</span><b>${escapeHtml(t.telephone || '—')}</b></div>
        <div class="detail-item"><span>Email</span><b>${escapeHtml(t.email || '—')}</b></div>
        <div class="detail-item"><span>Élèves</span><b>${formatAmount(t.nb_eleves)}</b></div>
        <div class="detail-item"><span>Encaissé ${annee}</span><b>${formatAmount(t.encaissement_annee)} DA</b></div>
      </div>

      <h3 class="detail-h3">Ses cours</h3>
      ${
        t.cours.length
          ? `<div class="entity-tags">${t.cours
              .map(
                (c) =>
                  `<span class="chip chip-teacher">${escapeHtml(c.matiere_nom)} — ${c.prix_mensuel ? formatAmount(c.prix_mensuel) + ' DA' : '—'} · ${formatAmount(c.student_count)} élève(s)</span>`
              )
              .join('')}</div>`
          : '<p class="hint-inline">Aucun cours pour cet enseignant.</p>'
      }

      <h3 class="detail-h3">Ses élèves</h3>
      ${
        eleves.length
          ? `<table class="mini-table">
              <thead><tr><th>Matricule</th><th>Nom</th><th>Classe</th><th>Matière</th></tr></thead>
              <tbody>${eleves
                .map(
                  (s) => `<tr>
                    <td><b>${escapeHtml(s.matricule)}</b></td>
                    <td>${escapeHtml(s.prenom)} ${escapeHtml(s.nom)}</td>
                    <td>${escapeHtml(s.classe || '—')}</td>
                    <td>${escapeHtml(s.matiere_nom || '—')}</td>
                  </tr>`
                )
                .join('')}</tbody>
            </table>`
          : '<p class="empty-inline">Aucun élève inscrit à ses cours.</p>'
      }`;

    openMatiereModal(`${escapeHtml(t.full_name || t.nom)} — ${t.cours.length} cours`, body);
    $('#btn-print-matiere-report').style.display = 'none';
  }

  function resetTeacherForm() {
    editingTeacherId = null;
    $('#teacher-form').reset();
    $('#teacher-form-title').textContent = 'Nouvel enseignant';
    $('#btn-save-teacher').innerHTML = `${ICONS.plus} Ajouter`;
    $('#btn-cancel-teacher-edit').style.display = 'none';
    refreshNextTeacherCode();
  }

  async function refreshNextTeacherCode() {
    const code = await window.api.nextTeacherCode();
    $('#new-teacher-code-display').value = code || '';
  }

  function startEditTeacher(id) {
    const t = allTeachers.find((x) => x.id === id);
    if (!t) return;
    editingTeacherId = id;
    $('#new-teacher-prenom').value = t.prenom || '';
    $('#new-teacher-nom').value = t.nom || '';
    $('#new-teacher-code-display').value = t.code || '';
    $('#new-teacher-specialite').value = t.specialite || '';
    $('#new-teacher-tel').value = t.telephone || '';
    $('#new-teacher-email').value = t.email || '';
    $('#teacher-form-title').textContent = `Modifier ${t.full_name || t.nom}`;
    $('#btn-save-teacher').textContent = 'Enregistrer';
    $('#btn-cancel-teacher-edit').style.display = '';
    $('#new-teacher-nom').focus();
  }

  async function deleteTeacher(id) {
    const t = allTeachers.find((x) => x.id === id);
    if (!t) return;
    if (!confirm(`Supprimer l'enseignant « ${t.full_name || t.nom} » ?\n\nSes cours et les inscriptions correspondantes seront supprimés.`)) return;
    await window.api.deleteTeacher(id);
    await refreshMatieresData();
    await afterDataChange();
    resetTeacherForm();
  }

  $('#teacher-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      prenom: $('#new-teacher-prenom').value.trim(),
      nom: $('#new-teacher-nom').value.trim(),
      specialite: $('#new-teacher-specialite').value.trim(),
      telephone: $('#new-teacher-tel').value.trim(),
      email: $('#new-teacher-email').value.trim()
    };
    if (!payload.nom && !payload.prenom) return;
    const res = editingTeacherId
      ? await window.api.updateTeacher({ ...payload, id: editingTeacherId })
      : await window.api.addTeacher(payload);
    if (!res.success) {
      alert(res.error || 'Enregistrement impossible.');
      return;
    }
    resetTeacherForm();
    await refreshMatieresData();
    await afterDataChange();
  });

  $('#btn-cancel-teacher-edit').addEventListener('click', resetTeacherForm);
  $('#teachers-search').addEventListener('input', renderTeachersView);

  // ============================================================
  //  FORMULAIRE D'INSCRIPTION
  // ============================================================

  function resetForm() {
    editingStudent = null;
    pendingPhotoPath = null;
    formEnrollments = new Map();
    $('#student-form').reset();
    $('#f-id').value = '';
    $('#f-existing-photo').value = '';
    $('#f-matricule').value = '—';
    $('#f-date-inscription').value = formatTodayDDMMYYYY();
    $('#photo-preview').innerHTML = `<span class="photo-placeholder-icon" data-icon="camera"></span>`;
    applyStaticIcons($('#photo-preview'));
    $('#btn-remove-photo').style.display = 'none';
    $('#btn-cancel-edit').style.display = 'none';
    $('#inscription-title').textContent = "Inscription d'un étudiant";
    $('#btn-save-student').textContent = "Enregistrer l'étudiant";
    $('#form-message').textContent = '';
    renderMatiereChecklist();
    refreshPreviewMatricule();
  }

  async function refreshPreviewMatricule() {
    if (editingStudent) return;
    const annee = yearFromDisplayDate($('#f-date-inscription').value);
    const m = await window.api.previewMatricule(annee);
    $('#f-matricule').value = m || '—';
  }

  /** Liste des matières avec, pour chacune, les enseignants qui l'assurent. */
  function renderMatiereChecklist() {
    const box = $('#f-matieres-list');
    if (!box) return;
    if (!allCours.length) {
      box.innerHTML = '<p class="hint-inline">Créez d\'abord un cours (page Matières) pour pouvoir inscrire des élèves.</p>';
      return;
    }

    const parMatiere = new Map();
    allCours.forEach((c) => {
      if (!parMatiere.has(c.matiere_id)) parMatiere.set(c.matiere_id, { nom: c.matiere_nom, profs: [] });
      parMatiere.get(c.matiere_id).profs.push(c);
    });

    box.innerHTML = Array.from(parMatiere.entries())
      .map(([matiereId, info]) => {
        const choisis = formEnrollments.get(matiereId) || new Set();
        return `
        <div class="check-matiere">
          <div class="check-matiere-head">
            <label class="checkbox-label">
              <input type="checkbox" data-matiere-check="${matiereId}" ${choisis.size ? 'checked' : ''} />
              <b>${escapeHtml(info.nom)}</b>
            </label>
          </div>
          <div class="check-prof-list">
            ${info.profs
              .map(
                (c) => `<label class="checkbox-label is-sub">
                  <input type="checkbox" data-prof-check="${matiereId}" value="${c.teacher_id}" ${choisis.has(String(c.teacher_id)) ? 'checked' : ''} />
                  <span>${escapeHtml(c.teacher_full_name)} — ${c.prix_mensuel ? formatAmount(c.prix_mensuel) + ' DA' : 'prix non défini'}</span>
                </label>`
              )
              .join('')}
          </div>
        </div>`;
      })
      .join('');

    box.querySelectorAll('[data-prof-check]').forEach((cb) => {
      cb.addEventListener('change', () => {
        const matiereId = cb.dataset.profCheck;
        if (!formEnrollments.has(matiereId)) formEnrollments.set(matiereId, new Set());
        const set = formEnrollments.get(matiereId);
        if (cb.checked) set.add(cb.value);
        else set.delete(cb.value);
        if (!set.size) formEnrollments.delete(matiereId);
        const head = box.querySelector(`[data-matiere-check="${matiereId}"]`);
        if (head) head.checked = formEnrollments.has(matiereId);
      });
    });

    box.querySelectorAll('[data-matiere-check]').forEach((cb) => {
      cb.addEventListener('change', () => {
        const matiereId = cb.dataset.matiereCheck;
        const profs = $$(`[data-prof-check="${matiereId}"]`, box);
        if (cb.checked) {
          const set = new Set();
          profs.forEach((p) => {
            p.checked = true;
            set.add(p.value);
          });
          formEnrollments.set(matiereId, set);
        } else {
          profs.forEach((p) => {
            p.checked = false;
          });
          formEnrollments.delete(matiereId);
        }
      });
    });
  }

  function selectionsFromForm() {
    return Array.from(formEnrollments.entries()).map(([matiere_id, set]) => ({
      matiere_id: parseInt(matiere_id, 10),
      teacher_ids: Array.from(set)
    }));
  }

  async function loadFormEnrollments(studentId) {
    const rows = await window.api.getStudentMatieres(studentId);
    formEnrollments = new Map();
    rows.forEach((r) => {
      const key = String(r.matiere_id);
      if (!formEnrollments.has(key)) formEnrollments.set(key, new Set());
      if (r.teacher_id) formEnrollments.get(key).add(String(r.teacher_id));
      else formEnrollments.get(key).add('');
    });
    renderMatiereChecklist();
  }

  $('#btn-choose-photo').addEventListener('click', async () => {
    const p = await window.api.selectPhoto();
    if (!p) return;
    pendingPhotoPath = p;
    $('#photo-preview').innerHTML = `<img class="photo-img" src="${escapeHtml(photoUrl(p.split(/[\\/]/).pop()))}" alt="" />`;
    $('#btn-remove-photo').style.display = '';
  });

  $('#btn-remove-photo').addEventListener('click', () => {
    pendingPhotoPath = null;
    $('#f-existing-photo').value = '';
    $('#photo-preview').innerHTML = `<span class="photo-placeholder-icon" data-icon="camera"></span>`;
    applyStaticIcons($('#photo-preview'));
    $('#btn-remove-photo').style.display = 'none';
  });

  attachDateMask($('#f-date-inscription'));
  attachDateMask($('#f-date-naissance'));
  $('#f-date-inscription').addEventListener('change', refreshPreviewMatricule);

  $('#student-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = $('#form-message');
    message.textContent = '';
    message.className = 'form-message';

    const payload = {
      nom: $('#f-nom').value.trim(),
      prenom: $('#f-prenom').value.trim(),
      classe: $('#f-classe').value.trim(),
      date_naissance: $('#f-date-naissance').value.trim(),
      telephone: $('#f-telephone').value.trim(),
      telephone_parent: $('#f-telephone-parent').value.trim(),
      adresse: $('#f-adresse').value.trim(),
      date_inscription: $('#f-date-inscription').value.trim() || formatTodayDDMMYYYY()
    };
    if (!payload.nom || !payload.prenom) {
      message.textContent = 'Le nom et le prénom sont obligatoires.';
      message.classList.add('is-error');
      return;
    }

    const dateInsc = toIsoDate(payload.date_inscription);
    if (!dateInsc) {
      message.textContent = "La date d'inscription doit être au format jj/mm/aaaa.";
      message.classList.add('is-error');
      return;
    }

    let studentId;
    let matricule;

    if (editingStudent) {
      const res = await window.api.updateStudent({
        ...payload,
        id: editingStudent.id,
        matricule: editingStudent.matricule,
        existingPhoto: $('#f-existing-photo').value,
        photoTempPath: pendingPhotoPath,
        removePhoto: pendingPhotoPath === null && !$('#f-existing-photo').value
      });
      if (!res.success) {
        message.textContent = res.error || 'Mise à jour impossible.';
        message.classList.add('is-error');
        return;
      }
      studentId = editingStudent.id;
      matricule = editingStudent.matricule;
      await window.api.setStudentMatieres({
        student_id: studentId,
        selections: selectionsFromForm(),
        date_inscription: payload.date_inscription
      });
    } else {
      const res = await window.api.addStudent({ ...payload, photoTempPath: pendingPhotoPath });
      if (!res.success) {
        message.textContent = res.error || 'Enregistrement impossible.';
        message.classList.add('is-error');
        return;
      }
      studentId = res.id;
      matricule = res.matricule;
      await window.api.setStudentMatieres({
        student_id: studentId,
        selections: selectionsFromForm(),
        date_inscription: payload.date_inscription
      });
    }

    resetForm();
    matieresByStudent = await window.api.studentMatieresMap();
    await refreshMatieresData();
    await afterDataChange();
    openSuccessModal(matricule);
  });

  $('#btn-cancel-edit').addEventListener('click', () => {
    resetForm();
    showView('etudiants');
  });

  function startEditStudent(id) {
    showView('inscription');
    (async () => {
      const s = await window.api.getStudent(id);
      if (!s) return;
      editingStudent = { id: s.id, matricule: s.matricule, photo: s.photo };
      $('#f-id').value = String(s.id);
      $('#f-matricule').value = s.matricule;
      $('#f-existing-photo').value = s.photo || '';
      $('#f-nom').value = s.nom || '';
      $('#f-prenom').value = s.prenom || '';
      $('#f-classe').value = s.classe || '';
      $('#f-date-naissance').value = s.date_naissance || '';
      $('#f-telephone').value = s.telephone || '';
      $('#f-telephone-parent').value = s.telephone_parent || '';
      $('#f-adresse').value = s.adresse || '';
      $('#f-date-inscription').value = s.date_inscription || '';
      pendingPhotoPath = null;
      $('#photo-preview').innerHTML = s.photo
        ? `<img class="photo-img" src="${escapeHtml(photoUrl(s.photo))}" alt="" />`
        : `<span class="photo-placeholder-icon" data-icon="camera"></span>`;
      applyStaticIcons($('#photo-preview'));
      $('#btn-remove-photo').style.display = s.photo ? '' : 'none';
      $('#btn-cancel-edit').style.display = '';
      $('#inscription-title').textContent = `Modifier ${s.prenom} ${s.nom}`;
      $('#btn-save-student').textContent = 'Enregistrer les modifications';
      await loadFormEnrollments(s.id);
      $('#f-nom').focus();
    })();
  }

  // ============================================================
  //  LISTE DES ÉTUDIANTS
  // ============================================================

  const STUDENT_FILTER_IDS = [
    'search-input',
    'filter-nom-etudiants',
    'filter-prenom-etudiants',
    'filter-classe-etudiants',
    'filter-matiere-etudiants',
    'filter-teacher-etudiants',
    'filter-date-field',
    'filter-date-from',
    'filter-date-to',
    'statut-matiere',
    'statut-mois',
    'statut-annee',
    'statut-etat'
  ];

  function currentStudentFilters() {
    return {
      search: $('#search-input').value,
      nom: $('#filter-nom-etudiants').value,
      prenom: $('#filter-prenom-etudiants').value,
      classe: $('#filter-classe-etudiants').value,
      matiere_id: $('#filter-matiere-etudiants').value,
      teacher_id: $('#filter-teacher-etudiants').value,
      date_field: $('#filter-date-field').value,
      date_from: $('#filter-date-from').value,
      date_to: $('#filter-date-to').value,
      paiement_matiere: $('#statut-matiere').value,
      paiement_mois: $('#statut-mois').value,
      paiement_annee: $('#statut-annee').value,
      statut: $('#statut-etat').value
    };
  }

  /** Recharge la colonne « Statut » (par professeur, pour la matière/mois choisis). */
  async function refreshStatutPaiement() {
    const matiereId = $('#statut-matiere').value;
    const mois = $('#statut-mois').value;
    const annee = $('#statut-annee').value;
    if (!matiereId || !mois) {
      mapStatutPaiement = {};
      return;
    }
    mapStatutPaiement = await window.api.paiementsEtatEleves({
      matiere_id: matiereId,
      annee: annee || anneeTravail,
      mois
    });
  }

  async function refreshStudentList() {
    const filters = currentStudentFilters();
    filters.sort = stateStudentSort.champ;
    filters.dir = stateStudentSort.dir;
    // Le filtre d'état n'a de sens qu'avec une matière, un mois et une année.
    if (!filters.paiement_matiere || !filters.paiement_mois || !filters.paiement_annee) filters.statut = '';

    paintSortIndicators('#students-head', '[data-sort]', stateStudentSort);
    updateStudentsFilterHint();

    matieresByStudent = await window.api.studentMatieresMap();
    await refreshStatutPaiement();

    const students = await window.api.listStudents(filters);
    allStudentsCache = students;
    renderStudentTable(students);
  }

  function renderStudentTable(students) {
    const tbody = $('#students-tbody');
    const vide = $('#empty-state');
    const count = $('#students-results-count');
    if (count) {
      count.textContent = `${students.length} résultat${students.length > 1 ? 's' : ''}`;
    }
    if (vide) vide.style.display = students.length ? 'none' : 'block';
    if (!students.length) {
      tbody.innerHTML = '';
      return;
    }

    tbody.innerHTML = students
      .map(
        (s) => `
      <tr data-student-id="${s.id}">
        <td class="col-avatar"><div class="row-avatar">${avatarHtml(s)}</div></td>
        <td><b>${escapeHtml(s.matricule)}</b></td>
        <td>${escapeHtml(s.nom)}</td>
        <td>${escapeHtml(s.prenom)}</td>
        <td>${escapeHtml(s.date_naissance || '—')}</td>
        <td>${escapeHtml(s.classe || '—')}</td>
        <td><div class="chip-row">${renderMatiereChips(s.id)}</div></td>
        <td data-statut-cell>${renderStatutCell(s.id)}</td>
        <td>${escapeHtml(s.date_inscription || '—')}</td>
        <td>${escapeHtml(s.telephone_parent || '—')}</td>
        <td class="actions-cell">
          <button class="btn-icon" data-edit="${s.id}" title="Modifier">${ICONS.edit}</button>
          <button class="btn-icon" data-card="${s.id}" title="Voir la carte">${ICONS.idcard}</button>
          <button class="btn-icon is-danger" data-del="${s.id}" title="Supprimer">${ICONS.trash}</button>
        </td>
      </tr>`
      )
      .join('');

    // --- Actions ---
    tbody.querySelectorAll('[data-edit]').forEach((b) =>
      b.addEventListener('click', () => startEditStudent(parseInt(b.dataset.edit, 10)))
    );
    tbody.querySelectorAll('[data-card]').forEach((b) =>
      b.addEventListener('click', () => openCardModal(parseInt(b.dataset.card, 10)))
    );
    tbody.querySelectorAll('[data-del]').forEach((b) =>
      b.addEventListener('click', () => askDeleteStudent(parseInt(b.dataset.del, 10)))
    );

    // --- Clic sur un jeton de statut : la grille de CE cours ---
    tbody.querySelectorAll('.statut-pill').forEach((pill) => {
      pill.addEventListener('click', () =>
        openGrilleEleve(
          parseInt(pill.dataset.statutStudent, 10),
          parseInt($('#statut-matiere').value, 10),
          parseInt(pill.dataset.statutTeacher, 10),
          parseInt($('#statut-annee').value, 10) || anneeTravail
        )
      );
    });
  }

  function renderMatiereChips(studentId) {
    const matieres = matieresByStudent[studentId] || [];
    if (!matieres.length) return '<span class="hint-inline">—</span>';
    return matieres.map((n) => `<span class="chip">${escapeHtml(n)}</span>`).join('');
  }

  function renderStatutCell(studentId) {
    const etats = mapStatutPaiement[studentId] || [];
    if (!etats.length) return '<span class="hint-inline">choisir une matière et un mois</span>';
    return `<div class="statut-cell">${etats
      .map(
        (e) => `<button class="statut-pill ${e.paye ? 'is-paye' : 'is-impaye'}"
          data-statut-student="${studentId}" data-statut-teacher="${e.teacher_id}"
          title="${e.paye ? 'Payé — voir le détail' : 'Impayé — voir le détail'}">
          ${e.paye ? '✓' : '✕'} ${escapeHtml(e.teacher_nom)}
        </button>`
      )
      .join('')}</div>`;
  }

  function updateStudentsFilterHint() {
    const hint = $('#students-filters-hint');
    if (!hint) return;
    const f = currentStudentFilters();
    const labels = {
      search: 'Recherche',
      nom: 'Nom',
      prenom: 'Prénom',
      classe: 'Classe',
      matiere_id: 'Matière',
      teacher_id: 'Enseignant',
      date_from: 'Date (depuis)',
      date_to: 'Date (jusqu\'au)',
      paiement_matiere: 'Matière (statut)',
      paiement_mois: 'Mois',
      paiement_annee: 'Année',
      statut: 'Paiement'
    };
    const active = [];
    Object.keys(labels).forEach((k) => {
      if (f[k]) {
        const valeur = k === 'statut' ? (f[k] === 'impaye' ? 'Impayés' : 'Payés') : f[k];
        active.push(`${labels[k]} : ${escapeHtml(valeur)}`);
      }
    });
    hint.innerHTML = active.length ? 'Filtres actifs — ' + active.join(' · ') : '';
  }

  function setupStudentSorting() {
    $$('#students-head .sortable').forEach((th) => {
      th.addEventListener('click', () => {
        const champ = th.dataset.sort;
        stateStudentSort =
          stateStudentSort.champ === champ
            ? { champ, dir: stateStudentSort.dir === 'asc' ? 'desc' : 'asc' }
            : { champ, dir: 'asc' };
        refreshStudentList();
      });
    });
    paintSortIndicators('#students-head', '[data-sort]', stateStudentSort);
  }

  // --- Filtres ---

  function populateFilterSelects() {
    const classes = allClasses
      .map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
      .join('');

    ['#filter-classe-etudiants', '#filter-classe-cartes'].forEach((sel) => {
      const el = $(sel);
      if (el) el.innerHTML = `<option value="">${sel === '#filter-classe-cartes' ? 'Toutes les classes' : 'Toutes les classes'}</option>${classes}`;
    });

    const matieres = allMatieres.map((m) => `<option value="${m.id}">${escapeHtml(m.nom)}</option>`).join('');
    ['#filter-matiere-etudiants', '#statut-matiere', '#filter-matiere-cartes'].forEach((sel) => {
      const el = $(sel);
      if (el) {
        el.innerHTML = sel === '#statut-matiere' ? `<option value="">-- matière --</option>${matieres}` : `<option value="">Toutes les matières</option>${matieres}`;
      }
    });

    const profs = allTeachers.map((t) => `<option value="${t.id}">${escapeHtml(teacherLabel(t))}</option>`).join('');
    const elT = $('#filter-teacher-etudiants');
    if (elT) elT.innerHTML = `<option value="">Tous les enseignants</option>${profs}`;

    const dl = $('#f-classe-options');
    if (dl) dl.innerHTML = allClasses.map((c) => `<option value="${escapeHtml(c)}"></option>`).join('');

    // Sélecteurs de paiement : matière → enseignant (l'ordre demandé).
    const payM = $('#pay-matiere');
    if (payM) payM.innerHTML = `<option value="">-- matière --</option>${matieres}`;
    refreshPayTeacherOptions();
  }

  function refreshPayTeacherOptions() {
    const sel = $('#pay-teacher');
    if (!sel) return;
    const matiereId = $('#pay-matiere').value;
    const cours = matiereId ? allCours.filter((c) => String(c.matiere_id) === matiereId) : allCours;
    sel.innerHTML =
      `<option value="">-- enseignant --</option>` +
      cours.map((c) => `<option value="${c.teacher_id}">${escapeHtml(c.teacher_full_name)}</option>`).join('');
  }

  let searchDebounce = null;
  function onFilterChanged(immediate) {
    if (searchDebounce) clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      updateStudentsFilterHint();
      refreshStudentList();
    }, immediate ? 0 : 220);
  }

  STUDENT_FILTER_IDS.forEach((id) => {
    const el = $('#' + id);
    if (!el) return;
    const evt = el.tagName === 'SELECT' || el.type === 'date' ? 'change' : 'input';
    el.addEventListener(evt, () => onFilterChanged());
  });

  $('#btn-reset-students-filters').addEventListener('click', () => {
    STUDENT_FILTER_IDS.forEach((id) => {
      const el = $('#' + id);
      if (!el) return;
      // On revient à la première option « vide », pas à la première option
      // réelle : sinon on applique un filtre au lieu de tout effacer.
      el.value = el.tagName === 'SELECT' ? (el.options[0] ? el.options[0].value : '') : '';
    });
    stateStudentSort = { champ: 'nom', dir: 'asc' };
    onFilterChanged(true);
  });

  $('#btn-toggle-students-filters').addEventListener('click', () => {
    const body = $('#students-filters-body');
    if (!body) return;
    const ouvert = body.classList.toggle('is-open');
    $('#btn-toggle-students-filters').textContent = ouvert ? 'Filtres ▴' : 'Filtres ▾';
  });

  // ============================================================
  /**
   * Grille annuelle d'un élève pour UN cours : c'est le clic sur « why is this
   * student unpaid » — on ouvre son tableau des 12 mois, cliquable.
   */
  let grilleEleveData = null;

  async function openGrilleEleve(studentId, matiereId, teacherId, annee) {
    const data = await window.api.paiementsGrilleEleve({
      student_id: studentId,
      matiere_id: matiereId,
      teacher_id: teacherId,
      annee
    });
    if (!data) return;
    grilleEleveData = data;

    const moisCourant = new Date().getFullYear() === data.annee ? new Date().getMonth() + 1 : 0;
    const payes = data.mois.filter((m) => m.paye).length;
    const total = data.mois.filter((m) => m.paye).reduce((s, m) => s + m.montant, 0);

    $('#grille-eleve-title').textContent =
      `${data.etudiant.prenom} ${data.etudiant.nom} (${data.etudiant.matricule})`;

    $('#grille-eleve-body').innerHTML = `
      <div class="detail-grid">
        <div class="detail-item"><span>Cours</span><b>${escapeHtml(data.cours.matiere_nom)}</b></div>
        <div class="detail-item"><span>Enseignant</span><b>${escapeHtml(data.cours.teacher_full_name)}</b></div>
        <div class="detail-item"><span>Classe</span><b>${escapeHtml(data.etudiant.classe || '—')}</b></div>
        <div class="detail-item"><span>Tarif mensuel</span><b>${data.prix ? formatAmount(data.prix) + ' DA' : '—'}</b></div>
        <div class="detail-item"><span>Année</span><b>${data.annee}</b></div>
        <div class="detail-item"><span>Total réglé</span><b>${formatAmount(total)} DA</b></div>
      </div>
      <p class="hint-inline">Cliquez un mois pour le marquer payé ou le décocher.</p>
      <div class="mois-grille">
        ${data.mois
          .map((m) => {
            const futur = moisCourant && m.mois > moisCourant;
            return `<button class="mois-cell ${m.paye ? 'is-paye' : 'is-impaye'} ${m.mois === moisCourant ? 'is-current' : ''} ${futur ? 'is-future' : ''}"
              data-mois="${m.mois}" ${futur ? 'disabled' : ''}
              title="${m.paye ? 'Payé le ' + escapeHtml(m.date_paiement || '') : 'Non payé'}">
              <span class="mois-nom">${MOIS_COURTS[m.mois - 1]}</span>
              <span class="mois-mark">${m.paye ? '✓' : ''}</span>
              <span class="mois-amount">${formatAmount(m.montant)}</span>
            </button>`;
          })
          .join('')}
      </div>
      <p class="hint-inline">${payes} mois réglé(s) sur 12 — ${12 - payes} restant(s).</p>`;

    $('#grille-eleve-body')
      .querySelectorAll('.mois-cell:not([disabled])')
      .forEach((cell) => {
        cell.addEventListener('click', async () => {
          const mois = parseInt(cell.dataset.mois, 10);
          const courant = data.mois[mois - 1];
          await window.api.togglePayment({
            student_id: data.etudiant.id,
            matiere_id: data.cours.matiere_id,
            teacher_id: data.cours.teacher_id,
            annee: data.annee,
            mois,
            paye: !courant.paye,
            montant: courant.montant
          });
          await refreshStudentList();
          openGrilleEleve(data.etudiant.id, data.cours.matiere_id, data.cours.teacher_id, data.annee);
        });
      });

    $('#grille-eleve-overlay').classList.add('active');
  }

  $('#btn-close-grille-eleve').addEventListener('click', () => {
    $('#grille-eleve-overlay').classList.remove('active');
  });
  $('#btn-close-grille-eleve-2').addEventListener('click', () => {
    $('#grille-eleve-overlay').classList.remove('active');
  });

  // ============================================================
  //  SUPPRESSION D'UN ÉLÈVE
  // ============================================================

  let pendingDeleteId = null;

  function askDeleteStudent(id) {
    pendingDeleteId = id;
    const s = allStudentsCache.find((x) => x.id === id);
    $('#confirm-text').innerHTML = `Supprimer <b>${escapeHtml(s ? s.prenom + ' ' + s.nom : 'cet étudiant')}</b> ?<br />
      <span class="hint-inline">Ses cours, ses paiements et sa photo seront également supprimés.</span>`;
    $('#confirm-modal-overlay').classList.add('active');
  }

  $('#btn-cancel-delete').addEventListener('click', () => {
    $('#confirm-modal-overlay').classList.remove('active');
    pendingDeleteId = null;
  });

  $('#btn-confirm-delete').addEventListener('click', async () => {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    pendingDeleteId = null;
    $('#confirm-modal-overlay').classList.remove('active');
    await window.api.deleteStudent(id);
    await refreshMatieresData();
    await afterDataChange();
    await refreshStudentList();
  });

  // ============================================================
  //  PAIEMENTS
  // ============================================================

  function refreshPayFilters() {
    $('#pay-matiere').addEventListener('change', () => {
      refreshPayTeacherOptions();
      payState.matiere_id = $('#pay-matiere').value ? parseInt($('#pay-matiere').value, 10) : null;
      payState.teacher_id = $('#pay-teacher').value ? parseInt($('#pay-teacher').value, 10) : null;
      payState.data = null;
      refreshPayments();
    });
    $('#pay-teacher').addEventListener('change', () => {
      payState.teacher_id = $('#pay-teacher').value ? parseInt($('#pay-teacher').value, 10) : null;
      refreshPayments();
    });
    $('#pay-mois-courant').addEventListener('change', () => {
      payState.mois = parseInt($('#pay-mois-courant').value, 10);
      renderPayGrid();
    });
    $('#pay-annee').addEventListener('change', async (e) => {
      payState.annee = parseInt(e.target.value, 10);
      // Retenir l'année de travail : c'est elle que l'application rouvrira.
      await window.api.definirAnnee(payState.annee);
      anneeTravail = payState.annee;
      const statutAnnee = $('#statut-annee');
      if (statutAnnee) statutAnnee.value = String(payState.annee);
      refreshPayments();
      refreshStudentList();
    });
  }

  async function refreshPayments() {
    const head = $('#pay-grid-head');
    const body = $('#pay-grid-body');
    const vide = $('#pay-empty-state');
    if (!head || !body) return;

    if (!payState.matiere_id || !payState.teacher_id) {
      payState.data = null;
      head.innerHTML = '';
      body.innerHTML = '';
      if (vide) vide.style.display = 'none';
      $('#pay-summary').innerHTML = '<span class="hint-inline">Choisissez une matière puis un enseignant pour afficher la grille.</span>';
      $('#pay-grid-title').textContent = 'Grille des paiements';
      $('#pay-grid-total').textContent = '';
      return;
    }

    const data = await window.api.paymentsGrid({
      matiere_id: payState.matiere_id,
      teacher_id: payState.teacher_id,
      annee: payState.annee
    });
    payState.data = data;

    $('#pay-grid-title').textContent = `Grille — ${data.cours.matiere_nom} · ${data.cours.teacher_full_name}`;
    $('#pay-grid-total').textContent = `${data.students.length} élève(s)`;

    if (!data.students.length) {
      head.innerHTML = '';
      body.innerHTML = '';
      if (vide) vide.style.display = 'block';
      $('#pay-summary').innerHTML = '<span class="hint-inline">Aucun élève inscrit à ce cours.</span>';
      return;
    }
    if (vide) vide.style.display = 'none';

    head.innerHTML = `<tr>
      <th>Matricule</th><th>Nom</th><th>Classe</th>
      ${MOIS_COURTS.map((m) => `<th class="is-num">${m}</th>`).join('')}
      <th class="is-num">Total</th><th></th>
    </tr>`;

    const prix = data.cours.prix_mensuel || 0;

    body.innerHTML = data.students
      .map((s) => {
        const cells = MOIS_COURTS.map((m, i) => {
          const p = s.payments[i + 1];
          const paye = !!(p && p.paye);
          return `<td class="pay-cell ${paye ? 'is-paye' : 'is-impaye'} ${i + 1 === payState.mois ? 'is-current' : ''}"
            data-student="${s.id}" data-mois="${i + 1}" title="${paye ? 'Payé le ' + (p.date_paiement || '') : 'Non payé'}">
            ${paye ? '✓' : ''}
          </td>`;
        }).join('');
        const rowPayes = Object.values(s.payments).filter((p) => p.paye).length;
        return `<tr>
          <td><b>${escapeHtml(s.matricule)}</b></td>
          <td>${escapeHtml(s.prenom)} ${escapeHtml(s.nom)}</td>
          <td>${escapeHtml(s.classe || '')}</td>
          ${cells}
          <td class="is-num"><b>${rowPayes}/12</b></td>
          <td></td>
        </tr>`;
      })
      .join('');

    body.querySelectorAll('.pay-cell').forEach((td) => {
      td.addEventListener('click', async () => {
        const studentId = parseInt(td.dataset.student, 10);
        const mois = parseInt(td.dataset.mois, 10);
        const s = data.students.find((x) => x.id === studentId);
        const p = s.payments[mois];
        await window.api.togglePayment({
          student_id: studentId,
          matiere_id: payState.matiere_id,
          teacher_id: payState.teacher_id,
          annee: payState.annee,
          mois,
          paye: !(p && p.paye),
          montant: p && p.montant ? p.montant : prix
        });
        await refreshPayments();
        await refreshStudentList();
      });
    });

    renderPaySummary(data, prix);
  }

  async function renderPaySummary(data, prix) {
    const stats = await window.api.paymentsStats({
      matiere_id: payState.matiere_id,
      teacher_id: payState.teacher_id,
      annee: payState.annee
    });
    if (!stats) return;
    const b = stats.par_mois[payState.mois - 1] || { payes: 0, impayes: 0, montant: 0, attendu: 0 };
    $('#pay-summary').innerHTML = `
      <span class="pay-stat"><b>${formatAmount(stats.inscrits)}</b> inscrit(s)</span>
      <span class="pay-stat"><b>${prix ? formatAmount(prix) + ' DA' : '—'}</b> tarif</span>
      <span class="pay-stat is-ok"><b>${formatAmount(stats.total_encaisse)} DA</b> encaissés en ${payState.annee}</span>
      <span class="pay-stat ${payState.mois <= stats.par_mois.length && b.impayes > 0 ? 'is-ko' : ''}">
        <b>${formatAmount(b.payes)}/${formatAmount(stats.inscrits)}</b> payés en ${MOIS_LONGS[payState.mois - 1]}
      </span>
      <button class="btn btn-light btn-sm" id="btn-pay-mark-all">
        ${ICONS.check} Marquer tout ${MOIS_LONGS[payState.mois - 1]} comme payé
      </button>`;

    const btnAll = $('#btn-pay-mark-all');
    if (btnAll) {
      btnAll.addEventListener('click', async () => {
        if (!confirm(`Marquer tous les élèves comme payés pour ${MOIS_LONGS[payState.mois - 1]} ${payState.annee} ?`)) return;
        const res = await window.api.markAllPayments({
          matiere_id: payState.matiere_id,
          teacher_id: payState.teacher_id,
          annee: payState.annee,
          mois: payState.mois,
          paye: true
        });
        if (res.success) {
          await refreshPayments();
          await refreshStudentList();
        }
      });
    }
  }

  // ============================================================
  //  CARTES
  // ============================================================

  async function refreshCardsList() {
    cardsCache = await window.api.listStudents({
      search: $('#cards-search-input').value,
      classe: $('#filter-classe-cartes').value,
      matiere_id: $('#filter-matiere-cartes').value,
      sort: stateCardsSort.champ,
      dir: stateCardsSort.dir
    });
    renderCardsTable();
  }

  function renderCardsTable() {
    const tbody = $('#cards-tbody');
    const vide = $('#cards-empty-state');
    const count = $('#cards-selection-count');
    if (count) count.textContent = `${selectedCardIds.size} étudiant(s) sélectionné(s)`;
    $('#btn-print-selection').disabled = selectedCardIds.size === 0;
    if (vide) vide.style.display = cardsCache.length ? 'none' : 'block';

    tbody.innerHTML = cardsCache
      .map(
        (s) => `
      <tr>
        <td class="col-check"><input type="checkbox" data-card-check="${s.id}" ${selectedCardIds.has(s.id) ? 'checked' : ''} /></td>
        <td class="col-avatar"><div class="row-avatar">${avatarHtml(s, 'sm')}</div></td>
        <td><b>${escapeHtml(s.matricule)}</b></td>
        <td>${escapeHtml(s.nom)}</td>
        <td>${escapeHtml(s.prenom)}</td>
        <td>${escapeHtml(s.classe || '—')}</td>
      </tr>`
      )
      .join('');

    tbody.querySelectorAll('[data-card-check]').forEach((cb) => {
      cb.addEventListener('change', () => {
        const id = parseInt(cb.dataset.cardCheck, 10);
        if (cb.checked) selectedCardIds.add(id);
        else selectedCardIds.delete(id);
        renderCardsTable();
      });
    });
  }

  function setupCardsSorting() {
    $$('#cards-head .sortable').forEach((th) => {
      th.addEventListener('click', () => {
        const champ = th.dataset.cardsSort;
        stateCardsSort =
          stateCardsSort.champ === champ
            ? { champ, dir: stateCardsSort.dir === 'asc' ? 'desc' : 'asc' }
            : { champ, dir: 'asc' };
        paintSortIndicators('#cards-head', '[data-cards-sort]', stateCardsSort);
        refreshCardsList();
      });
    });
    paintSortIndicators('#cards-head', '[data-cards-sort]', stateCardsSort);
  }

  const cardsSearchInput = $('#cards-search-input');
  if (cardsSearchInput) {
    let t = null;
    cardsSearchInput.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(refreshCardsList, 220);
    });
  }

  $('#filter-classe-cartes').addEventListener('change', refreshCardsList);
  $('#filter-matiere-cartes').addEventListener('change', refreshCardsList);

  $('#cards-select-all').addEventListener('change', () => {
    if ($('#cards-select-all').checked) cardsCache.forEach((s) => selectedCardIds.add(s.id));
    else cardsCache.forEach((s) => selectedCardIds.delete(s.id));
    renderCardsTable();
  });

  /**
   * Carte d'élève — HTML partagé entre l'aperçu à l'écran et l'impression.
   * Structure reprise telle quelle du modèle d'origine : bandeau bordeaux,
   * colonne photo + code-barres, encart d'informations, pied de carte.
   */
  function buildCardHtml(s) {
    const SCHOOL_ADDRESS = 'Sid Cheikh, Saida';
    const SCHOOL_PHONE = '+213 771 411 418';
    const SCHOOL_WEB = 'etablissement.elkawther@gmail.com';

    const photoHtml = s.photo ? `<img src="${escapeHtml(photoUrl(s.photo))}" alt="" />` : ICONS.user;
    const nomComplet = `${escapeHtml(s.prenom)} ${escapeHtml(s.nom)}`;
    const yearLabel = `Année D'inscription ${new Date().getFullYear()}`;

    return `
      <div class="card-header">
        <div class="card-logo">${ICONS.graduationCap}</div>
        <div class="card-school-name">
          <span class="l1">Établissement</span>
          <span class="l2">El Kawther</span>
          <span class="l3">Éducation et Formation</span>
        </div>
      </div>
      <div class="card-body">
        <div class="card-photo-col">
          <div class="card-photo">${photoHtml}</div>
          <svg class="card-barcode" data-matricule="${escapeHtml(s.matricule)}"></svg>
        </div>
        <div class="card-main-col">
          <div class="card-title">carte d'élève</div>
          <div class="card-year">${yearLabel}</div>
          <div class="card-info-box">
            <div class="card-row"><span class="card-label">Nom</span><span class="card-value">${nomComplet}</span></div>
            <div class="card-row"><span class="card-label">Matricule</span><span class="card-value">${escapeHtml(s.matricule)}</span></div>
            <div class="card-row"><span class="card-label">Date de naissance</span><span class="card-value">${escapeHtml(s.date_naissance || '—')}</span></div>
          </div>
        </div>
      </div>
      <div class="card-footer">
        <span class="cf-item cf-address"><i>${ICONS.pin}</i>${SCHOOL_ADDRESS}</span>
        <span class="cf-item"><i>${ICONS.phone}</i>${SCHOOL_PHONE}</span>
        <span class="cf-item"><i>${ICONS.email}</i>${SCHOOL_WEB}</span>
      </div>
    `;
  }

  /** Code-barres CODE128 dans un <svg> : rendu net à l'impression. */
  function renderBarcodes(container) {
    const scope = container || document;
    scope.querySelectorAll('.card-barcode').forEach((svg) => {
      const matricule = svg.dataset.matricule || '';
      if (!matricule || typeof JsBarcode === 'undefined') return;
      try {
        JsBarcode(svg, matricule, {
          format: 'CODE128',
          width: 0.9,
          height: 24,
          margin: 0,
          displayValue: false,
          background: 'transparent',
          lineColor: '#1e2733'
        });
        const w = parseFloat(svg.getAttribute('width'));
        const h = parseFloat(svg.getAttribute('height'));
        if (w && h) {
          svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
          svg.removeAttribute('width');
          svg.removeAttribute('height');
        }
      } catch (err) {
        // matricule non compatible avec Code128 — ne devrait pas arriver (numérique)
      }
    });
  }

  async function openCardModal(id) {
    const s = await window.api.getStudent(id);
    if (!s) return;
    const area = $('#card-print-area');
    area.innerHTML = `<div class="student-card">${buildCardHtml(s)}</div>`;
    renderBarcodes(area);
    $('#card-modal-overlay').classList.add('active');
  }

  $('#btn-close-card').addEventListener('click', () => $('#card-modal-overlay').classList.remove('active'));
  $('#btn-close-card-2').addEventListener('click', () => $('#card-modal-overlay').classList.remove('active'));

  $('#btn-print-card').addEventListener('click', async () => {
    const area = $('#single-print-area');
    area.innerHTML = `<div class="student-card">${$('#card-print-area').innerHTML}</div>`;
    renderBarcodes(area);
    clearWillPrint();
    area.classList.add('will-print');
    await window.api.exportPdf('carte-etudiant.pdf');
    clearWillPrint();
  });

  $('#btn-print-selection').addEventListener('click', async () => {
    const eleves = cardsCache.filter((s) => selectedCardIds.has(s.id));
    if (!eleves.length) return;
    const bulk = $('#bulk-print-area');
    bulk.innerHTML = eleves.map((s) => `<div class="student-card">${buildCardHtml(s)}</div>`).join('');
    renderBarcodes(bulk);
    clearWillPrint();
    bulk.classList.add('will-print');
    await window.api.exportPdf(`cartes-${eleves.length}-eleves.pdf`);
    bulk.classList.remove('will-print');
    clearWillPrint();
  });

  // ============================================================
  //  EXCEL
  // ============================================================

  $('#btn-excel-template').addEventListener('click', async () => {
    const res = await window.api.excelTemplate();
    if (res.success) alert(`Modèle enregistré :\n${res.filePath}`);
    else if (!res.canceled) alert(res.error || 'Enregistrement impossible.');
  });

  $('#btn-excel-export').addEventListener('click', async () => {
    const res = await window.api.excelExport();
    if (res.success) alert(`${res.nb} élève(s) exporté(s) :\n${res.filePath}`);
    else if (!res.canceled) alert(res.error || 'Export impossible.');
  });

  let importLignes = [];

  $('#btn-excel-import').addEventListener('click', async () => {
    const res = await window.api.excelImportPreview();
    if (res.canceled) return;
    if (!res.success) {
      alert(res.error || 'Lecture impossible.');
      return;
    }
    importLignes = res.lignes.filter((l) => !l.exemple);
    const valides = res.valides;
    const enErreur = res.enErreur;

    $('#import-modal-title').textContent = `Importer — ${res.fichier}`;
    $('#import-modal-body').innerHTML = `
      <div class="import-summary">
        <span class="chip is-ok">${valides} ligne(s) prête(s)</span>
        ${enErreur ? `<span class="chip is-ko">${enErreur} ligne(s) en erreur</span>` : ''}
        ${res.lignes.length !== res.total ? '<span class="chip">ligne d\'exemple ignorée</span>' : ''}
      </div>
      <table class="mini-table">
        <thead><tr><th>Ligne</th><th>Nom</th><th>Prénom</th><th>Classe</th><th>Cours</th><th>État</th></tr></thead>
        <tbody>
          ${res.lignes
            .map(
              (l) => `<tr class="${l.exemple ? 'is-example' : l.erreurs.length ? 'is-error' : ''}">
              <td>${l.ligne}</td>
              <td>${escapeHtml(l.nom)}</td>
              <td>${escapeHtml(l.prenom)}</td>
              <td>${escapeHtml(l.classe || '—')}</td>
              <td>${(l.cours || []).map((c) => escapeHtml(c.matiere_nom + (c.teacher_nom ? ' / ' + c.teacher_nom : ''))).join('<br />') || '—'}</td>
              <td>${l.exemple ? 'exemple — ignorée' : l.erreurs.length ? `<span class="is-warn">${escapeHtml(l.erreurs.join(' ; '))}</span>` : '<span class="is-ok">OK</span>'}</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
      <p class="hint-inline">Seules les ${valides} ligne(s) sans erreur seront importées.</p>`;

    $('#btn-confirm-import').disabled = valides === 0;
    $('#import-modal-overlay').classList.add('active');
  });

  $('#btn-confirm-import').addEventListener('click', async () => {
    const lignes = importLignes.filter((l) => !l.erreurs || l.erreurs.length === 0);
    if (!lignes.length) return;
    $('#btn-confirm-import').disabled = true;
    const res = await window.api.excelImportConfirm(lignes);
    $('#import-modal-overlay').classList.remove('active');
    $('#btn-confirm-import').disabled = false;
    if (res.crees.length) {
      await refreshMatieresData();
      await afterDataChange();
      await refreshStudentList();
    }
    const echecs = res.echecs || [];
    alert(
      `Import terminé.\n${res.crees.length} élève(s) créé(s).` +
        (echecs.length ? `\n\n${echecs.length} échec(s) :\n` + echecs.map((e) => `Ligne ${e.ligne} : ${e.erreur}`).join('\n') : '')
    );
  });

  $('#btn-close-import').addEventListener('click', () => $('#import-modal-overlay').classList.remove('active'));
  $('#btn-cancel-import').addEventListener('click', () => $('#import-modal-overlay').classList.remove('active'));

  $('#btn-import-photos').addEventListener('click', async () => {
    const res = await window.api.importPhotos();
    if (!res || !res.success) {
      if (res && !res.canceled) alert(res.error || 'Import impossible.');
      return;
    }
    alert(
      `${res.associes} photo(s) associée(s).` +
        (res.orphelines && res.orphelines.length
          ? `\n\n${res.orphelines.length} fichier(s) sans correspondance :\n` + res.orphelines.slice(0, 10).join('\n')
          : '')
    );
    await afterDataChange();
    await refreshStudentList();
  });

  // ============================================================
  //  ANNÉE DE TRAVAIL
  // ============================================================

  async function initAnnee() {
    const info = await window.api.anneeInitiale();
    anneeTravail = info.annee_active;
    anneesDisponibles = info.annees_disponibles;
    dashAnnee = info.annee_active;
    payState.annee = info.annee_active;
    remplirAnnees();
    return info;
  }

  function remplirAnnees() {
    const html = anneesDisponibles.map((y) => `<option value="${y}">${y}</option>`).join('');
    ['#pay-annee', '#statut-annee'].forEach((sel) => {
      const el = $(sel);
      if (!el) return;
      const prev = el.value;
      el.innerHTML = html;
      el.value = anneesDisponibles.includes(Number(prev)) ? prev : String(anneeTravail);
    });
    const dash = $('#dash-annee');
    if (dash) {
      const prev = dash.value;
      dash.innerHTML = html;
      dash.value = anneesDisponibles.includes(Number(prev)) ? prev : String(dashAnnee);
    }
  }

  function fillStaticPaymentSelects() {
    const anneeSel = $('#pay-annee');
    const moisSel = $('#pay-mois-courant');
    const statutAnnee = $('#statut-annee');
    const statutMois = $('#statut-mois');
    if (!anneeSel || !moisSel) return;

    // Les années viennent de la base (voir remplirAnnees) ; ici on ne fait que
    // les mois et la valeur courante.
    anneeSel.value = String(payState.annee);
    if (statutAnnee) statutAnnee.value = String(anneeTravail);

    moisSel.innerHTML = MOIS_LONGS.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('');
    moisSel.value = String(payState.mois);

    if (statutMois) {
      statutMois.innerHTML =
        '<option value="">-- mois --</option>' + MOIS_LONGS.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('');
    }
  }

  // ============================================================
  //  RAFRAÎCHISSEMENT GLOBAL
  // ============================================================

  async function afterDataChange() {
    allClasses = await window.api.listClasses();
    populateFilterSelects();
    matieresByStudent = await window.api.studentMatieresMap();
    renderMatieresView();
    renderTeachersView();
    renderMatiereChecklist();
    renderCoursTable();
    await refreshMatieresStats();
    await refreshDashboardCharts();
    await refreshStats();
    const f = $('#filter-classe-etudiants');
    if (f && f.value) f.value = f.value;
  }

  init();
  // Liste des impayés du mois sélectionné
  $('#btn-pay-show-unpaid').addEventListener('click', async () => {
    if (!payState.matiere_id || !payState.data) {
      alert('Choisissez d\'abord une matière.');
      return;
    }
    const data = payState.data;
    const rows = await window.api.unpaidStudents({
      matiere_id: data.cours.matiere_id,
      teacher_id: data.cours.teacher_id,
      annee: data.annee,
      mois: payState.mois
    });

    const body = rows.length
      ? `
      <table class="mini-table">
        <thead><tr><th>Matricule</th><th>Nom</th><th>Classe</th><th>Tél. parent</th><th></th></tr></thead>
        <tbody>
          ${rows
            .map(
              (r) => `<tr>
                <td><b>${escapeHtml(r.matricule)}</b></td>
                <td>${escapeHtml(r.prenom)} ${escapeHtml(r.nom)}</td>
                <td>${escapeHtml(r.classe || '—')}</td>
                <td>${escapeHtml(r.telephone_parent || '—')}</td>
                <td><button class="btn btn-light btn-sm" data-mark-paid="${r.id}" data-mois="${payState.mois}">Marquer payé</button></td>
              </tr>`
            )
            .join('')}
        </tbody>
      </table>`
      : '<p>Aucun impayé pour ce mois.</p>';

    openMatiereModal(
      `Impayés — ${data.cours.matiere_nom} · ${data.cours.teacher_full_name} · ${MOIS_LONGS[payState.mois - 1]} ${data.annee}`,
      body
    );
    $('#btn-print-matiere-report').style.display = 'none';

    $('#matiere-modal-body').querySelectorAll('[data-mark-paid]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await window.api.togglePayment({
          student_id: parseInt(btn.dataset.markPaid, 10),
          matiere_id: data.cours.matiere_id,
          teacher_id: data.cours.teacher_id,
          annee: data.annee,
          mois: parseInt(btn.dataset.mois, 10),
          paye: true,
          montant: data.cours.prix_mensuel
        });
        closeMatiereModal();
        refreshPayments();
      });
    });
  });

  // Impression de la grille
  $('#btn-pay-print').addEventListener('click', async () => {
    const data = payState.data;
    if (!data || !data.cours) {
      alert('Choisissez d\'abord un enseignant puis un cours.');
      return;
    }
    const prix = data.cours.prix_mensuel || 0;
    const rowsHtml = data.students
      .map((s) => {
        const cells = MOIS_COURTS.map((m, i) => {
          const p = s.payments[i + 1];
          return `<td class="${p && p.paye ? 'rp-paid' : ''}">${p && p.paye ? 'X' : ''}</td>`;
        }).join('');
        const rowPayes = Object.values(s.payments).filter((p) => p.paye).length;
        return `<tr>
          <td>${escapeHtml(s.matricule)}</td>
          <td>${escapeHtml(s.prenom)} ${escapeHtml(s.nom)}</td>
          <td>${escapeHtml(s.classe || '')}</td>
          ${cells}
          <td><b>${rowPayes}/12</b></td>
        </tr>`;
      })
      .join('');

    const area = $('#report-print-area');
    area.innerHTML = `
      <h1>Relevé des abonnements — ${escapeHtml(data.cours.matiere_nom)}</h1>
      <p>Enseignant : ${escapeHtml(data.cours.teacher_full_name)}</p>
      <p>Année ${data.annee} · Tarif mensuel : ${prix ? formatAmount(prix) + ' DA' : 'non défini'}</p>
      <p>Établissement El Kawther — Éducation et Formation</p>
      <table class="report-table">
        <thead><tr><th>Matricule</th><th>Nom</th><th>Classe</th>${MOIS_COURTS.map((m) => `<th>${m}</th>`).join('')}<th>Total</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>`;

    clearWillPrint();
    area.classList.add('will-print');
    await window.api.exportPdf(`releve-${data.cours.matiere_nom}-${data.annee}.pdf`.replace(/[\\/:*?"<>|]/g, '-'));
    clearWillPrint();
  });

  // ---------- Modale générique (détail matière / impayés) ----------
  function openMatiereModal(title, html) {
    $('#matiere-modal-title').textContent = title;
    $('#matiere-modal-body').innerHTML = html;
    $('#matiere-modal-overlay').classList.add('active');
  }
  function closeMatiereModal() {
    $('#matiere-modal-overlay').classList.remove('active');
  }
  $('#btn-close-matiere').addEventListener('click', closeMatiereModal);
  $('#btn-close-matiere-2').addEventListener('click', closeMatiereModal);

  let printMatiereStudents = [];
  async function openMatiereDetail(matiereId) {
    const m = allMatieres.find((x) => x.id === matiereId);
    if (!m) return;
    const students = await window.api.listStudentsForMatiere({ matiere_id: matiereId });
    printMatiereStudents = students;

    const coursDeLaMatiere = allCours.filter((c) => c.matiere_id === matiereId);
    const body = `
      <p class="hint-inline">
        Tarif par défaut : <b>${m.prix_mensuel ? formatAmount(m.prix_mensuel) + ' DA' : 'non défini'}</b>
        ${m.description ? ` · ${escapeHtml(m.description)}` : ''}
      </p>
      ${
        coursDeLaMatiere.length
          ? `<div class="entity-tags">${coursDeLaMatiere
              .map(
                (c) =>
                  `<span class="chip chip-teacher">${escapeHtml(c.teacher_full_name)} — ${c.prix_mensuel ? formatAmount(c.prix_mensuel) + ' DA' : '—'} · ${c.student_count} élève(s)</span>`
              )
              .join('')}</div>`
          : '<p class="hint-inline"><i>Aucun enseignant pour cette matière.</i></p>'
      }
      ${
        students.length
          ? `<table class="mini-table">
              <thead><tr><th>Matricule</th><th>Nom</th><th>Classe</th><th>Enseignant</th></tr></thead>
              <tbody>${students
                .map(
                  (s) => `<tr>
                    <td><b>${escapeHtml(s.matricule)}</b></td>
                    <td>${escapeHtml(s.prenom)} ${escapeHtml(s.nom)}</td>
                    <td>${escapeHtml(s.classe || '—')}</td>
                    <td>${escapeHtml(s.teacher_full_name || '—')}</td>
                  </tr>`
                )
                .join('')}</tbody>
            </table>`
          : '<p class="empty-inline">Aucun étudiant inscrit à cette matière.</p>'
      }`;

    openMatiereModal(`${escapeHtml(m.nom)} — ${students.length} inscription(s)`, body);
    $('#btn-print-matiere-report').style.display = '';
  }

  $('#btn-print-matiere-report').addEventListener('click', async () => {
    if (printMatiereStudents.length === 0) return;
    const area = $('#report-print-area');
    area.innerHTML = `
      <h1>Liste des inscrits</h1>
      <table class="report-table">
        <thead><tr><th>Matricule</th><th>Nom</th><th>Classe</th><th>Enseignant</th></tr></thead>
        <tbody>
          ${printMatiereStudents
            .map(
              (s) => `<tr>
                <td>${escapeHtml(s.matricule)}</td>
                <td>${escapeHtml(s.prenom)} ${escapeHtml(s.nom)}</td>
                <td>${escapeHtml(s.classe || '')}</td>
                <td>${escapeHtml([s.teacher_prenom, s.teacher_nom].filter(Boolean).join(' '))}</td>
              </tr>`
            )
            .join('')}
        </tbody>
      </table>`;
    clearWillPrint();
    area.classList.add('will-print');
    await window.api.exportPdf('liste-inscrits.pdf');
    clearWillPrint();
  });

  // ---------- Modale de succès ----------
  function openSuccessModal(matricule) {
    $('#success-modal-text').textContent = `Matricule attribué : ${matricule}`;
    $('#success-modal-overlay').classList.add('active');
  }

  $('#btn-success-home').addEventListener('click', () => {
    $('#success-modal-overlay').classList.remove('active');
    showView('accueil');
  });

  $('#btn-success-another').addEventListener('click', () => {
    $('#success-modal-overlay').classList.remove('active');
    resetForm();
    showView('inscription');
  });

  // ---------- Bascule d'année automatique ----------
  function showYearBanner(info) {
    if (!info.nouvelle_annee) return;
    const banner = $('#year-banner');
    if (!banner) return;
    $('#year-banner-text').innerHTML =
      `<b>Nouvelle année ${info.annee_active}</b> — l'application est passée de ${info.annee_precedente} ` +
      `à ${info.annee_active}.<br />` +
      `Les ${info.eleves_reconducts} élève(s) restent inscrits à leurs ${info.cours_actifs} cours ; ` +
      `les abonnements ${info.annee_active} repartent de zéro (rien n'est facturé avant le mois en cours).`;
    banner.style.display = 'flex';
    $('#btn-year-banner-ok').addEventListener('click', () => {
      banner.style.display = 'none';
    });
  }

  // ---------- Init ----------
  function fillDashAnneeSelect() {
    const anneeSel = $('#dash-annee');
    const teacherSel = $('#dash-teacher');
    if (!anneeSel) return;
    // Les années viennent des données réelles (remplirAnnees), pas d'une
    // fenêtre figée : sinon 2026 disparaîtrait après quelques années.
    if (!anneesDisponibles.length) {
      const current = new Date().getFullYear();
      anneeSel.innerHTML = [current - 1, current, current + 1].map((y) => `<option value="${y}">${y}</option>`).join('');
    }
    anneeSel.value = String(dashAnnee);
    anneeSel.addEventListener('change', () => {
      dashAnnee = parseInt(anneeSel.value, 10);
      refreshDashboardCharts();
    });

    if (teacherSel) {
      teacherSel.addEventListener('change', () => {
        dashTeacher = teacherSel.value;
        refreshDashboardCharts();
        refreshStats();
      });
    }

    const repSel = $('#dash-repartition');
    if (repSel) {
      repSel.value = dashRepartition;
      repSel.addEventListener('change', () => {
        dashRepartition = repSel.value;
        renderRepartitionChart();
      });
    }
  }

  function populateDashTeacherSelect() {
    const sel = $('#dash-teacher');
    if (!sel) return;
    sel.innerHTML =
      '<option value="">Vue globale — tous les enseignants</option>' +
      allTeachers.map((t) => `<option value="${t.id}">${escapeHtml(teacherLabel(t))}</option>`).join('');
    sel.value = dashTeacher;
  }

  async function init() {
    applyStaticIcons();
    photosDir = await window.api.getPhotosDir();
    await refreshMatieresData();
    allClasses = await window.api.listClasses();
    const anneeInfo = await initAnnee();
    fillStaticPaymentSelects();
    fillDashAnneeSelect();
    populateDashTeacherSelect();
    populateFilterSelects();
    refreshPayFilters();
    renderMatieresView();
    renderTeachersView();
    resetForm();
    resetTeacherForm();
    resetMatiereForm();
    setupStudentSorting();
    setupCardsSorting();
    setupCoursSorting();
    showYearBanner(anneeInfo);
    refreshStats();
    refreshMatieresStats();
    await refreshDashboardCharts();
    await refreshStudentList();
    updateStudentsFilterHint();

    // L'interface est prete : le processus principal ferme l'ecran de
    // demarrage. Sans ce signal, il ne peut que deviner (et se tromper).
    await window.api.appPret();
  }

})();