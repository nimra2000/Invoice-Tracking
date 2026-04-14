const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 2,
});

let cache = null;

async function load() {
  if (cache) return cache;
  await pool.query(`CREATE TABLE IF NOT EXISTS store (id INT PRIMARY KEY, data JSONB NOT NULL)`);
  const res = await pool.query('SELECT data FROM store WHERE id = 1');
  if (res.rows.length === 0) {
    cache = { students: [], lessons: [], profiles: {}, invoice_records: [], nextStudentId: 1, nextLessonId: 1 };
    await pool.query('INSERT INTO store (id, data) VALUES (1, $1)', [JSON.stringify(cache)]);
  } else {
    cache = res.rows[0].data;
    if (!cache.profiles) cache.profiles = {};
    if (!cache.invoice_records) cache.invoice_records = [];
  }
  return cache;
}

async function save(data) {
  cache = data;
  await pool.query('UPDATE store SET data = $1 WHERE id = 1', [JSON.stringify(data)]);
}

const db = {
  // Students
  async getStudents(owner_email) {
    const data = await load();
    return data.students.filter((s) => s.owner_email === owner_email).sort((a, b) => a.name.localeCompare(b.name));
  },
  async getStudent(id, owner_email) {
    const data = await load();
    return data.students.find((s) => s.id === Number(id) && s.owner_email === owner_email) || null;
  },
  async addStudent(owner_email, student) {
    const data = await load();
    const newStudent = { ...student, owner_email, id: data.nextStudentId++ };
    data.students.push(newStudent);
    await save(data);
    return newStudent;
  },
  async updateStudent(id, owner_email, updates) {
    const data = await load();
    const idx = data.students.findIndex((s) => s.id === Number(id) && s.owner_email === owner_email);
    if (idx === -1) return null;
    data.students[idx] = { ...data.students[idx], ...updates, id: Number(id), owner_email };
    await save(data);
    return data.students[idx];
  },
  async deleteStudent(id, owner_email) {
    const data = await load();
    data.students = data.students.filter((s) => !(s.id === Number(id) && s.owner_email === owner_email));
    data.lessons = data.lessons.filter((l) => !(l.student_id === Number(id) && l.owner_email === owner_email));
    await save(data);
  },

  // Lessons
  async getLessons(owner_email, { student_id, month } = {}) {
    const data = await load();
    let lessons = data.lessons.filter((l) => l.owner_email === owner_email);
    if (student_id) lessons = lessons.filter((l) => l.student_id === Number(student_id));
    if (month) lessons = lessons.filter((l) => l.date.slice(0, 7) === month);
    return lessons.sort((a, b) => b.date.localeCompare(a.date));
  },
  async addLesson(owner_email, lesson) {
    const data = await load();
    const newLesson = { ...lesson, owner_email, id: data.nextLessonId++ };
    data.lessons.push(newLesson);
    await save(data);
    return newLesson;
  },
  async updateLesson(id, owner_email, updates) {
    const data = await load();
    const idx = data.lessons.findIndex((l) => l.id === Number(id) && l.owner_email === owner_email);
    if (idx === -1) return null;
    data.lessons[idx] = { ...data.lessons[idx], ...updates, id: Number(id), owner_email };
    await save(data);
    return data.lessons[idx];
  },
  async deleteLesson(id, owner_email) {
    const data = await load();
    data.lessons = data.lessons.filter((l) => !(l.id === Number(id) && l.owner_email === owner_email));
    await save(data);
  },

  // Balance Entries
  async getBalanceEntries(studentId, owner_email) {
    const student = await this.getStudent(studentId, owner_email);
    if (!student) return null;
    return (student.balance_entries || []).sort((a, b) => b.date.localeCompare(a.date));
  },
  async addBalanceEntry(studentId, owner_email, entry) {
    const data = await load();
    const idx = data.students.findIndex((s) => s.id === Number(studentId) && s.owner_email === owner_email);
    if (idx === -1) return null;
    if (!data.students[idx].balance_entries) data.students[idx].balance_entries = [];
    const newEntry = { id: Date.now(), ...entry };
    data.students[idx].balance_entries.push(newEntry);
    await save(data);
    return newEntry;
  },
  async updateBalanceEntry(studentId, owner_email, entryId, updates) {
    const data = await load();
    const idx = data.students.findIndex((s) => s.id === Number(studentId) && s.owner_email === owner_email);
    if (idx === -1) return null;
    const entries = data.students[idx].balance_entries || [];
    const eIdx = entries.findIndex((e) => e.id === Number(entryId));
    if (eIdx === -1) return null;
    entries[eIdx] = { ...entries[eIdx], ...updates };
    data.students[idx].balance_entries = entries;
    await save(data);
    return entries[eIdx];
  },
  async deleteBalanceEntry(studentId, owner_email, entryId) {
    const data = await load();
    const idx = data.students.findIndex((s) => s.id === Number(studentId) && s.owner_email === owner_email);
    if (idx === -1) return false;
    data.students[idx].balance_entries = (data.students[idx].balance_entries || []).filter((e) => e.id !== Number(entryId));
    await save(data);
    return true;
  },

  // Invoice Records
  async addInvoiceRecord(owner_email, record) {
    const data = await load();
    const newRecord = { id: Date.now(), ...record, owner_email, sent_at: new Date().toISOString() };
    data.invoice_records.push(newRecord);
    await save(data);
    return newRecord;
  },
  async getInvoiceRecords(owner_email, student_id) {
    const data = await load();
    const records = data.invoice_records.filter((r) => r.owner_email === owner_email);
    const filtered = student_id ? records.filter((r) => r.student_id === Number(student_id)) : records;
    return filtered.sort((a, b) => b.sent_at.localeCompare(a.sent_at));
  },

  // Profile
  async getProfile(owner_email) {
    const data = await load();
    return data.profiles[owner_email] || null;
  },
  async setProfile(owner_email, profile) {
    const data = await load();
    data.profiles[owner_email] = { ...profile, owner_email };
    await save(data);
    return data.profiles[owner_email];
  },
};

module.exports = db;
