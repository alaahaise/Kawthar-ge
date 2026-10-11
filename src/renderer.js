(() => {
  // ---------- Icônes SVG (remplacent les émojis) ----------
  const ICONS = {
    home: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l9 8h-3v9h-5v-6H11v6H6v-9H3z"/></svg>',
    clipboard: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 2a1 1 0 0 0-1 1v1H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V3a1 1 0 0 0-1-1H9zm0 2h6v2H9V4zM7 10h10v2H7v-2zm0 4h10v2H7v-2zm0 4h6v2H7v-2z"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm8-1a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8 14c-4 0-6 2-6 4.5V20h12v-1.5C14 16 12 14 8 14zm8 0c-.6 0-1.2.05-1.7.15 1.6 1.1 2.7 2.7 2.7 4.85V20h6v-1.5c0-2.5-3-4.5-7-4.5z"/></svg>',
    idcard: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm3 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-3 7c0-1.5 1.8-2.5 3.5-2.5S10 14.5 10 16H3zm9-6h8v1.5h-8V10zm0 3h8v1.5h-8V13z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    camera: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 3l-1.5 2H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.5L15 3H9zm3 6a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-4.4 0-8 2.2-8 5v2h16v-2c0-2.8-3.6-5-8-5z"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 7h12l-1 13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 7zM9 4h6l1 2H8l1-2z"/></svg>',
    printer: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 9V3h12v6h2a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-3v3H7v-3H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h2zm2-4v4h8V5H8zm0 12v4h8v-4H8z"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/></svg>',
    graduationCap: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3 1 8l11 5 9-4.1V17h2V8L12 3zm-7 8.2V15c0 2 3.1 4 7 4s7-2 7-4v-3.8l-7 3.2-7-3.2z"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11 11 0 0 0 3.6.6 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.6 3.6a1 1 0 0 1-.25 1L6.6 10.8z"/></svg>',
    globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg>',
    email: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v16H6.5a2.5 2.5 0 0 0-2.5 2.5V4.5zM6.5 4a.5.5 0 0 0-.5.5V17c.31-.13.65-.2 1-.2H18V4H6.5zM6 19a1 1 0 0 0 1 1h11v-1H6z"/></svg>'
  };

  function applyStaticIcons() {
    document.querySelectorAll('[data-icon]').forEach((el) => {
      const name = el.dataset.icon;
      if (ICONS[name]) el.innerHTML = ICONS[name];
    });
  }

  let photosDir = '';
  let selectedPhotoTempPath = null;
  let editingId = null;
  let deleteTargetId = null;
  let searchDebounce = null;
  let editingTeacherId = null;
  let matieresFilterText = '';
  let teachersFilterText = '';

  // Matières / enseignants (état en mémoire, rafraîchi via refreshMatieresData)
  let allMatieres = [];
  let allTeachers = [];
  let matiereTeacherPairs = [];
  let matiereTeachersByMatiere = {};

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  function toFileUrl(p) {
    if (!p) return '';
    let normalized = p.replace(/\\/g, '/');
    if (!normalized.startsWith('/')) normalized = '/' + normalized;
    return 'file://' + encodeURI(normalized).replace(/#/g, '%23');
  }

  // ---------- Dates (format jj/mm/aaaa) ----------
  function todayDisplay() {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
  }

  function isValidDisplayDate(str) {
    return /^\d{2}\/\d{2}\/\d{4}$/.test(str);
  }

  function yearFromDisplayDate(str) {
    const parts = (str || '').split('/');
    return parts.length === 3 ? parts[2] : String(new Date().getFullYear());
  }

  function visibleText(str) {
    if (!str) return '';
    // Retire aussi les caractères invisibles (espace zéro-largeur, BOM, etc.)
    // que .trim() seul ne détecte pas, en plus des espaces normaux.
    return String(str).replace(/[\u200B-\u200D\uFEFF\u00A0\s]+/g, ' ').trim();
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function initials(nom) {
    return (nom || '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase();
  }

  // ---------- Navigation ----------
  function showView(viewName) {
    $$('.view').forEach((v) => v.classList.remove('active'));
    $$('.nav-item').forEach((n) => n.classList.remove('active'));
    $(`#view-${viewName}`).classList.add('active');
    const navBtn = document.querySelector(`.nav-item[data-view="${viewName}"]`);
    if (navBtn) navBtn.classList.add('active');

    if (viewName === 'etudiants') refreshStudentList();
    if (viewName === 'accueil') {
      refreshStats();
      refreshMatieresStats();
    }
    if (viewName === 'cartes') refreshCardsList();
    if (viewName === 'matieres') renderMatieresView();
  }

  $$('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.view === 'inscription') {
        resetForm();
        setFormMessage('', '');
      }
      showView(btn.dataset.view);
    });
  });

  $('#stat-goto-inscription').addEventListener('click', () => {
    resetForm();
    setFormMessage('', '');
    showView('inscription');
  });
  $('#stat-goto-liste').addEventListener('click', () => showView('etudiants'));

  // ---------- Stats ----------
  async function refreshStats() {
    const total = await window.api.countStudents();
    $('#stat-total').textContent = total;
  }

  const BAR_CHART_MAX_HEIGHT = 150; // px, hauteur de la barre la plus haute

  async function refreshMatieresStats() {
    const chart = $('#matieres-bar-chart');
    const totalEl = $('#matieres-bar-total');
    if (!chart) return;

    const stats = await window.api.matieresStats();
    const total = stats.reduce((sum, s) => sum + (s.student_count || 0), 0);
    if (totalEl) totalEl.textContent = `${total} étudiant${total > 1 ? 's' : ''} inscrit${total > 1 ? 's' : ''}`;

    chart.innerHTML = '';

    if (stats.length === 0) {
      chart.innerHTML = '<p class="empty-inline">Aucune matière définie.</p>';
      return;
    }

    const maxCount = Math.max(1, ...stats.map((s) => s.student_count || 0));

    chart.innerHTML = stats
      .map((s) => {
        const count = s.student_count || 0;
        const isEmpty = count === 0;
        const heightPx = isEmpty ? 6 : Math.max(10, Math.round((count / maxCount) * BAR_CHART_MAX_HEIGHT));
        return `
      <div class="bar-col">
        <span class="bar-value">${count}</span>
        <div class="bar-track">
          <div class="bar${isEmpty ? ' is-empty' : ''}" style="height:${heightPx}px;"></div>
        </div>
        <span class="bar-name">${escapeHtml(visibleText(s.nom) ? s.nom : 'Sans nom')}</span>
      </div>
    `;
      })
      .join('');
  }
  // ---------- Photo selection ----------
  $('#btn-choose-photo').addEventListener('click', async () => {
    const filePath = await window.api.selectPhoto();
    if (!filePath) return;
    selectedPhotoTempPath = filePath;
    renderPhotoPreview(toFileUrl(filePath));
  });

  function renderPhotoPreview(url) {
    const preview = $('#photo-preview');
    preview.innerHTML = `<img src="${url}" alt="photo" />`;
  }

  function resetPhotoPreview() {
    const preview = $('#photo-preview');
    preview.innerHTML = `<span class="photo-placeholder-icon">${ICONS.camera}</span>`;
    selectedPhotoTempPath = null;
  }

  // ---------- Matières / enseignants ----------
  async function refreshMatieresData() {
    allMatieres = await window.api.listMatieres();
    allTeachers = await window.api.listTeachers();
    matiereTeacherPairs = await window.api.listMatiereTeachers();
    matiereTeachersByMatiere = {};
    matiereTeacherPairs.forEach((p) => {
      if (!matiereTeachersByMatiere[p.matiere_id]) matiereTeachersByMatiere[p.matiere_id] = [];
      matiereTeachersByMatiere[p.matiere_id].push({ id: p.teacher_id, nom: p.teacher_nom });
    });
  }

  function renderMatieresView() {
    renderMatieresList();
    renderTeachersList();
    renderAssignmentsList();
    populateAssignSelects();
  }
  function renderMatieresList() {
    const list = $('#matieres-list');
    if (!list) return;
    const filteredMatieres = matieresFilterText
      ? allMatieres.filter((m) => visibleText(m.nom).toLowerCase().includes(matieresFilterText))
      : allMatieres;
    if (filteredMatieres.length === 0) {
      list.innerHTML = '<li class="empty-inline">Aucune matière.</li>';
      return;
    }
    list.innerHTML = filteredMatieres
      .map((m) => {
        const count = m.student_count || 0;
        return `
      <li>
        <div class="list-row-main">
          <span class="list-row-icon">${ICONS.book}</span>
          <span class="list-row-name">${escapeHtml(visibleText(m.nom) ? m.nom : '(nom invisible — cliquez supprimer)')}</span>
        </div>
        <div class="list-row-end">
          
          <button class="btn-icon danger btn-delete-matiere" data-id="${m.id}" title="Supprimer">${ICONS.trash}</button>
        </div>
      </li>
    `;
      })
      .join('');
    list.querySelectorAll('.btn-delete-matiere').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Supprimer cette matière ? Les inscriptions liées seront retirées.')) return;
        await window.api.deleteMatiere(parseInt(btn.dataset.id, 10));
        await refreshMatieresData();
        renderMatieresView();
        renderInscriptionMatieresChecklist(currentFormMatiereSelectionsMap());
        refreshMatieresStats();
      });
    });
  }

    function renderTeachersList() {
    const list = $('#teachers-list');
    if (!list) return;
    const filteredTeachers = teachersFilterText
      ? allTeachers.filter((t) => visibleText(t.nom).toLowerCase().includes(teachersFilterText))
      : allTeachers;
    if (filteredTeachers.length === 0) {
      list.innerHTML = '<li class="empty-inline">Aucun enseignant.</li>';
      return;
    }
    list.innerHTML = filteredTeachers
      .map(
        (t) => `
      <li>
        <div class="list-row-main">
          <span class="list-row-avatar">${initials(t.nom)}</span>
          <div class="list-row-text">
            <span class="list-row-name">${escapeHtml(t.nom)}</span>
            ${t.telephone ? `<span class="list-row-sub">${escapeHtml(t.telephone)}</span>` : ''}
          </div>
        </div>
        <div class="list-row-end">
          <button class="btn-icon btn-edit-teacher" data-id="${t.id}" title="Modifier">${ICONS.edit}</button>
          <button class="btn-icon danger btn-delete-teacher" data-id="${t.id}" title="Supprimer">${ICONS.trash}</button>
        </div>
      </li>
    `
      )
      .join('');
    list.querySelectorAll('.btn-edit-teacher').forEach((btn) => {
      btn.addEventListener('click', () => {
        const teacher = allTeachers.find((t) => t.id === parseInt(btn.dataset.id, 10));
        if (!teacher) return;
        editingTeacherId = teacher.id;
        $('#new-teacher-nom').value = teacher.nom || '';
        $('#new-teacher-tel').value = teacher.telephone || '';
        $('#btn-save-teacher').textContent = 'Mettre à jour';
        $('#btn-cancel-teacher-edit').style.display = 'inline-block';
        $('#new-teacher-nom').focus();
      });
    });
    list.querySelectorAll('.btn-delete-teacher').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Supprimer cet enseignant ?')) return;
        await window.api.deleteTeacher(parseInt(btn.dataset.id, 10));
        await refreshMatieresData();
        renderMatieresView();
        renderInscriptionMatieresChecklist(currentFormMatiereSelectionsMap());
      });
    });
  }

  function resetTeacherForm() {
    editingTeacherId = null;
    if (teacherForm) teacherForm.reset();
    $('#btn-save-teacher').innerHTML = '<span data-icon="plus"></span> Ajouter';
    applyStaticIcons();
    $('#btn-cancel-teacher-edit').style.display = 'none';
  }

  function renderAssignmentsList() {
    const list = $('#assignments-list');
    if (!list) return;
    if (matiereTeacherPairs.length === 0) {
      list.innerHTML = '<li class="empty-inline">Aucune affectation.</li>';
      return;
    }
    list.innerHTML = matiereTeacherPairs
      .map(
        (p) => `
      <li>
        <div class="list-row-main">
          <span class="list-row-avatar">${initials(p.teacher_nom)}</span>
          <div class="list-row-text">
            <span class="list-row-name">${escapeHtml(p.teacher_nom)}</span>
            <span class="list-row-sub">${escapeHtml(p.matiere_nom)}</span>
          </div>
        </div>
        <button class="btn-icon danger btn-remove-assign" data-matiere="${p.matiere_id}" data-teacher="${p.teacher_id}" title="Retirer">${ICONS.trash}</button>
      </li>
    `
      )
      .join('');
    list.querySelectorAll('.btn-remove-assign').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await window.api.removeMatiereTeacher({
          matiere_id: parseInt(btn.dataset.matiere, 10),
          teacher_id: parseInt(btn.dataset.teacher, 10)
        });
        await refreshMatieresData();
        renderMatieresView();
        renderInscriptionMatieresChecklist(currentFormMatiereSelectionsMap());
      });
    });
  }

  function populateAssignSelects() {
    const matiereSelect = $('#assign-matiere');
    const teacherSelect = $('#assign-teacher');
    if (!matiereSelect || !teacherSelect) return;
    matiereSelect.innerHTML = allMatieres.map((m) => `<option value="${m.id}">${escapeHtml(m.nom)}</option>`).join('');
    teacherSelect.innerHTML = allTeachers.map((t) => `<option value="${t.id}">${escapeHtml(t.nom)}</option>`).join('');
  }

  const matiereForm = $('#matiere-form');
  if (matiereForm) {
    matiereForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = $('#new-matiere-nom');
      const nom = input.value.trim();
      if (!nom) return;
      const result = await window.api.addMatiere(nom);
      if (result.success) {
        input.value = '';
        await refreshMatieresData();
        renderMatieresView();
        renderInscriptionMatieresChecklist(currentFormMatiereSelectionsMap());
        refreshMatieresStats();
      } else {
        alert((result.error || '').includes('UNIQUE') ? 'Cette matière existe déjà.' : 'Erreur : ' + result.error);
      }
    });
  }

  const teacherForm = $('#teacher-form');
  if (teacherForm) {
    teacherForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nomInput = $('#new-teacher-nom');
      const telInput = $('#new-teacher-tel');
      const nom = nomInput.value.trim();
      if (!nom) return;
      let result;
      if (editingTeacherId) {
        result = await window.api.updateTeacher({
          id: editingTeacherId,
          nom,
          telephone: telInput.value.trim()
        });
      } else {
        result = await window.api.addTeacher({ nom, telephone: telInput.value.trim() });
      }
      if (result.success) {
        resetTeacherForm();
        await refreshMatieresData();
        renderMatieresView();
      } else {
        alert('Erreur : ' + result.error);
      }
    });
  }

  const btnCancelTeacherEdit = $('#btn-cancel-teacher-edit');
  if (btnCancelTeacherEdit) {
    btnCancelTeacherEdit.addEventListener('click', () => {
      resetTeacherForm();
    });
  }

  const matieresSearchInput = $('#matieres-search');
  if (matieresSearchInput) {
    matieresSearchInput.addEventListener('input', () => {
      matieresFilterText = matieresSearchInput.value.trim().toLowerCase();
      renderMatieresList();
    });
  }

  const teachersSearchInput = $('#teachers-search');
  if (teachersSearchInput) {
    teachersSearchInput.addEventListener('input', () => {
      teachersFilterText = teachersSearchInput.value.trim().toLowerCase();
      renderTeachersList();
    });
  }

  const assignForm = $('#assign-form');
  if (assignForm) {
    assignForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const matiereId = parseInt($('#assign-matiere').value, 10);
      const teacherId = parseInt($('#assign-teacher').value, 10);
      if (!matiereId || !teacherId) return;
      const result = await window.api.addMatiereTeacher({ matiere_id: matiereId, teacher_id: teacherId });
      if (result.success) {
        await refreshMatieresData();
        renderMatieresView();
        renderInscriptionMatieresChecklist(currentFormMatiereSelectionsMap());
      } else {
        alert(
          (result.error || '').includes('UNIQUE')
            ? 'Cet enseignant est déjà affecté à cette matière.'
            : 'Erreur : ' + result.error
        );
      }
    });
  }

  // ---------- Checklist matières dans le formulaire d'inscription ----------
  function renderInscriptionMatieresChecklist(selectedMap) {
    const container = $('#f-matieres-list');
    if (!container) return;
    const selections = selectedMap || {};

    if (allMatieres.length === 0) {
      container.innerHTML = '<p class="empty-inline">Aucune matière définie. Ajoutez-en depuis l\'onglet Matières.</p>';
      return;
    }

    container.innerHTML = allMatieres
      .map((m) => {
        const teachers = matiereTeachersByMatiere[m.id] || [];
        const isChecked =
          Object.prototype.hasOwnProperty.call(selections, m.id) ||
          Object.prototype.hasOwnProperty.call(selections, String(m.id));
        const selectedTeacherId = selections[m.id] ?? selections[String(m.id)] ?? '';
        const teacherOptions = teachers
          .map(
            (t) =>
              `<option value="${t.id}" ${String(t.id) === String(selectedTeacherId) ? 'selected' : ''}>${escapeHtml(t.nom)}</option>`
          )
          .join('');
        const disabled = teachers.length === 0;
        return `
        <div class="matiere-check-row" data-matiere-id="${m.id}">
          <label class="checkbox-label">
            <input type="checkbox" class="matiere-checkbox" ${isChecked ? 'checked' : ''} ${disabled ? 'disabled' : ''} />
            ${escapeHtml(m.nom)}${disabled ? ' <span class="hint-inline">(aucun enseignant affecté)</span>' : ''}
          </label>
          <select class="matiere-teacher-select" ${!isChecked || disabled ? 'disabled' : ''}>
            <option value="">Choisir un enseignant...</option>
            ${teacherOptions}
          </select>
        </div>
      `;
      })
      .join('');

    container.querySelectorAll('.matiere-check-row').forEach((row) => {
      const checkbox = row.querySelector('.matiere-checkbox');
      const select = row.querySelector('.matiere-teacher-select');
      checkbox.addEventListener('change', () => {
        select.disabled = !checkbox.checked;
        if (!checkbox.checked) select.value = '';
      });
    });
  }

  function collectMatiereSelections() {
    const rows = $$('#f-matieres-list .matiere-check-row');
    const selections = [];
    rows.forEach((row) => {
      const checkbox = row.querySelector('.matiere-checkbox');
      const select = row.querySelector('.matiere-teacher-select');
      if (checkbox && checkbox.checked) {
        selections.push({
          matiere_id: parseInt(row.dataset.matiereId, 10),
          teacher_id: select.value ? parseInt(select.value, 10) : null
        });
      }
    });
    return selections;
  }

  function currentFormMatiereSelectionsMap() {
    const map = {};
    collectMatiereSelections().forEach((s) => {
      map[s.matiere_id] = s.teacher_id;
    });
    return map;
  }

  // ---------- Form: add / edit ----------
  const form = $('#student-form');
  const formMessage = $('#form-message');

  function setFormMessage(text, type) {
    formMessage.textContent = text;
    formMessage.className = 'form-message' + (type ? ' ' + type : '');
  }

  async function refreshMatriculePreview() {
    if (editingId) return; // le matricule ne change pas en modification
    const dateInscription = $('#f-date-inscription').value || todayDisplay();
    const year = yearFromDisplayDate(dateInscription);
    const preview = await window.api.previewMatricule(year);
    $('#f-matricule').value = preview;
  }

  $('#f-date-inscription').addEventListener('change', refreshMatriculePreview);

  function resetForm() {
    form.reset();
    $('#f-id').value = '';
    $('#f-existing-photo').value = '';
    editingId = null;
    resetPhotoPreview();
    $('#f-date-inscription').value = todayDisplay();
    $('#inscription-title').textContent = "Inscription d'un étudiant";
    $('#btn-save-student').textContent = "Enregistrer l'étudiant";
    $('#btn-cancel-edit').style.display = 'none';
    refreshMatriculePreview();
    renderInscriptionMatieresChecklist({});
  }

  $('#btn-cancel-edit').addEventListener('click', () => {
    resetForm();
    setFormMessage('', '');
    showView('etudiants');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setFormMessage('', '');

    const dateInscription = $('#f-date-inscription').value.trim() || todayDisplay();
    const dateNaissance = $('#f-date-naissance').value.trim();

    if (!isValidDisplayDate(dateInscription)) {
      setFormMessage("Date d'inscription invalide. Format attendu : jj/mm/aaaa.", 'error');
      return;
    }
    if (dateNaissance && !isValidDisplayDate(dateNaissance)) {
      setFormMessage('Date de naissance invalide. Format attendu : jj/mm/aaaa.', 'error');
      return;
    }

    const student = {
      id: editingId,
      matricule: $('#f-matricule').value.trim(),
      nom: $('#f-nom').value.trim(),
      prenom: $('#f-prenom').value.trim(),
      date_naissance: dateNaissance || null,
      date_inscription: dateInscription,
      classe: $('#f-classe').value.trim(),
      telephone: $('#f-telephone').value.trim(),
      telephone_parent: $('#f-telephone-parent').value.trim(),
      adresse: $('#f-adresse').value.trim(),
      photoTempPath: selectedPhotoTempPath,
      existingPhoto: $('#f-existing-photo').value || null
    };

    if (!student.nom || !student.prenom) {
      setFormMessage('Veuillez remplir les champs obligatoires (*).', 'error');
      return;
    }

    let result;
    if (editingId) {
      result = await window.api.updateStudent(student);
    } else {
      result = await window.api.addStudent(student);
    }

    if (result.success) {
      const studentId = editingId || result.id;
      const selections = collectMatiereSelections();
      await window.api.setStudentMatieres({
        student_id: studentId,
        selections,
        date_inscription: dateInscription
      });

      const wasEditing = !!editingId;
      const savedMatricule = result.matricule || student.matricule;
      resetForm();
      refreshStats();
      refreshMatieresStats();
      if (wasEditing) {
        setFormMessage('Étudiant mis à jour avec succès.', 'success');
        showView('etudiants');
      } else {
        setFormMessage('', '');
        openSuccessModal(savedMatricule);
      }
    } else {
      const msg = (result.error || '').includes('UNIQUE')
        ? 'Ce matricule existe déjà. Veuillez en choisir un autre.'
        : "Erreur lors de l'enregistrement : " + result.error;
      setFormMessage(msg, 'error');
    }
  });

  // ---------- List + real-time search (Étudiants) ----------
  const tbody = $('#students-tbody');
  const emptyState = $('#empty-state');
  const searchInput = $('#search-input');
  const filterClasseEtudiants = $('#filter-classe-etudiants');

  searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(refreshStudentList, 150);
  });
  filterClasseEtudiants.addEventListener('change', refreshStudentList);

  async function refreshStudentList() {
    const students = await window.api.listStudents({
      search: searchInput.value,
      classe: filterClasseEtudiants.value
    });
    renderStudentTable(students);
  }

  function renderStudentTable(students) {
    tbody.innerHTML = '';
    emptyState.style.display = students.length === 0 ? 'block' : 'none';

    students.forEach((s) => {
      const tr = document.createElement('tr');

      const avatarHtml = s.photo
        ? `<img src="${toFileUrl(photosDir + '/' + s.photo)}" alt="" />`
        : ICONS.user;

      tr.innerHTML = `
        <td><div class="row-avatar">${avatarHtml}</div></td>
        <td><b>${escapeHtml(s.matricule)}</b></td>
        <td>${escapeHtml(s.nom)}</td>
        <td>${escapeHtml(s.prenom)}</td>
        <td>${escapeHtml(s.date_naissance || '—')}</td>
        <td>${escapeHtml(s.classe || '—')}</td>
        <td>${escapeHtml(s.telephone_parent || '—')}</td>
        <td class="actions-cell"></td>
      `;

      const actionsCell = tr.querySelector('.actions-cell');

      const btnCard = document.createElement('button');
      btnCard.className = 'btn-icon';
      btnCard.title = 'Générer la carte';
      btnCard.innerHTML = ICONS.idcard;
      btnCard.addEventListener('click', () => openCardModal(s));

      const btnEdit = document.createElement('button');
      btnEdit.className = 'btn-icon';
      btnEdit.title = 'Modifier';
      btnEdit.innerHTML = ICONS.edit;
      btnEdit.addEventListener('click', () => editStudent(s));

      const btnDelete = document.createElement('button');
      btnDelete.className = 'btn-icon danger';
      btnDelete.title = 'Supprimer';
      btnDelete.innerHTML = ICONS.trash;
      btnDelete.addEventListener('click', () => openDeleteConfirm(s));

      actionsCell.appendChild(btnCard);
      actionsCell.appendChild(btnEdit);
      actionsCell.appendChild(btnDelete);

      tbody.appendChild(tr);
    });
  }

  async function editStudent(s) {
    editingId = s.id;
    $('#f-id').value = s.id;
    $('#f-matricule').value = s.matricule || '';
    $('#f-date-inscription').value = s.date_inscription || '';
    $('#f-nom').value = s.nom || '';
    $('#f-prenom').value = s.prenom || '';
    $('#f-date-naissance').value = s.date_naissance || '';
    $('#f-classe').value = s.classe || '';
    $('#f-telephone').value = s.telephone || '';
    $('#f-telephone-parent').value = s.telephone_parent || '';
    $('#f-adresse').value = s.adresse || '';
    $('#f-existing-photo').value = s.photo || '';
    selectedPhotoTempPath = null;

    if (s.photo) {
      renderPhotoPreview(toFileUrl(photosDir + '/' + s.photo));
    } else {
      resetPhotoPreview();
    }

    $('#inscription-title').textContent = "Modifier l'étudiant";
    $('#btn-save-student').textContent = 'Mettre à jour';
    $('#btn-cancel-edit').style.display = 'inline-block';
    setFormMessage('', '');

    const enrollments = await window.api.getStudentMatieres(s.id);
    const map = {};
    enrollments.forEach((en) => {
      map[en.matiere_id] = en.teacher_id;
    });
    renderInscriptionMatieresChecklist(map);

    showView('inscription');
  }

  // ---------- Delete ----------
  function openDeleteConfirm(s) {
    deleteTargetId = s.id;
    $('#confirm-text').textContent = `Supprimer l'étudiant ${s.prenom} ${s.nom} (${s.matricule}) ?`;
    $('#confirm-modal-overlay').classList.add('active');
  }

  $('#btn-cancel-delete').addEventListener('click', () => {
    deleteTargetId = null;
    $('#confirm-modal-overlay').classList.remove('active');
  });

  $('#btn-confirm-delete').addEventListener('click', async () => {
    if (deleteTargetId) {
      await window.api.deleteStudent(deleteTargetId);
      deleteTargetId = null;
      $('#confirm-modal-overlay').classList.remove('active');
      refreshStudentList();
      refreshStats();
      refreshMatieresStats();
    }
  });

  // ---------- Carte étudiant (HTML partagé écran + impression) ----------
  function buildCardHtml(s) {
    // Coordonnées de l'établissement affichées en bas de la carte
    const SCHOOL_ADDRESS = 'Sid Cheikh, Saida';
    const SCHOOL_PHONE = '+213 771 411 418';
    const SCHOOL_WEB = 'etablissement.elkawther@gmail.com';

    const photoHtml = s.photo
      ? `<img src="${toFileUrl(photosDir + '/' + s.photo)}" alt="" />`
      : ICONS.user;
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

  function renderBarcodes(container) {
    container.querySelectorAll('.card-barcode').forEach((svg) => {
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

  function clearWillPrint() {
    $$('.will-print').forEach((el) => el.classList.remove('will-print'));
  }

  window.addEventListener('afterprint', clearWillPrint);

  // ---------- Card modal (impression d'une seule carte) ----------
  function openCardModal(s) {
    const area = $('#card-print-area');
    area.innerHTML = buildCardHtml(s);
    renderBarcodes(area);
    $('#card-modal-overlay').classList.add('active');
  }

  function closeCardModal() {
    $('#card-modal-overlay').classList.remove('active');
  }

  $('#btn-close-card').addEventListener('click', closeCardModal);
  $('#btn-close-card-2').addEventListener('click', closeCardModal);
  $('#btn-print-card').addEventListener('click', async () => {
    const area = $('#single-print-area');
    area.innerHTML = `<div class="student-card">${$('#card-print-area').innerHTML}</div>`;
    renderBarcodes(area);
    clearWillPrint();
    area.classList.add('will-print');
    await window.api.exportPdf('carte-etudiant.pdf');
    clearWillPrint();
  });

  // ---------- Page Cartes : sélection multiple + impression groupée ----------
  let cardsCache = [];
  const selectedCardIds = new Set();
  const cardsTbody = $('#cards-tbody');
  const cardsEmptyState = $('#cards-empty-state');
  const cardsSearchInput = $('#cards-search-input');
  const filterClasseCartes = $('#filter-classe-cartes');
  const cardsSelectAll = $('#cards-select-all');
  const cardsSelectionCount = $('#cards-selection-count');
  const btnPrintSelection = $('#btn-print-selection');
  let cardsSearchDebounce = null;

  cardsSearchInput.addEventListener('input', () => {
    clearTimeout(cardsSearchDebounce);
    cardsSearchDebounce = setTimeout(refreshCardsList, 150);
  });
  filterClasseCartes.addEventListener('change', refreshCardsList);

  async function refreshCardsList() {
    cardsCache = await window.api.listStudents({
      search: cardsSearchInput.value,
      classe: filterClasseCartes.value
    });
    renderCardsTable();
  }

  function renderCardsTable() {
    cardsTbody.innerHTML = '';
    cardsEmptyState.style.display = cardsCache.length === 0 ? 'block' : 'none';

    cardsCache.forEach((s) => {
      const tr = document.createElement('tr');
      const avatarHtml = s.photo
        ? `<img src="${toFileUrl(photosDir + '/' + s.photo)}" alt="" />`
        : ICONS.user;

      tr.innerHTML = `
        <td></td>
        <td><div class="row-avatar">${avatarHtml}</div></td>
        <td><b>${escapeHtml(s.matricule)}</b></td>
        <td>${escapeHtml(s.nom)}</td>
        <td>${escapeHtml(s.prenom)}</td>
        <td>${escapeHtml(s.classe || '—')}</td>
      `;

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'row-checkbox';
      checkbox.checked = selectedCardIds.has(s.id);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) selectedCardIds.add(s.id);
        else selectedCardIds.delete(s.id);
        updateSelectionUI();
      });

      tr.querySelector('td').appendChild(checkbox);
      cardsTbody.appendChild(tr);
    });

    updateSelectionUI();
  }

  function updateSelectionUI() {
    const visibleIds = cardsCache.map((s) => s.id);
    const allVisibleSelected =
      visibleIds.length > 0 && visibleIds.every((id) => selectedCardIds.has(id));
    cardsSelectAll.checked = allVisibleSelected;
    cardsSelectionCount.textContent = `${selectedCardIds.size} étudiant(s) sélectionné(s)`;
    btnPrintSelection.disabled = selectedCardIds.size === 0;
  }

  cardsSelectAll.addEventListener('change', () => {
    if (cardsSelectAll.checked) {
      cardsCache.forEach((s) => selectedCardIds.add(s.id));
    } else {
      cardsCache.forEach((s) => selectedCardIds.delete(s.id));
    }
    renderCardsTable();
  });

  btnPrintSelection.addEventListener('click', async () => {
    const selectedStudents = cardsCache.filter((s) => selectedCardIds.has(s.id));
    if (selectedStudents.length === 0) return;

    const bulkArea = $('#bulk-print-area');
    bulkArea.innerHTML = selectedStudents
      .map((s) => `<div class="student-card">${buildCardHtml(s)}</div>`)
      .join('');
    renderBarcodes(bulkArea);

    clearWillPrint();
    bulkArea.classList.add('will-print');
    await window.api.exportPdf('cartes-etudiants.pdf');
    clearWillPrint();
  });

  // ---------- Init ----------
  async function init() {
    applyStaticIcons();
    photosDir = await window.api.getPhotosDir();
    await refreshMatieresData();
    renderMatieresView();
    resetForm();
    refreshStats();
    refreshMatieresStats();
    refreshStudentList();
  }

  init();
})();