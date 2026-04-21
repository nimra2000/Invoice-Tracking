const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 2,
});

let tableEnsured = false;

async function load() {
  if (!tableEnsured) {
    await pool.query(`CREATE TABLE IF NOT EXISTS store (id INT PRIMARY KEY, data JSONB NOT NULL)`);
    tableEnsured = true;
  }
  const res = await pool.query('SELECT data FROM store WHERE id = 1');
  if (res.rows.length === 0) {
    const fresh = { students: [], lessons: [], profiles: {}, invoice_records: [], invoices: [], nextStudentId: 1, nextLessonId: 1, nextInvoiceId: 1 };
    await pool.query('INSERT INTO store (id, data) VALUES (1, $1)', [JSON.stringify(fresh)]);
    return fresh;
  }
  const data = res.rows[0].data;
  if (!data.profiles) data.profiles = {};
  if (!data.invoice_records) data.invoice_records = [];
  if (!data.invoices) data.invoices = [];
  if (!data.nextInvoiceId) data.nextInvoiceId = 1;
  return data;
}

async function save(data) {
  await pool.query('UPDATE store SET data = $1 WHERE id = 1', [JSON.stringify(data)]);
}

// Lessons may carry legacy single-student fields (student_id + num_students) OR
// the newer skater_ids[] array. Treat skater_ids as the source of truth and
// fall back to [student_id] when only the legacy field is present.
function lessonSkaterIds(lesson) {
  if (Array.isArray(lesson?.skater_ids) && lesson.skater_ids.length) {
    return lesson.skater_ids.map(Number).filter((n) => Number.isFinite(n));
  }
  if (lesson?.student_id != null) return [Number(lesson.student_id)];
  return [];
}

function normalizeSkaterIds(input) {
  if (Array.isArray(input?.skater_ids)) {
    return input.skater_ids.map(Number).filter((n) => Number.isFinite(n));
  }
  if (input?.student_id != null) return [Number(input.student_id)];
  return [];
}

function normalizeLesson(lesson) {
  const skater_ids = lessonSkaterIds(lesson);
  return {
    ...lesson,
    skater_ids,
    student_id: skater_ids[0] ?? null,
    num_students: skater_ids.length || Number(lesson.num_students) || 1,
  };
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
    const sid = Number(id);
    data.students = data.students.filter((s) => !(s.id === sid && s.owner_email === owner_email));
    // Remove this student from skater_ids on every lesson; drop lessons where no skaters remain.
    data.lessons = data.lessons
      .map((l) => {
        if (l.owner_email !== owner_email) return l;
        const ids = lessonSkaterIds(l).filter((x) => x !== sid);
        return { ...l, skater_ids: ids, student_id: ids[0] ?? null };
      })
      .filter((l) => l.owner_email !== owner_email || lessonSkaterIds(l).length > 0);
    await save(data);
  },

  // Lessons
  async getLessons(owner_email, { student_id, month, date_from, date_to } = {}) {
    const data = await load();
    let lessons = data.lessons.filter((l) => l.owner_email === owner_email);
    if (student_id) {
      const sid = Number(student_id);
      lessons = lessons.filter((l) => lessonSkaterIds(l).includes(sid));
    }
    if (month) lessons = lessons.filter((l) => l.date.slice(0, 7) === month);
    if (date_from) lessons = lessons.filter((l) => l.date >= date_from);
    if (date_to) lessons = lessons.filter((l) => l.date <= date_to);
    return lessons.sort((a, b) => b.date.localeCompare(a.date)).map(normalizeLesson);
  },
  async addLesson(owner_email, lesson) {
    const data = await load();
    const skater_ids = normalizeSkaterIds(lesson);
    const newLesson = {
      ...lesson,
      skater_ids,
      student_id: skater_ids[0] ?? null,
      num_students: skater_ids.length || Number(lesson.num_students) || 1,
      owner_email,
      id: data.nextLessonId++,
    };
    data.lessons.push(newLesson);
    await save(data);
    return normalizeLesson(newLesson);
  },
  async updateLesson(id, owner_email, updates) {
    const data = await load();
    const idx = data.lessons.findIndex((l) => l.id === Number(id) && l.owner_email === owner_email);
    if (idx === -1) return null;
    const merged = { ...data.lessons[idx], ...updates };
    const skater_ids = normalizeSkaterIds(merged);
    data.lessons[idx] = {
      ...merged,
      skater_ids,
      student_id: skater_ids[0] ?? null,
      num_students: skater_ids.length || Number(merged.num_students) || 1,
      id: Number(id),
      owner_email,
    };
    await save(data);
    return normalizeLesson(data.lessons[idx]);
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
    const eIdx = entries.findIndex((e) => String(e.id) === String(entryId));
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

  // Invoices (stored entity)
  async getInvoices(owner_email, { student_id, month, status } = {}) {
    const data = await load();
    let invoices = data.invoices.filter((i) => i.owner_email === owner_email);
    if (student_id != null) invoices = invoices.filter((i) => i.student_id === Number(student_id));
    if (month) invoices = invoices.filter((i) => i.month === month);
    if (status) invoices = invoices.filter((i) => i.status === status);
    return invoices.sort((a, b) => (b.month || '').localeCompare(a.month || ''));
  },
  async getInvoice(id, owner_email) {
    const data = await load();
    return data.invoices.find((i) => i.id === Number(id) && i.owner_email === owner_email) || null;
  },
  async addInvoice(owner_email, invoice) {
    const data = await load();
    const newInvoice = { ...invoice, owner_email, id: data.nextInvoiceId++ };
    data.invoices.push(newInvoice);
    await save(data);
    return newInvoice;
  },
  async updateInvoice(id, owner_email, updates) {
    const data = await load();
    const idx = data.invoices.findIndex((i) => i.id === Number(id) && i.owner_email === owner_email);
    if (idx === -1) return null;
    data.invoices[idx] = { ...data.invoices[idx], ...updates, id: Number(id), owner_email };
    await save(data);
    return data.invoices[idx];
  },
  async deleteInvoice(id, owner_email) {
    const data = await load();
    const before = data.invoices.length;
    data.invoices = data.invoices.filter((i) => !(i.id === Number(id) && i.owner_email === owner_email));
    const removed = before !== data.invoices.length;
    if (removed) await save(data);
    return removed;
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
