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
    const fresh = { students: [], lessons: [], profiles: {}, invoice_records: [], nextStudentId: 1, nextLessonId: 1 };
    await pool.query('INSERT INTO store (id, data) VALUES (1, $1)', [JSON.stringify(fresh)]);
    return fresh;
  }
  const data = res.rows[0].data;
  if (!data.profiles) data.profiles = {};
  if (!data.invoice_records) data.invoice_records = [];
  if (!data.schedules) data.schedules = [];
  if (!data.schedule_exceptions) data.schedule_exceptions = [];
  if (!data.nextScheduleId) data.nextScheduleId = 1;
  if (!data.nextExceptionId) data.nextExceptionId = 1;
  if (!data.events) data.events = [];
  if (!data.event_exceptions) data.event_exceptions = [];
  if (!data.nextEventId) data.nextEventId = 1;
  if (!data.nextEventExceptionId) data.nextEventExceptionId = 1;
  return data;
}

async function save(data) {
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

  // Recurring Schedules
  async getSchedules(owner_email, student_id) {
    const data = await load();
    let s = data.schedules.filter((s) => s.owner_email === owner_email);
    if (student_id) s = s.filter((s) => s.student_id === Number(student_id));
    return s;
  },
  async addSchedule(owner_email, schedule) {
    const data = await load();
    const s = { ...schedule, owner_email, id: data.nextScheduleId++ };
    data.schedules.push(s);
    await save(data);
    return s;
  },
  async updateSchedule(id, owner_email, updates) {
    const data = await load();
    const idx = data.schedules.findIndex((s) => s.id === Number(id) && s.owner_email === owner_email);
    if (idx === -1) return null;
    data.schedules[idx] = { ...data.schedules[idx], ...updates, id: Number(id), owner_email };
    await save(data);
    return data.schedules[idx];
  },
  async deleteSchedule(id, owner_email) {
    const data = await load();
    data.schedules = data.schedules.filter((s) => !(s.id === Number(id) && s.owner_email === owner_email));
    data.schedule_exceptions = data.schedule_exceptions.filter((e) => !(e.schedule_id === Number(id) && e.owner_email === owner_email));
    await save(data);
  },

  // Schedule Exceptions
  async getExceptions(owner_email, schedule_id) {
    const data = await load();
    let e = data.schedule_exceptions.filter((e) => e.owner_email === owner_email);
    if (schedule_id != null) e = e.filter((e) => e.schedule_id === Number(schedule_id));
    return e;
  },
  async upsertException(owner_email, exception) {
    const data = await load();
    const idx = data.schedule_exceptions.findIndex(
      (e) => e.schedule_id === Number(exception.schedule_id) && e.occurrence_date === exception.occurrence_date && e.owner_email === owner_email
    );
    if (idx !== -1) {
      data.schedule_exceptions[idx] = { ...data.schedule_exceptions[idx], ...exception, owner_email };
    } else {
      data.schedule_exceptions.push({ ...exception, id: data.nextExceptionId++, owner_email });
    }
    await save(data);
  },
  async deleteException(owner_email, schedule_id, occurrence_date) {
    const data = await load();
    data.schedule_exceptions = data.schedule_exceptions.filter(
      (e) => !(e.schedule_id === Number(schedule_id) && e.occurrence_date === occurrence_date && e.owner_email === owner_email)
    );
    await save(data);
  },

  // Events (unified one-time + recurring charges)
  async getEvents(owner_email) {
    const data = await load();
    return data.events.filter((e) => e.owner_email === owner_email);
  },
  async addEvent(owner_email, event) {
    const data = await load();
    const e = { ...event, owner_email, id: data.nextEventId++ };
    data.events.push(e);
    await save(data);
    return e;
  },
  async updateEvent(id, owner_email, updates) {
    const data = await load();
    const idx = data.events.findIndex((e) => e.id === Number(id) && e.owner_email === owner_email);
    if (idx === -1) return null;
    data.events[idx] = { ...data.events[idx], ...updates, id: Number(id), owner_email };
    await save(data);
    return data.events[idx];
  },
  async deleteEvent(id, owner_email) {
    const data = await load();
    data.events = data.events.filter((e) => !(e.id === Number(id) && e.owner_email === owner_email));
    data.event_exceptions = data.event_exceptions.filter((e) => !(e.event_id === Number(id) && e.owner_email === owner_email));
    await save(data);
  },
  async getEventExceptions(owner_email, event_id) {
    const data = await load();
    let excs = data.event_exceptions.filter((e) => e.owner_email === owner_email);
    if (event_id != null) excs = excs.filter((e) => e.event_id === Number(event_id));
    return excs;
  },
  async upsertEventException(owner_email, exc) {
    const data = await load();
    const idx = data.event_exceptions.findIndex(
      (e) => e.event_id === Number(exc.event_id) && e.occurrence_date === exc.occurrence_date && e.owner_email === owner_email
    );
    if (idx !== -1) {
      data.event_exceptions[idx] = { ...data.event_exceptions[idx], ...exc, owner_email };
    } else {
      data.event_exceptions.push({ ...exc, id: data.nextEventExceptionId++, owner_email });
    }
    await save(data);
  },
  async deleteEventException(owner_email, event_id, occurrence_date) {
    const data = await load();
    data.event_exceptions = data.event_exceptions.filter(
      (e) => !(e.event_id === Number(event_id) && e.occurrence_date === occurrence_date && e.owner_email === owner_email)
    );
    await save(data);
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
