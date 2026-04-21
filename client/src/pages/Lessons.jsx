import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X, Trash2, ChevronLeft, ChevronRight } from "lucide-react";

const DURATION_OPTIONS = Array.from({ length: 12 }, (_, i) => (i + 1) * 5);

// Lesson types match base44's list. Pricing (hourly vs flat) is independent —
// any type can be billed either way.
const LESSON_TYPES = [
  { value: "private", label: "Private" },
  { value: "semi_private", label: "Semi Private", multi: true },
  { value: "competition", label: "Competition" },
  { value: "choreography", label: "Choreography" },
  { value: "off_ice_training", label: "Off-Ice Training", multi: true },
  { value: "expenses", label: "Expenses" },
];

const PRICING_TYPES = [
  { value: "hourly", label: "Hourly" },
  { value: "flat", label: "Flat" },
];

const MULTI_SKATER_TYPES = new Set(LESSON_TYPES.filter((t) => t.multi).map((t) => t.value));

// A lesson is billed hourly when pricing_type is "hourly". Fall back to the
// legacy `billing_type === "hourly"` when pricing_type isn't set (older data).
function isHourlyLesson(lesson) {
  if (lesson?.pricing_type) return lesson.pricing_type === "hourly";
  return lesson?.billing_type === "hourly";
}

// Color swatches per lesson type: { tile, dot } Tailwind class lists.
const TYPE_STYLES = {
  private: { tile: "bg-sky-50 hover:bg-sky-100 border-sky-200", dot: "bg-sky-500" },
  semi_private: { tile: "bg-purple-50 hover:bg-purple-100 border-purple-200", dot: "bg-purple-500" },
  competition: { tile: "bg-amber-50 hover:bg-amber-100 border-amber-200", dot: "bg-amber-500" },
  choreography: { tile: "bg-pink-50 hover:bg-pink-100 border-pink-200", dot: "bg-pink-500" },
  off_ice_training: { tile: "bg-emerald-50 hover:bg-emerald-100 border-emerald-200", dot: "bg-emerald-500" },
  expenses: { tile: "bg-slate-100 hover:bg-slate-200 border-slate-300", dot: "bg-slate-500" },
};
const DEFAULT_STYLE = { tile: "bg-slate-50 hover:bg-slate-100 border-slate-200", dot: "bg-slate-400" };
const styleFor = (type) => TYPE_STYLES[type] || DEFAULT_STYLE;

const money = (n) =>
  `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function skaterIdsOf(lesson) {
  if (Array.isArray(lesson?.skater_ids) && lesson.skater_ids.length > 0) {
    return lesson.skater_ids;
  }
  if (lesson?.student_id != null) return [lesson.student_id];
  return [];
}

function lessonTotal(lesson) {
  if (isHourlyLesson(lesson)) {
    const rate = Number(lesson.rate_per_hour || 0);
    const dur = Number(lesson.duration_mins || 0);
    const n = Math.max(1, skaterIdsOf(lesson).length);
    return (dur / 60) * rate / n;
  }
  return Number(lesson.flat_amount || 0);
}

// Per-skater amount for a lesson (already split among skaters for hourly;
// for flat lessons we split evenly among all skaters to compute a per-skater amount).
function perSkaterLessonAmount(lesson) {
  const n = Math.max(1, skaterIdsOf(lesson).length);
  if (isHourlyLesson(lesson)) {
    // lessonTotal for hourly is already per-skater (it divides by n).
    return lessonTotal(lesson);
  }
  return Number(lesson.flat_amount || 0) / n;
}

function isoKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfWeek(d) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  r.setDate(r.getDate() - r.getDay());
  return r;
}

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function typeLabel(v) {
  return LESSON_TYPES.find((t) => t.value === v)?.label || v;
}

function lessonSkaterDisplay(lesson, studentMap) {
  const names = Array.isArray(lesson?.skater_names) && lesson.skater_names.length > 0
    ? lesson.skater_names
    : skaterIdsOf(lesson).map((id) => studentMap[id]?.name || "—");
  return names.join(", ");
}

export default function Lessons() {
  const [lessons, setLessons] = useState([]);
  const [students, setStudents] = useState([]);
  const [calView, setCalView] = useState("week");
  const [cursor, setCursor] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/api/students")
      .then((data) => setStudents(Array.isArray(data) ? data : []))
      .catch(() => setStudents([]));
  }, []);

  // Determine which month(s) we need to fetch based on the visible range.
  const visibleMonths = useMemo(() => {
    const months = new Set();
    if (calView === "week") {
      const start = startOfWeek(cursor);
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        months.add(monthKey(d));
      }
    } else {
      months.add(monthKey(cursor));
    }
    return Array.from(months);
  }, [cursor, calView]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleMonths.join(",")]);

  const refresh = async () => {
    setLoading(true);
    try {
      // Fetch each visible month and merge. Dedupe by id in case of overlap.
      const results = await Promise.all(
        visibleMonths.map((m) =>
          api.get(`/api/lessons?month=${encodeURIComponent(m)}`).catch(() => [])
        )
      );
      const merged = new Map();
      for (const arr of results) {
        if (!Array.isArray(arr)) continue;
        for (const l of arr) merged.set(l.id, l);
      }
      setLessons(Array.from(merged.values()));
    } catch {
      setLessons([]);
    } finally {
      setLoading(false);
    }
  };

  const studentMap = useMemo(
    () => Object.fromEntries(students.map((s) => [s.id, s])),
    [students]
  );

  const visibleLessons = lessons;

  const totalRevenue = visibleLessons.reduce(
    (s, l) => s + perSkaterLessonAmount(l) * Math.max(1, skaterIdsOf(l).length),
    0
  );
  const uninvoiced = 0; // Invoice-tracking logic will come later.

  const nav = (delta) => {
    const d = new Date(cursor);
    if (calView === "week") d.setDate(d.getDate() + delta * 7);
    else d.setDate(d.getDate() + delta);
    setCursor(d);
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Lessons</h1>
          <p className="text-slate-500 mt-1">Track your daily lessons</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => setShowForm(true)}
            className="bg-slate-900 hover:bg-slate-800 rounded-xl h-11 px-5"
          >
            <Plus className="w-4 h-4 mr-2" /> Log Lesson
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          onClick={() => nav(-1)}
          className="p-2 rounded-lg hover:bg-slate-100"
          aria-label="Previous"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => setCursor(new Date())}
          className="px-4 h-9 rounded-lg border border-slate-200 bg-white text-sm"
        >
          Today
        </button>
        <button
          onClick={() => nav(1)}
          className="p-2 rounded-lg hover:bg-slate-100"
          aria-label="Next"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white ml-3 p-1">
          <button
            onClick={() => setCalView("week")}
            className={`px-4 h-8 text-sm rounded-md ${
              calView === "week" ? "bg-slate-900 text-white" : "text-slate-700"
            }`}
          >
            Week
          </button>
          <button
            onClick={() => setCalView("day")}
            className={`px-4 h-8 text-sm rounded-md ${
              calView === "day" ? "bg-slate-900 text-white" : "text-slate-700"
            }`}
          >
            Day
          </button>
        </div>
      </div>

      {calView === "week" ? (
        <WeekView
          cursor={cursor}
          lessons={visibleLessons}
          studentMap={studentMap}
          onEdit={setEditing}
          loading={loading}
        />
      ) : (
        <DayView
          cursor={cursor}
          lessons={visibleLessons}
          studentMap={studentMap}
          onEdit={setEditing}
        />
      )}

      <ColorLegend />

      <div className="grid grid-cols-3 gap-4 mt-6">
        <StatTile label="Total Lessons" value={visibleLessons.length} />
        <StatTile label="Total Revenue" value={money(totalRevenue)} />
        <StatTile label="Uninvoiced" value={uninvoiced} />
      </div>

      {(showForm || editing) && (
        <LessonModal
          lesson={editing}
          students={students}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSaved={refresh}
        />
      )}
    </div>
  );
}

function StatTile({ label, value }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-5 min-w-0">
      <div className="text-xs md:text-sm text-slate-500 truncate">{label}</div>
      <div className="text-lg md:text-2xl font-bold text-slate-900 mt-1 truncate tabular-nums">
        {value}
      </div>
    </div>
  );
}

function LessonCard({ lesson, studentMap, onEdit }) {
  const names = lessonSkaterDisplay(lesson, studentMap);
  const s = styleFor(lesson.billing_type);
  const ids = skaterIdsOf(lesson);
  return (
    <button
      onClick={() => onEdit(lesson)}
      className={`w-full text-left p-2 rounded-lg border text-xs ${s.tile}`}
    >
      <div className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
        <div className="font-medium text-slate-900 truncate">{names || "—"}</div>
      </div>
      <div className="text-slate-600 mt-0.5 truncate">
        {typeLabel(lesson.billing_type)}
        {isHourlyLesson(lesson) && lesson.duration_mins
          ? ` · ${lesson.duration_mins} min`
          : ""}
        {ids.length > 1 ? ` · ${ids.length} skaters` : ""}
      </div>
      <div className="font-semibold text-slate-900 mt-0.5 tabular-nums">
        {money(lessonTotal(lesson))}
      </div>
    </button>
  );
}

function DayCard({ date, lessons, studentMap, isToday, onEdit, large }) {
  return (
    <div
      className={`bg-white rounded-2xl border ${
        isToday ? "border-purple-400 ring-2 ring-purple-200" : "border-slate-200"
      } overflow-hidden flex flex-col ${large ? "min-h-[360px]" : "min-h-[220px]"}`}
    >
      <div className="p-3 bg-slate-50 border-b border-slate-100">
        <div className="text-xs font-medium text-slate-500">
          {date.toLocaleDateString("en-US", { weekday: "short" })}
        </div>
        <div
          className={`text-2xl font-bold ${
            isToday ? "text-purple-600" : "text-slate-900"
          }`}
        >
          {date.getDate()}
        </div>
        <div className="text-xs text-slate-400">{date.getFullYear()}</div>
      </div>
      <div className="flex-1 p-2 overflow-y-auto">
        {lessons.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-400">
            No lessons
          </div>
        ) : (
          <div className="space-y-2">
            {lessons.map((l) => (
              <LessonCard
                key={l.id}
                lesson={l}
                studentMap={studentMap}
                onEdit={onEdit}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function WeekView({ cursor, lessons, studentMap, onEdit }) {
  const start = startOfWeek(cursor);
  const todayKey = isoKey(new Date());
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
  return (
    <div className="-mx-4 md:mx-0 px-4 md:px-0 overflow-x-auto snap-x">
      <div className="grid grid-flow-col auto-cols-[minmax(9rem,1fr)] gap-3 md:grid-flow-row md:auto-cols-auto md:grid-cols-7">
        {days.map((d) => {
          const key = isoKey(d);
          const dayLessons = lessons.filter((l) => l.date === key);
          return (
            <div key={key} className="snap-start">
              <DayCard
                date={d}
                lessons={dayLessons}
                studentMap={studentMap}
                isToday={key === todayKey}
                onEdit={onEdit}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayView({ cursor, lessons, studentMap, onEdit }) {
  const key = isoKey(cursor);
  const todayKey = isoKey(new Date());
  const dayLessons = lessons.filter((l) => l.date === key);
  return (
    <DayCard
      date={cursor}
      lessons={dayLessons}
      studentMap={studentMap}
      isToday={key === todayKey}
      onEdit={onEdit}
      large
    />
  );
}

function ColorLegend() {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
      <span className="text-slate-500 font-medium">Lesson types:</span>
      {LESSON_TYPES.map((t) => {
        const s = styleFor(t.value);
        return (
          <span key={t.value} className="inline-flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
            {t.label}
          </span>
        );
      })}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-900 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Select({ value, onChange, options, placeholder }) {
  const opts = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-11 px-3 border border-slate-200 rounded-xl bg-white text-sm"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {opts.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function SkaterMultiPicker({ students, value, onChange }) {
  const [query, setQuery] = useState("");
  const selectedIds = new Set(value);
  const unselected = students
    .filter((s) => !selectedIds.has(s.id))
    .filter((s) => s.name.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  const add = (id) => {
    onChange([...value, id]);
    setQuery("");
  };
  const remove = (id) => onChange(value.filter((v) => v !== id));

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((id) => {
            const sk = students.find((s) => s.id === id);
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 bg-slate-900 text-white rounded-full px-3 py-1 text-xs"
              >
                {sk?.name || "—"}
                <button type="button" onClick={() => remove(id)}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}
      <div className="relative">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={value.length === 0 ? "Add skater to group" : "Add another skater"}
        />
        {query && unselected.length > 0 && (
          <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
            {unselected.slice(0, 12).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => add(s.id)}
                className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm"
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LessonModal({ lesson, students, onClose, onSaved }) {
  const initialSkaterIds = lesson ? skaterIdsOf(lesson).map((id) => Number(id)) : [];
  const [form, setForm] = useState(
    lesson
      ? {
          skater_ids: initialSkaterIds,
          date: lesson.date || new Date().toISOString().slice(0, 10),
          billing_type: lesson.billing_type || "private",
          pricing_type: lesson.pricing_type || (lesson.billing_type === "hourly" ? "hourly" : "hourly"),
          duration_mins: String(lesson.duration_mins ?? "30"),
          rate_per_hour: String(lesson.rate_per_hour ?? ""),
          flat_amount: String(lesson.flat_amount ?? ""),
          notes: lesson.notes || "",
        }
      : {
          skater_ids: [],
          date: new Date().toISOString().slice(0, 10),
          billing_type: "private",
          pricing_type: "hourly",
          duration_mins: "30",
          rate_per_hour: "",
          flat_amount: "",
          notes: "",
        }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const isHourly = form.pricing_type === "hourly";
  const isMulti = MULTI_SKATER_TYPES.has(form.billing_type);

  useEffect(() => {
    if (!isMulti && form.skater_ids.length > 1) {
      set("skater_ids", form.skater_ids.slice(0, 1));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.billing_type]);

  const totalCost = useMemo(() => {
    if (isHourly) {
      const rate = Number(form.rate_per_hour);
      const dur = Number(form.duration_mins);
      const n = Math.max(1, form.skater_ids.length);
      if (!rate || !dur) return 0;
      return (dur / 60) * rate / n;
    }
    return Number(form.flat_amount || 0);
  }, [form.rate_per_hour, form.duration_mins, form.flat_amount, form.skater_ids, form.billing_type, isHourly]);

  const handleDelete = async () => {
    if (!lesson) return;
    if (!confirm("Delete this lesson?")) return;
    try {
      await api.del(`/api/lessons/${lesson.id}`);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || String(err));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.skater_ids || form.skater_ids.length === 0) {
      return setError(isMulti ? "Add at least one skater to the group" : "Select a skater");
    }
    if (!isMulti && form.skater_ids.length > 1) {
      return setError("Private lessons can only have one skater");
    }
    if (!form.date) return setError("Select a date");
    if (isHourly) {
      if (!form.rate_per_hour || Number(form.rate_per_hour) <= 0)
        return setError("Enter a valid rate");
      if (!form.duration_mins || Number(form.duration_mins) <= 0)
        return setError("Enter a valid duration");
    } else {
      if (!form.flat_amount || Number(form.flat_amount) <= 0)
        return setError("Enter a valid flat amount");
    }
    setError("");
    setSaving(true);
    try {
      const payload = {
        skater_ids: form.skater_ids.map((id) => Number(id)),
        date: form.date,
        billing_type: form.billing_type,
        pricing_type: form.pricing_type,
        duration_mins: Number(form.duration_mins || 0),
        rate_per_hour: Number(form.rate_per_hour || 0),
        flat_amount: !isHourly ? Number(form.flat_amount || 0) : 0,
        notes: form.notes?.trim() || undefined,
      };
      if (lesson) {
        await api.put(`/api/lessons/${lesson.id}`, payload);
      } else {
        await api.post(`/api/lessons`, payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-900">
            {lesson ? "Edit Lesson" : "Add Lesson"}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Lesson Type *">
            <Select
              value={form.billing_type}
              onChange={(v) => set("billing_type", v)}
              options={LESSON_TYPES}
            />
          </Field>

          <Field label="Pricing *">
            <div className="flex gap-2">
              {PRICING_TYPES.map((p) => (
                <label
                  key={p.value}
                  className={`flex-1 cursor-pointer text-center px-3 py-2 rounded-lg border text-sm ${
                    form.pricing_type === p.value
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="pricing_type"
                    value={p.value}
                    checked={form.pricing_type === p.value}
                    onChange={() => set("pricing_type", p.value)}
                    className="sr-only"
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </Field>

          {isMulti ? (
            <Field label="Skaters in Group *">
              <SkaterMultiPicker
                students={students}
                value={form.skater_ids}
                onChange={(ids) => set("skater_ids", ids)}
              />
            </Field>
          ) : (
            <Field label="Skater *">
              <Select
                value={form.skater_ids[0] != null ? String(form.skater_ids[0]) : ""}
                onChange={(v) => set("skater_ids", v ? [Number(v)] : [])}
                options={students.map((s) => ({ value: String(s.id), label: s.name }))}
                placeholder="Select skater"
              />
            </Field>
          )}

          <Field label="Date *">
            <Input
              type="date"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
            />
          </Field>

          {isHourly ? (
            <>
              <Field label="Duration (min) *">
                <Select
                  value={String(form.duration_mins)}
                  onChange={(v) => set("duration_mins", v)}
                  options={DURATION_OPTIONS.map((n) => ({ value: String(n), label: `${n} min` }))}
                />
              </Field>
              <Field label="Rate ($/hr) *">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.rate_per_hour}
                  onChange={(e) => set("rate_per_hour", e.target.value)}
                  placeholder="0.00"
                />
                {isMulti && form.skater_ids.length > 1 && (
                  <div className="text-xs text-slate-500 mt-1">
                    Hourly cost will be split among {form.skater_ids.length} skaters.
                  </div>
                )}
              </Field>
            </>
          ) : (
            <Field label="Flat Amount ($) *">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.flat_amount}
                onChange={(e) => set("flat_amount", e.target.value)}
                placeholder="0.00"
              />
            </Field>
          )}

          <Field label="Notes">
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
              placeholder="Optional notes"
            />
          </Field>

          <div className="bg-slate-50 rounded-xl p-4">
            {form.skater_ids.length === 0 ? (
              <>
                <div className="text-xs text-slate-500">
                  {isMulti ? "Add skaters to calculate cost" : "Select a skater to calculate cost"}
                </div>
                <div className="text-2xl font-bold text-slate-900">$-</div>
              </>
            ) : form.skater_ids.length === 1 ? (
              <>
                <div className="text-xs text-slate-500">Lesson cost</div>
                <div className="text-2xl font-bold text-slate-900">{money(totalCost)}</div>
              </>
            ) : (
              <>
                <div className="text-xs text-slate-500">Cost per skater</div>
                <div className="text-2xl font-bold text-slate-900">{money(totalCost)}</div>
                <div className="text-xs text-slate-500 mt-2">
                  {form.skater_ids.length} skaters
                </div>
              </>
            )}
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="flex justify-between items-center pt-1">
            {lesson ? (
              <button
                type="button"
                onClick={handleDelete}
                className="text-sm text-red-600 hover:text-red-800 flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-slate-900 hover:bg-slate-800"
              >
                {saving ? "Saving..." : lesson ? "Save" : "Save Lesson"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
