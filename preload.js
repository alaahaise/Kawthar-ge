const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Écritures groupées (imports, remplissage de démonstration)
  dbBeginBatch: () => ipcRenderer.invoke('db:beginBatch'),
  dbEndBatch: () => ipcRenderer.invoke('db:endBatch'),
  dbCheckpoint: () => ipcRenderer.invoke('db:checkpoint'),
  // ---------- Étudiants ----------
  listStudents: (params) => ipcRenderer.invoke('students:list', params),
  listClasses: () => ipcRenderer.invoke('students:classes'),
  listStudentsForTeacher: (id) => ipcRenderer.invoke('students:listForTeacher', id),
  getStudent: (id) => ipcRenderer.invoke('students:get', id),
  addStudent: (student) => ipcRenderer.invoke('students:add', student),
  previewMatricule: (year) => ipcRenderer.invoke('students:previewMatricule', year),
  updateStudent: (student) => ipcRenderer.invoke('students:update', student),
  deleteStudent: (id) => ipcRenderer.invoke('students:delete', id),
  countStudents: () => ipcRenderer.invoke('students:count'),
  studentMatieresMap: () => ipcRenderer.invoke('students:matieresMap'),

  // ---------- Photos & impression ----------
  selectPhoto: () => ipcRenderer.invoke('dialog:selectPhoto'),
  getPhotosDir: () => ipcRenderer.invoke('photos:getDir'),
  exportPdf: (suggestedName) => ipcRenderer.invoke('print:pdf', suggestedName),
  importPhotos: () => ipcRenderer.invoke('students:importPhotos'),

  // ---------- Excel ----------
  excelTemplate: () => ipcRenderer.invoke('excel:template'),
  excelExport: () => ipcRenderer.invoke('excel:export'),
  excelImportPreview: () => ipcRenderer.invoke('excel:importPreview'),
  excelImportConfirm: (lignes) => ipcRenderer.invoke('excel:importConfirm', lignes),

  // ---------- Matières ----------
  listMatieres: () => ipcRenderer.invoke('matieres:list'),
  matieresStats: () => ipcRenderer.invoke('matieres:stats'),
  addMatiere: (payload) => ipcRenderer.invoke('matieres:add', payload),
  updateMatiere: (payload) => ipcRenderer.invoke('matieres:update', payload),
  deleteMatiere: (id) => ipcRenderer.invoke('matieres:delete', id),

  // ---------- Enseignants ----------
  listTeachers: () => ipcRenderer.invoke('teachers:list'),
  getTeacher: (id) => ipcRenderer.invoke('teachers:get', id),
  teacherDetail: (id) => ipcRenderer.invoke('teachers:detail', id),
  nextTeacherCode: () => ipcRenderer.invoke('teachers:nextCode'),
  addTeacher: (teacher) => ipcRenderer.invoke('teachers:add', teacher),
  updateTeacher: (teacher) => ipcRenderer.invoke('teachers:update', teacher),
  deleteTeacher: (id) => ipcRenderer.invoke('teachers:delete', id),

  // ---------- Cours (matière + enseignant) ----------
  listCours: () => ipcRenderer.invoke('cours:list'),
  listCoursForTeacher: (id) => ipcRenderer.invoke('cours:listForTeacher', id),
  listCoursForMatiere: (id) => ipcRenderer.invoke('cours:listForMatiere', id),
  coursInfo: (payload) => ipcRenderer.invoke('cours:info', payload),
  updateCours: (payload) => ipcRenderer.invoke('cours:update', payload),
  listMatiereTeachers: () => ipcRenderer.invoke('matiereTeachers:listAll'),
  listTeachersForMatiere: (matiereId) => ipcRenderer.invoke('matiereTeachers:listForMatiere', matiereId),
  addMatiereTeacher: (payload) => ipcRenderer.invoke('matiereTeachers:add', payload),
  removeMatiereTeacher: (payload) => ipcRenderer.invoke('matiereTeachers:remove', payload),

  // ---------- Inscriptions étudiant <-> matière/enseignant ----------
  getStudentMatieres: (studentId) => ipcRenderer.invoke('studentMatieres:listForStudent', studentId),
  setStudentMatieres: (payload) => ipcRenderer.invoke('studentMatieres:setForStudent', payload),
  listStudentsForMatiere: (payload) => ipcRenderer.invoke('studentMatieres:listForMatiere', payload),
  enrollStudent: (payload) => ipcRenderer.invoke('studentMatieres:enroll', payload),
  unenrollStudent: (payload) => ipcRenderer.invoke('studentMatieres:unenroll', payload),

  // ---------- Paiements mensuels ----------
  paymentsGrid: (params) => ipcRenderer.invoke('paiements:grid', params),
  togglePayment: (payload) => ipcRenderer.invoke('paiements:toggle', payload),
  markAllPayments: (payload) => ipcRenderer.invoke('paiements:markAll', payload),
  paymentsStats: (params) => ipcRenderer.invoke('paiements:stats', params),
  unpaidStudents: (params) => ipcRenderer.invoke('paiements:unpaid', params),
  paymentsReport: (params) => ipcRenderer.invoke('paiements:report', params),
  paiementsEtatEleves: (params) => ipcRenderer.invoke('paiements:etatEleves', params),
  paiementsGrilleEleve: (params) => ipcRenderer.invoke('paiements:grilleEleve', params),

  // ---------- Année de travail ----------
  anneeInitiale: () => ipcRenderer.invoke('annee:initiale'),
  definirAnnee: (annee) => ipcRenderer.invoke('annee:definir', annee),

  // ---------- Tableau de bord ----------
  statsRevenue: (params) => ipcRenderer.invoke('stats:revenue', params),
  statsRevenueParMatiere: (params) => ipcRenderer.invoke('stats:revenueParMatiere', params),
  statsGlobales: (params) => ipcRenderer.invoke('stats:globales', params || {})
});