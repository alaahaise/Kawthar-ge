const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  listStudents: (params) => ipcRenderer.invoke('students:list', params),
  getStudent: (id) => ipcRenderer.invoke('students:get', id),
  addStudent: (student) => ipcRenderer.invoke('students:add', student),
  previewMatricule: (year) => ipcRenderer.invoke('students:previewMatricule', year),
  updateStudent: (student) => ipcRenderer.invoke('students:update', student),
  deleteStudent: (id) => ipcRenderer.invoke('students:delete', id),
  countStudents: () => ipcRenderer.invoke('students:count'),
    selectPhoto: () => ipcRenderer.invoke('dialog:selectPhoto'),
  getPhotosDir: () => ipcRenderer.invoke('photos:getDir'),
  exportPdf: (suggestedName) => ipcRenderer.invoke('print:pdf', suggestedName),

  // Matières
  listMatieres: () => ipcRenderer.invoke('matieres:list'),
  matieresStats: () => ipcRenderer.invoke('matieres:stats'),
  addMatiere: (nom) => ipcRenderer.invoke('matieres:add', nom),
  deleteMatiere: (id) => ipcRenderer.invoke('matieres:delete', id),

  // Enseignants
  listTeachers: () => ipcRenderer.invoke('teachers:list'),
  addTeacher: (teacher) => ipcRenderer.invoke('teachers:add', teacher),
  deleteTeacher: (id) => ipcRenderer.invoke('teachers:delete', id),

  // Affectations matière <-> enseignant
  listMatiereTeachers: () => ipcRenderer.invoke('matiereTeachers:listAll'),
  listTeachersForMatiere: (matiereId) => ipcRenderer.invoke('matiereTeachers:listForMatiere', matiereId),
  addMatiereTeacher: (payload) => ipcRenderer.invoke('matiereTeachers:add', payload),
  removeMatiereTeacher: (payload) => ipcRenderer.invoke('matiereTeachers:remove', payload),

  // Inscriptions étudiant <-> matière/enseignant
  getStudentMatieres: (studentId) => ipcRenderer.invoke('studentMatieres:listForStudent', studentId),
  setStudentMatieres: (payload) => ipcRenderer.invoke('studentMatieres:setForStudent', payload)
});