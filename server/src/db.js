const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../coach.json');

let cache = null;

function load() {
  if (cache) return cache;
  if (!fs.existsSync(DB_PATH)) {
    cache = { students: [], lessons: [], profiles: {}, nextStudentId: 1, nextLessonId: 1 };
    return cache;
  }
  cache = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  if (!cache.profiles) cache.profiles = {};
  return cache;
}

function save(data) {
  cache = data;
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

const db = {
  // Students
  getStudents(owner_email) {
    return load().students.filter((s) => s.owner_email === owner_email).sort((a, b) => a.name.localeCompare(b.name));
  },
  getStudent(id, owner_email) {
    return load().students.find((s) => s.id === Number(id) && s.owner_email === owner_email);
  },
  addStudent(owner_email, student) {
    const data = load();
    const newStudent = { ...student, owner_email, id: data.nextStudentId++ };
    data.students.push(newStudent);
    save(data);
    return newStudent;
  },
  updateStudent(id, owner_email, updates) {
    const data = load();
    const idx = data.students.findIndex((s) => s.id === Number(id) && s.owner_email === owner_email);
    if (idx === -1) return null;
    data.students[idx] = { ...data.students[idx], ...updates, id: Number(id), owner_email };
    save(data);
    return data.students[idx];
  },
  deleteStudent(id, owner_email) {
    const data = load();
    data.students = data.students.filter((s) => !(s.id === Number(id) && s.owner_email === owner_email));
    data.lessons = data.lessons.filter((l) => !(l.student_id === Number(id) && l.owner_email === owner_email));
    save(data);
  },

  // Lessons
  getLessons(owner_email, { student_id, month } = {}) {
    let { lessons } = load();
    lessons = lessons.filter((l) => l.owner_email === owner_email);
    if (student_id) lessons = lessons.filter((l) => l.student_id === Number(student_id));
    if (month) lessons = lessons.filter((l) => l.date.slice(0, 7) === month);
    return lessons.sort((a, b) => b.date.localeCompare(a.date));
  },
  getLesson(id, owner_email) {
    return load().lessons.find((l) => l.id === Number(id) && l.owner_email === owner_email);
  },
  addLesson(owner_email, lesson) {
    const data = load();
    const newLesson = { ...lesson, owner_email, id: data.nextLessonId++ };
    data.lessons.push(newLesson);
    save(data);
    return newLesson;
  },
  updateLesson(id, owner_email, updates) {
    const data = load();
    const idx = data.lessons.findIndex((l) => l.id === Number(id) && l.owner_email === owner_email);
    if (idx === -1) return null;
    data.lessons[idx] = { ...data.lessons[idx], ...updates, id: Number(id), owner_email };
    save(data);
    return data.lessons[idx];
  },
  deleteLesson(id, owner_email) {
    const data = load();
    data.lessons = data.lessons.filter((l) => !(l.id === Number(id) && l.owner_email === owner_email));
    save(data);
  },

  // Balance Entries
  getBalanceEntries(studentId, owner_email) {
    const student = this.getStudent(studentId, owner_email);
    if (!student) return null;
    return (student.balance_entries || []).sort((a, b) => b.date.localeCompare(a.date));
  },
  addBalanceEntry(studentId, owner_email, entry) {
    const data = load();
    const idx = data.students.findIndex((s) => s.id === Number(studentId) && s.owner_email === owner_email);
    if (idx === -1) return null;
    if (!data.students[idx].balance_entries) data.students[idx].balance_entries = [];
    const newEntry = { id: Date.now(), ...entry };
    data.students[idx].balance_entries.push(newEntry);
    save(data);
    return newEntry;
  },
  updateBalanceEntry(studentId, owner_email, entryId, updates) {
    const data = load();
    const idx = data.students.findIndex((s) => s.id === Number(studentId) && s.owner_email === owner_email);
    if (idx === -1) return null;
    const entries = data.students[idx].balance_entries || [];
    const eIdx = entries.findIndex((e) => e.id === Number(entryId));
    if (eIdx === -1) return null;
    entries[eIdx] = { ...entries[eIdx], ...updates };
    data.students[idx].balance_entries = entries;
    save(data);
    return entries[eIdx];
  },
  deleteBalanceEntry(studentId, owner_email, entryId) {
    const data = load();
    const idx = data.students.findIndex((s) => s.id === Number(studentId) && s.owner_email === owner_email);
    if (idx === -1) return false;
    data.students[idx].balance_entries = (data.students[idx].balance_entries || []).filter((e) => e.id !== Number(entryId));
    save(data);
    return true;
  },

  // Invoice Records
  addInvoiceRecord(owner_email, record) {
    const data = load();
    if (!data.invoice_records) data.invoice_records = [];
    const newRecord = { id: Date.now(), ...record, owner_email, sent_at: new Date().toISOString() };
    data.invoice_records.push(newRecord);
    save(data);
    return newRecord;
  },
  getInvoiceRecords(owner_email, student_id) {
    const data = load();
    const records = (data.invoice_records || []).filter((r) => r.owner_email === owner_email);
    const filtered = student_id ? records.filter((r) => r.student_id === Number(student_id)) : records;
    return filtered.sort((a, b) => b.sent_at.localeCompare(a.sent_at));
  },

  // Profile
  getProfile(owner_email) {
    return load().profiles[owner_email] || null;
  },
  setProfile(owner_email, profile) {
    const data = load();
    data.profiles[owner_email] = { ...profile, owner_email };
    save(data);
    return data.profiles[owner_email];
  },
};

module.exports = db;
