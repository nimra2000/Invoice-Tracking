import { useRef, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Database, Download, Upload } from 'lucide-react';
import { stringifyCSV, parseCSV, downloadCSV } from '@/lib/csv';

const STUDENT_HEADERS = ['name', 'billing_name', 'billing_emails'];
const LESSON_HEADERS = [
  'date',
  'skater_names',
  'billing_type',
  'pricing_type',
  'duration_mins',
  'rate_per_hour',
  'flat_amount',
  'notes',
];

export default function DataBackup() {
  const [status, setStatus] = useState(null); // { type: 'ok'|'error', message: string }
  const studentFileRef = useRef(null);
  const lessonFileRef = useRef(null);

  const setOk = (message) => setStatus({ type: 'ok', message });
  const setErr = (message) => setStatus({ type: 'error', message });

  const joinEmails = (v) => {
    if (Array.isArray(v)) return v.join(';');
    if (typeof v === 'string') return v;
    return '';
  };

  const exportStudents = async () => {
    setStatus(null);
    try {
      const students = await api.get('/api/students');
      const rows = (students || []).map((s) => ({
        name: s.name || '',
        billing_name: s.billing_name || '',
        billing_emails: joinEmails(s.billing_emails),
      }));
      downloadCSV('students.csv', stringifyCSV(STUDENT_HEADERS, rows));
      setOk(`Exported ${rows.length} record${rows.length === 1 ? '' : 's'} to students.csv.`);
    } catch (err) {
      setErr(err.message || String(err));
    }
  };

  const exportLessons = async () => {
    setStatus(null);
    try {
      const [students, lessons] = await Promise.all([
        api.get('/api/students'),
        api.get('/api/lessons'),
      ]);
      const stMap = Object.fromEntries((students || []).map((s) => [s.id, s.name]));
      const rows = (lessons || []).map((l) => {
        const names = Array.isArray(l.skater_names) && l.skater_names.length
          ? l.skater_names
          : (l.skater_ids || []).map((id) => stMap[id]).filter(Boolean);
        return {
          date: l.date || '',
          skater_names: names.join(';'),
          billing_type: l.billing_type || '',
          pricing_type: l.pricing_type || (l.billing_type === 'hourly' ? 'hourly' : ''),
          duration_mins: l.duration_mins ?? '',
          rate_per_hour: l.rate_per_hour ?? '',
          flat_amount: l.flat_amount ?? '',
          notes: l.notes || '',
        };
      });
      downloadCSV('lessons.csv', stringifyCSV(LESSON_HEADERS, rows));
      setOk(`Exported ${rows.length} record${rows.length === 1 ? '' : 's'} to lessons.csv.`);
    } catch (err) {
      setErr(err.message || String(err));
    }
  };

  const readFile = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(file);
    });

  const isEmptyRow = (r) => Object.values(r).every((v) => !v || !String(v).trim());

  const toNum = (v) => {
    if (v === undefined || v === null || String(v).trim() === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  const handleImportStudents = async (e) => {
    setStatus(null);
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await readFile(file);
      const { records } = parseCSV(text);
      let created = 0;
      let skipped = 0;
      for (const raw of records) {
        if (isEmptyRow(raw)) continue;
        const name = (raw.name || '').trim();
        if (!name) {
          skipped++;
          continue;
        }
        const emails = (raw.billing_emails || '')
          .split(/[;,]/)
          .map((s) => s.trim())
          .filter(Boolean);
        try {
          await api.post('/api/students', {
            name,
            billing_name: (raw.billing_name || '').trim() || undefined,
            billing_emails: emails,
          });
          created++;
        } catch {
          skipped++;
        }
      }
      setOk(`Imported ${created} record${created === 1 ? '' : 's'}, skipped ${skipped}.`);
    } catch (err) {
      setErr(err.message || String(err));
    } finally {
      if (studentFileRef.current) studentFileRef.current.value = '';
    }
  };

  const handleImportLessons = async (e) => {
    setStatus(null);
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await readFile(file);
      const { records } = parseCSV(text);
      const students = await api.get('/api/students');
      const byName = Object.fromEntries(
        (students || [])
          .filter((s) => s.name)
          .map((s) => [s.name.trim().toLowerCase(), s.id])
      );
      let created = 0;
      let skipped = 0;
      const unmatched = new Set();
      for (const raw of records) {
        if (isEmptyRow(raw)) continue;
        const namesRaw = (raw.skater_names || raw.student_name || '').trim();
        const date = (raw.date || '').trim();
        const names = namesRaw.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
        const skaterIds = [];
        for (const n of names) {
          const id = byName[n.toLowerCase()];
          if (id) skaterIds.push(id);
          else unmatched.add(n);
        }
        if (skaterIds.length === 0 || !date) {
          skipped++;
          continue;
        }
        const payload = {
          skater_ids: skaterIds,
          date,
          billing_type: (raw.billing_type || '').trim() || undefined,
          pricing_type: (raw.pricing_type || '').trim() || undefined,
          duration_mins: toNum(raw.duration_mins),
          rate_per_hour: toNum(raw.rate_per_hour),
          flat_amount: toNum(raw.flat_amount),
          notes: (raw.notes || '').trim() || undefined,
        };
        try {
          await api.post('/api/lessons', payload);
          created++;
        } catch {
          skipped++;
        }
      }
      const unmatchedMsg =
        unmatched.size > 0
          ? ` Unknown students: ${[...unmatched].slice(0, 5).join(', ')}${unmatched.size > 5 ? '…' : ''}.`
          : '';
      setOk(`Imported ${created} record${created === 1 ? '' : 's'}, skipped ${skipped}.${unmatchedMsg}`);
    } catch (err) {
      setErr(err.message || String(err));
    } finally {
      if (lessonFileRef.current) lessonFileRef.current.value = '';
    }
  };

  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
          <Database className="w-5 h-5 text-slate-600" />
        </div>
        <div>
          <h2 className="font-semibold text-slate-900">Data Backup</h2>
          <p className="text-sm text-slate-500">
            Export your students and lessons to CSV, or import them back.
          </p>
        </div>
      </div>

      <div className="mb-5">
        <h3 className="font-medium text-slate-900 mb-1">Students</h3>
        <p className="text-xs text-slate-500 mb-3">
          Columns: {STUDENT_HEADERS.join(', ')}. billing_emails is semicolon-separated.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={exportStudents}
            className="border-slate-200"
          >
            <Download className="w-4 h-4 mr-2" /> Export students.csv
          </Button>
          <label className="cursor-pointer border border-slate-200 rounded-lg px-4 py-3 flex items-center justify-center gap-2 text-sm hover:bg-slate-50">
            <Upload className="w-4 h-4" /> Import students CSV
            <input
              ref={studentFileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleImportStudents}
              className="hidden"
            />
          </label>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-5">
        <h3 className="font-medium text-slate-900 mb-1">Lessons</h3>
        <p className="text-xs text-slate-500 mb-3">
          Columns: {LESSON_HEADERS.join(', ')}. skater_names is semicolon-separated; import students first so names resolve.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={exportLessons}
            className="border-slate-200"
          >
            <Download className="w-4 h-4 mr-2" /> Export lessons.csv
          </Button>
          <label className="cursor-pointer border border-slate-200 rounded-lg px-4 py-3 flex items-center justify-center gap-2 text-sm hover:bg-slate-50">
            <Upload className="w-4 h-4" /> Import lessons CSV
            <input
              ref={lessonFileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleImportLessons}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {status && (
        <div
          className={`mt-4 p-3 rounded-xl text-sm ${
            status.type === 'ok'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {status.message}
        </div>
      )}
    </section>
  );
}
