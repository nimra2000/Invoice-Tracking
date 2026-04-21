import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FileText,
  Plus,
  X,
  Send,
  Trash2,
  CheckCircle2,
  ChevronRight,
  Eye,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

const currentMonth = () => new Date().toISOString().slice(0, 7);

function money(n) {
  const num = Number(n || 0);
  const sign = num < 0 ? '-' : '';
  return `${sign}$${Math.abs(num).toFixed(2)}`;
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    const d = typeof iso === 'string' && iso.length >= 10 ? iso.slice(0, 10) : iso;
    return new Date(d + (typeof d === 'string' && d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return String(iso);
  }
}

function monthLabel(m) {
  if (!m) return '';
  const [y, mo] = m.split('-').map(Number);
  if (!y || !mo) return m;
  return new Date(y, mo - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

export default function Invoices() {
  const [students, setStudents] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [viewingId, setViewingId] = useState(null);

  useEffect(() => {
    api
      .get('/api/students')
      .then((data) => setStudents(Array.isArray(data) ? data : []))
      .catch(() => setStudents([]));
  }, []);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const data = await api.get('/api/invoices').catch(() => []);
      const list = Array.isArray(data) ? data : [];
      list.sort((a, b) =>
        (b.invoice_date || '').localeCompare(a.invoice_date || '')
      );
      setInvoices(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const studentMap = useMemo(
    () =>
      Object.fromEntries(students.map((s) => [String(s.id), s])),
    [students]
  );

  const totalCount = invoices.length;
  const pendingSum = invoices
    .filter((inv) => inv.status === 'pending')
    .reduce((sum, inv) => sum + Number(inv.total || 0), 0);
  const paidSum = invoices
    .filter((inv) => inv.status === 'paid')
    .reduce((sum, inv) => sum + Number(inv.total || 0), 0);

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <div className="flex items-start justify-between gap-3 mb-6">
        <h1 className="text-3xl font-bold text-slate-900">Invoices</h1>
        <Button
          onClick={() => setShowCreate(true)}
          className="bg-slate-900 hover:bg-slate-800 rounded-xl h-11 px-4 shrink-0"
        >
          <Plus className="w-4 h-4 mr-2" />
          Generate Invoices
        </Button>
      </div>

      {/* Help strip */}
      <div className="bg-slate-50 text-slate-600 text-sm px-4 py-2 rounded-t-2xl border-x border-t border-slate-200">
        Click an invoice to preview, send, or mark paid.
      </div>

      {/* Invoice list */}
      <div className="bg-white border border-slate-200 rounded-b-2xl divide-y divide-slate-100">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">Loading…</div>
        ) : invoices.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
            No invoices yet
          </div>
        ) : (
          invoices.map((inv) => (
            <InvoiceRow
              key={inv.id}
              invoice={inv}
              student={studentMap[String(inv.student_id)]}
              onClick={() => setViewingId(inv.id)}
              onChange={loadInvoices}
            />
          ))
        )}
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="text-sm text-slate-500">Total Invoices</div>
          <div className="text-2xl font-bold">{totalCount}</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="text-sm text-slate-500">Pending</div>
          <div className="text-2xl font-bold text-orange-600">{money(pendingSum)}</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="text-sm text-slate-500">Paid</div>
          <div className="text-2xl font-bold text-green-600">{money(paidSum)}</div>
        </div>
      </div>

      {showCreate && (
        <GenerateInvoicesModal
          students={students}
          defaultMonth={currentMonth()}
          onClose={() => setShowCreate(false)}
          onCreated={loadInvoices}
        />
      )}
      {viewingId && (
        <InvoiceDetail
          invoiceId={viewingId}
          studentMap={studentMap}
          onClose={() => setViewingId(null)}
          onChange={loadInvoices}
        />
      )}
    </div>
  );
}

function InvoiceRow({ invoice, student, onClick, onChange }) {
  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!confirm('Delete this invoice?')) return;
    try {
      await api.del(`/api/invoices/${invoice.id}`);
      onChange();
    } catch (err) {
      alert(err.message || 'Delete failed');
    }
  };

  // Row-level drift hint: if sent_at exists and recalculated_at is later.
  const rowDrift =
    invoice.sent_at &&
    invoice.recalculated_at &&
    new Date(invoice.recalculated_at) > new Date(invoice.sent_at);

  const isPaid = invoice.status === 'paid';

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      className="group px-5 py-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors"
    >
      <div className="min-w-0">
        <div className="font-semibold text-slate-900 truncate">
          {student?.billing_name || student?.name || '—'}
        </div>
        <div className="text-xs text-slate-500 truncate">
          {invoice.period_label || monthLabel(invoice.month) || invoice.month}
          {invoice.invoice_date && <> · issued {formatDate(invoice.invoice_date)}</>}
          {invoice.sent_at && <span className="text-sky-600">{' · '}Sent</span>}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span
          className={
            isPaid
              ? 'bg-green-100 text-green-700 rounded-full px-2 py-0.5 text-xs'
              : 'bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 text-xs'
          }
        >
          {invoice.status}
        </span>
        {rowDrift && (
          <span
            className="bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 text-xs inline-flex items-center gap-1"
            title="This invoice has been recalculated since it was last sent."
          >
            <AlertTriangle className="w-3 h-3" />
            <span className="hidden sm:inline">Updated</span>
          </span>
        )}
        <div className="font-semibold text-slate-900 tabular-nums">
          {money(invoice.total)}
        </div>
        <button
          onClick={handleDelete}
          className="text-slate-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50"
          aria-label="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition" />
      </div>
    </div>
  );
}

function isHourly(l) {
  if (l.pricing_type) return l.pricing_type === 'hourly';
  return !l.billing_type || l.billing_type === 'hourly';
}

function perSkaterAmount(l) {
  const n = Math.max(1, (l.skater_ids || []).length || l.num_students || 1);
  if (isHourly(l)) return ((l.duration_mins || 0) / 60) * (Number(l.rate_per_hour || 0) / n);
  return Number(l.flat_amount || 0) / n;
}

function thisWeekRange() {
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - start.getDay()); // Sunday
  const end = new Date(start);
  end.setDate(end.getDate() + 6); // Saturday
  return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
}

function lastDayOfMonth(yyyymm) {
  if (!yyyymm) return '';
  const [y, m] = yyyymm.split('-').map(Number);
  if (!y || !m) return '';
  const d = new Date(y, m, 0); // day 0 of next month = last day of this month
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

function GenerateInvoicesModal({ students, defaultMonth, onClose, onCreated }) {
  const [periodType, setPeriodType] = useState('single'); // single | multi-month | custom
  const [month, setMonth] = useState(defaultMonth || currentMonth());
  const [monthFrom, setMonthFrom] = useState(defaultMonth || currentMonth());
  const [monthTo, setMonthTo] = useState(defaultMonth || currentMonth());
  const [startDate, setStartDate] = useState(thisWeekRange()[0]);
  const [endDate, setEndDate] = useState(thisWeekRange()[1]);
  const [taxRate, setTaxRate] = useState('0');
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [applyBalanceFor, setApplyBalanceFor] = useState(() => new Set());
  const [lessons, setLessons] = useState([]);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Compute the active date window based on the selected period type.
  // Returns { start, end } as YYYY-MM-DD, or null if inputs are invalid.
  const range = useMemo(() => {
    if (periodType === 'single') {
      if (!month) return null;
      return { start: `${month}-01`, end: lastDayOfMonth(month) };
    }
    if (periodType === 'multi-month') {
      if (!monthFrom || !monthTo) return null;
      if (monthFrom > monthTo) return null;
      return { start: `${monthFrom}-01`, end: lastDayOfMonth(monthTo) };
    }
    // custom
    if (!startDate || !endDate) return null;
    if (startDate > endDate) return null;
    return { start: startDate, end: endDate };
  }, [periodType, month, monthFrom, monthTo, startDate, endDate]);

  // Fetch lessons for the selected period. Single month uses the indexed
  // endpoint; multi-month and custom pull all lessons and filter client-side.
  useEffect(() => {
    let cancelled = false;
    // Reset selection whenever the period changes, so we don't keep skaters
    // selected that may now have zero lessons.
    setSelectedIds(new Set());
    setApplyBalanceFor(new Set());

    if (!range) {
      setLessons([]);
      return;
    }
    setLoadingLessons(true);

    const url =
      periodType === 'single'
        ? `/api/lessons?month=${encodeURIComponent(month)}`
        : `/api/lessons`;

    api
      .get(url)
      .then((data) => {
        if (cancelled) return;
        const all = Array.isArray(data) ? data : [];
        if (periodType === 'single') {
          setLessons(all);
        } else {
          const { start, end } = range;
          setLessons(
            all.filter((l) => {
              const d = (l.date || '').slice(0, 10);
              return d && d >= start && d <= end;
            })
          );
        }
      })
      .catch(() => {
        if (!cancelled) setLessons([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingLessons(false);
      });

    return () => {
      cancelled = true;
    };
    // range is derived from the inputs below; keying on it is sufficient.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodType, month, monthFrom, monthTo, startDate, endDate]);

  const skaterRows = useMemo(() => {
    return students.map((s) => {
      const mine = lessons.filter((l) =>
        Array.isArray(l.skater_ids) && l.skater_ids.includes(s.id)
      );
      const amount = mine.reduce((sum, l) => sum + perSkaterAmount(l), 0);
      const unsettledEntries = Array.isArray(s.balance_entries)
        ? s.balance_entries.filter((e) => e && e.settled !== true)
        : [];
      const outstandingBalance = unsettledEntries.reduce(
        (sum, e) => sum + Number(e.amount || 0),
        0
      );
      return {
        id: s.id,
        name: s.name,
        lessonCount: mine.length,
        amount,
        outstandingBalance,
        unsettledEntries,
      };
    });
  }, [students, lessons]);

  const anyLessons = lessons.length > 0;

  const toggleSkater = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleApplyBalance = (id) => {
    setApplyBalanceFor((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const buildPayloadPeriod = () => {
    if (periodType === 'single') return { month };
    if (periodType === 'multi-month')
      return { month_from: monthFrom, month_to: monthTo };
    return { date_from: startDate, date_to: endDate };
  };

  const handleGenerate = async () => {
    if (selectedIds.size === 0) return;

    // Validate period inputs.
    if (periodType === 'multi-month') {
      if (!monthFrom || !monthTo) {
        setError('Enter both From Month and To Month.');
        return;
      }
      if (monthFrom > monthTo) {
        setError('From Month must be on or before To Month.');
        return;
      }
    } else if (periodType === 'custom') {
      if (!startDate || !endDate) {
        setError('Enter both Start Date and End Date.');
        return;
      }
      if (startDate > endDate) {
        setError('Start Date must be on or before End Date.');
        return;
      }
    }

    setError('');
    setBusy(true);
    let successes = 0;
    const failures = [];
    const periodFields = buildPayloadPeriod();
    const rowById = new Map(skaterRows.map((r) => [r.id, r]));
    try {
      // Sequential so we don't hammer the server.
      for (const id of Array.from(selectedIds)) {
        const row = rowById.get(id);
        const applying = applyBalanceFor.has(id);
        const outstanding = applying ? Number(row?.outstandingBalance || 0) : 0;
        try {
          await api.post('/api/invoices', {
            student_id: Number(id),
            ...periodFields,
            tax_rate: Number(taxRate) || 0,
            apply_hst: false,
            balance: outstanding,
            custom_charges: [],
          });
          successes += 1;

          // If we applied an outstanding balance, mark each unsettled entry
          // as settled. Sequential per skater; partial failures are reported
          // but we do not roll back the invoice itself.
          if (applying && row && Array.isArray(row.unsettledEntries)) {
            for (const entry of row.unsettledEntries) {
              try {
                await api.put(
                  `/api/students/${id}/balance/${entry.id}`,
                  {
                    date: entry.date,
                    description: entry.description,
                    amount: entry.amount,
                    settled: true,
                  }
                );
              } catch (settleErr) {
                const s = students.find((x) => x.id === id);
                failures.push({
                  name: `${s?.name || `#${id}`} (settle entry)`,
                  error:
                    settleErr?.body?.error ||
                    settleErr.message ||
                    String(settleErr),
                });
              }
            }
          }
        } catch (err) {
          const s = students.find((x) => x.id === id);
          failures.push({
            name: s?.name || `#${id}`,
            error: err?.body?.error || err.message || String(err),
          });
        }
      }

      if (failures.length === 0) {
        onCreated();
        onClose();
        return;
      }

      // Partial failure: keep the modal open, show a summary, but still refresh list.
      onCreated();
      setError(
        `Created ${successes} invoice${successes === 1 ? '' : 's'}, ` +
          `${failures.length} failed: ${failures
            .map((f) => `${f.name} (${f.error})`)
            .join('; ')}`
      );
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = selectedIds.size > 0 && !busy && !!range;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-900">Generate Invoices</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-1.5">
              Billing Period Type
            </label>
            <select
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value)}
              className="w-full h-11 px-3 border border-slate-200 rounded-xl bg-white text-sm"
            >
              <option value="single">Single Month</option>
              <option value="multi-month">Multi-Month Range</option>
              <option value="custom">Custom Date Range (e.g. weekly)</option>
            </select>
          </div>

          {periodType === 'single' && (
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-1.5">
                Invoice Month
              </label>
              <Input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>
          )}

          {periodType === 'multi-month' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1.5">
                  From Month
                </label>
                <Input
                  type="month"
                  value={monthFrom}
                  onChange={(e) => setMonthFrom(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1.5">
                  To Month
                </label>
                <Input
                  type="month"
                  value={monthTo}
                  onChange={(e) => setMonthTo(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
            </div>
          )}

          {periodType === 'custom' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1.5">
                  Start Date
                </label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1.5">
                  End Date
                </label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-1.5">
              Tax Rate (%)
            </label>
            <Input
              type="number"
              step="0.01"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              className="h-11 rounded-xl"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-1.5">
              Select Skaters to Invoice
            </label>
            <div className="border border-slate-200 rounded-xl max-h-64 overflow-y-auto divide-y divide-slate-100">
              {loadingLessons ? (
                <div className="py-6 text-center text-slate-400 text-sm">
                  Loading lessons…
                </div>
              ) : !range ? (
                <div className="py-6 text-center text-slate-400 text-sm">
                  Select a valid period
                </div>
              ) : !anyLessons ? (
                <div className="py-6 text-center text-slate-400 text-sm">
                  No lessons in this period
                </div>
              ) : skaterRows.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-sm">
                  No skaters
                </div>
              ) : (
                skaterRows.map((row) => {
                  const hasLessons = row.lessonCount > 0;
                  const checked = selectedIds.has(row.id);
                  const hasBalance = Number(row.outstandingBalance || 0) !== 0;
                  const owing = Number(row.outstandingBalance || 0) > 0;
                  const balanceChecked = applyBalanceFor.has(row.id);
                  return (
                    <label
                      key={row.id}
                      className={`flex items-center gap-3 px-3 py-2.5 ${
                        hasLessons
                          ? 'cursor-pointer hover:bg-slate-50'
                          : 'opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={!hasLessons}
                        onCheckedChange={() => hasLessons && toggleSkater(row.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-900 truncate">
                          {row.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {hasLessons
                            ? `${row.lessonCount} lesson${
                                row.lessonCount === 1 ? '' : 's'
                              }`
                            : 'no lessons'}
                          {hasBalance && (
                            <span
                              className={
                                owing ? 'text-amber-600' : 'text-green-600'
                              }
                            >
                              {' '}
                              · {money(Math.abs(row.outstandingBalance))}{' '}
                              {owing ? 'owing' : 'credit'}
                            </span>
                          )}
                        </div>
                      </div>
                      {hasLessons && (
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <div className="font-semibold text-slate-900 tabular-nums">
                            {money(row.amount)}
                          </div>
                          {hasBalance && (
                            <div
                              className="flex items-center gap-1.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Checkbox
                                checked={balanceChecked}
                                onCheckedChange={() =>
                                  toggleApplyBalance(row.id)
                                }
                              />
                              <span className="text-xs text-slate-700">
                                Apply balance
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={!canSubmit}
              className="bg-slate-900 hover:bg-slate-800"
            >
              {busy ? 'Generating…' : 'Generate Invoices'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

const BILLING_TYPE_LABELS = {
  private: 'Private',
  semi_private: 'Semi Private',
  competition: 'Competition',
  choreography: 'Choreography',
  off_ice_training: 'Off-Ice Training',
  expenses: 'Expenses',
  hourly: 'Hourly',
  flat: 'Flat',
};

function prettyLessonType(l) {
  const key = l?.billing_type || l?.lesson_type;
  if (!key) return '—';
  if (BILLING_TYPE_LABELS[key]) return BILLING_TYPE_LABELS[key];
  return String(key)
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Parse a period_key and return { start, end } as YYYY-MM-DD, or null.
// Supported forms: "YYYY-MM", "YYYY-MM_YYYY-MM", "YYYY-MM-DD_YYYY-MM-DD".
function parsePeriodKey(key) {
  if (!key || typeof key !== 'string') return null;
  const lastDay = (yyyymm) => {
    const [y, m] = yyyymm.split('-').map(Number);
    if (!y || !m) return null;
    const d = new Date(y, m, 0);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  };
  const sideToRange = (side) => {
    if (/^\d{4}-\d{2}$/.test(side)) return { start: `${side}-01`, end: lastDay(side) };
    if (/^\d{4}-\d{2}-\d{2}$/.test(side)) return { start: side, end: side };
    return null;
  };
  if (!key.includes('_')) return sideToRange(key);
  const [a, b] = key.split('_');
  const left = sideToRange(a);
  const right = sideToRange(b);
  if (!left || !right) return null;
  return { start: left.start, end: right.end };
}

function InvoiceDetail({ invoiceId, studentMap, onClose, onChange }) {
  const [invoice, setInvoice] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [drift, setDrift] = useState(false);
  const [recomputedSubtotal, setRecomputedSubtotal] = useState(null);
  const [recomputedTotal, setRecomputedTotal] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  // Editable fields
  const [taxRate, setTaxRate] = useState('0');
  const [balance, setBalance] = useState('');
  const [dirty, setDirty] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get(`/api/invoices/${invoiceId}`);
      const inv = data?.invoice || data;
      setInvoice(inv);
      setDrift(!!data?.drift);
      setRecomputedSubtotal(
        data?.recomputed_subtotal != null ? data.recomputed_subtotal : null
      );
      setRecomputedTotal(
        data?.recomputed_total != null ? data.recomputed_total : null
      );
      setTaxRate(inv?.tax_rate != null ? String(inv.tax_rate) : '0');
      setBalance(inv?.balance != null ? String(inv.balance) : '');
      setDirty(false);

      // Pull the lessons that make up this invoice's line items.
      // Single-month period keys can use the indexed endpoint; multi-month /
      // custom keys have to fetch all lessons and filter by the parsed range.
      if (inv?.student_id && inv?.month) {
        const sid = inv.student_id;
        const periodKey = inv.month;
        const isSingleMonth = /^\d{4}-\d{2}$/.test(periodKey);
        try {
          let rows;
          if (isSingleMonth) {
            rows = await api.get(
              `/api/lessons?student_id=${encodeURIComponent(sid)}&month=${encodeURIComponent(periodKey)}`
            );
            if (!Array.isArray(rows)) rows = [];
            rows = rows.filter(
              (l) =>
                Array.isArray(l.skater_ids) &&
                l.skater_ids.map(String).includes(String(sid))
            );
          } else {
            const range = parsePeriodKey(periodKey);
            const all = await api.get(`/api/lessons`).catch(() => []);
            const list = Array.isArray(all) ? all : [];
            rows = list.filter((l) => {
              if (
                !Array.isArray(l.skater_ids) ||
                !l.skater_ids.map(String).includes(String(sid))
              ) {
                return false;
              }
              if (!range) return false;
              const d = (l.date || '').slice(0, 10);
              return d && d >= range.start && d <= range.end;
            });
          }
          rows.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
          setLessons(rows);
        } catch {
          setLessons([]);
        }
      } else {
        setLessons([]);
      }
    } catch (err) {
      setResult({ error: err?.body?.error || err.message || String(err) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  const student = invoice ? studentMap[String(invoice.student_id)] : null;
  const recipients = student?.billing_emails?.length ? student.billing_emails : [];

  const markDirty = () => setDirty(true);

  const buildEditBody = () => ({
    tax_rate: Number(taxRate) || 0,
    balance: Number(balance || 0),
  });

  const handleSaveEdits = async () => {
    setSaving(true);
    setResult(null);
    try {
      await api.put(`/api/invoices/${invoiceId}`, buildEditBody());
      await load();
      setDirty(false);
      onChange();
    } catch (err) {
      setResult({ error: err?.body?.error || err.message || String(err) });
    } finally {
      setSaving(false);
    }
  };

  const handleApplyRecomputed = async () => {
    // Force a recompute by re-saving cost-affecting fields; the backend
    // will refresh subtotal/total and bump recalculated_at.
    await handleSaveEdits();
  };

  const togglePaid = async () => {
    if (!invoice) return;
    const newStatus = invoice.status === 'paid' ? 'pending' : 'paid';
    try {
      await api.put(`/api/invoices/${invoiceId}`, { status: newStatus });
      await load();
      onChange();
    } catch (err) {
      setResult({ error: err?.body?.error || err.message || String(err) });
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this invoice?')) return;
    try {
      await api.del(`/api/invoices/${invoiceId}`);
      onChange();
      onClose();
    } catch (err) {
      setResult({ error: err?.body?.error || err.message || String(err) });
    }
  };

  const handlePreview = () => {
    if (!invoice) return;
    setResult(null);
    const params = new URLSearchParams({
      student_id: String(invoice.student_id),
      month: invoice.month,
    });
    window.open(`/api/invoices/preview?${params.toString()}`, '_blank');
  };

  const handleSend = async () => {
    if (!invoice) return;
    setSending(true);
    setResult(null);
    try {
      const data = await api.post('/api/invoices/send', {
        invoice_id: invoice.id,
      });
      if (data?.success) {
        setResult({ success: true, sent_to: data.sent_to });
        await load();
        onChange();
      } else {
        setResult({ error: data?.error || 'Send failed' });
      }
    } catch (err) {
      setResult({ error: err?.body?.error || err.message || String(err) });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-900">Invoice Detail</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading || !invoice ? (
          <div className="py-16 text-center text-slate-400 text-sm">Loading…</div>
        ) : (
          <>
            {drift === true && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-900 flex-1">
                  <div className="font-medium">
                    This invoice has been recalculated since it was last sent.
                  </div>
                  <div className="mt-0.5">
                    {invoice.sent_at && (
                      <>Last sent {formatDate(invoice.sent_at)}. </>
                    )}
                    The recipient's PDF is out of date — resend to sync.
                    {recomputedTotal != null && recomputedTotal !== invoice.total && (
                      <>
                        {' '}
                        New total would be{' '}
                        <span className="font-semibold">
                          {money(recomputedTotal)}
                        </span>
                        {invoice.total != null && (
                          <>
                            {' '}(was{' '}
                            <span className="line-through">{money(invoice.total)}</span>)
                          </>
                        )}
                        .
                      </>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleApplyRecomputed}
                  disabled={saving}
                  className="rounded-lg shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Apply
                </Button>
              </div>
            )}

            <div className="text-sm text-slate-500 mb-4">
              <div>
                <span className="font-medium text-slate-900">Bill To:</span>{' '}
                {student?.billing_name || student?.name || `#${invoice.student_id}`}
              </div>
              <div>
                <span className="font-medium text-slate-900">Period:</span>{' '}
                {invoice.period_label || monthLabel(invoice.month) || invoice.month}
              </div>
              <div>
                <span className="font-medium text-slate-900">Invoice Date:</span>{' '}
                {formatDate(invoice.invoice_date)}
              </div>
              <div>
                <span className="font-medium text-slate-900">Recipients:</span>{' '}
                {recipients.length ? (
                  recipients.join(', ')
                ) : (
                  <span className="text-red-600">No billing emails on file</span>
                )}
              </div>
            </div>

            <div className="-mx-5 sm:mx-0 overflow-x-auto">
              <table className="w-full text-sm mb-4 min-w-[500px]">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                    <th className="py-2 pl-5 sm:pl-0">DATE</th>
                    <th className="py-2">LESSON TYPE</th>
                    <th className="py-2 text-right">DURATION</th>
                    <th className="py-2 text-right">RATE</th>
                    <th className="py-2 text-right pr-5 sm:pr-0">AMOUNT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lessons.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-4 text-center text-slate-400 pl-5 sm:pl-0 pr-5 sm:pr-0"
                      >
                        No lessons for this period.
                      </td>
                    </tr>
                  ) : (
                    lessons.map((l) => {
                      const n = Math.max(
                        1,
                        (l.skater_ids || []).length || l.num_students || 1
                      );
                      const hourly = isHourly(l);
                      const perSkaterRate = hourly
                        ? Number(l.rate_per_hour || 0) / n
                        : Number(l.flat_amount || 0) / n;
                      return (
                        <tr key={l.id}>
                          <td className="py-2 pl-5 sm:pl-0">{formatDate(l.date)}</td>
                          <td className="py-2">{prettyLessonType(l)}</td>
                          <td className="py-2 text-right">
                            {hourly ? `${l.duration_mins || 0} min` : '—'}
                          </td>
                          <td className="py-2 text-right">
                            {hourly
                              ? `${money(perSkaterRate)}/hr`
                              : `${money(perSkaterRate)} flat`}
                          </td>
                          <td className="py-2 text-right font-medium pr-5 sm:pr-0">
                            {money(perSkaterAmount(l))}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Editable cost fields */}
            <div className="border border-slate-200 rounded-xl p-4 mb-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-1.5">
                    Tax Rate (%)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={taxRate}
                    onChange={(e) => {
                      setTaxRate(e.target.value);
                      markDirty();
                    }}
                    className="h-11 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-1.5">
                    Balance Adjustment
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={balance}
                    onChange={(e) => {
                      setBalance(e.target.value);
                      markDirty();
                    }}
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>

              {dirty && (
                <div className="flex justify-end">
                  <Button
                    onClick={handleSaveEdits}
                    disabled={saving}
                    className="bg-slate-900 hover:bg-slate-800 rounded-xl"
                  >
                    {saving ? 'Saving…' : 'Save Changes'}
                  </Button>
                </div>
              )}
            </div>

            {/* Totals */}
            <div className="space-y-1 text-sm text-right">
              <div>
                <span className="text-slate-500 mr-4">Subtotal</span>
                <span className="inline-block w-24 tabular-nums">
                  {money(invoice.subtotal)}
                </span>
              </div>
              {Number(invoice.tax_amount || 0) > 0 && (
                <div>
                  <span className="text-slate-500 mr-4">
                    Tax ({invoice.tax_rate}%)
                  </span>
                  <span className="inline-block w-24 tabular-nums">
                    {money(invoice.tax_amount)}
                  </span>
                </div>
              )}
              {Number(invoice.balance || 0) !== 0 && (
                <div>
                  <span className="text-slate-500 mr-4">Balance</span>
                  <span className="inline-block w-24 tabular-nums">
                    {money(invoice.balance)}
                  </span>
                </div>
              )}
              <div className="text-lg font-bold text-slate-900 pt-1">
                <span className="mr-4">Total Amount Due</span>
                <span className="inline-block w-24 tabular-nums">
                  {money(invoice.total)}
                </span>
              </div>
            </div>

            {/* Status pill row */}
            <div className="flex items-center gap-2 mt-3 text-sm">
              <span className="text-slate-500">Status:</span>
              <span
                className={`text-xs px-2 py-0.5 rounded ${
                  invoice.status === 'paid'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-orange-100 text-orange-700'
                }`}
              >
                {invoice.status}
              </span>
              {invoice.sent_at && (
                <span className="text-xs text-sky-600">
                  Sent {formatDate(invoice.sent_at)}
                </span>
              )}
            </div>

            {result && (
              <div
                className={`mt-4 p-3 rounded-xl text-sm ${
                  result.success
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {result.success
                  ? `Sent${
                      result.sent_to
                        ? ` to ${
                            Array.isArray(result.sent_to)
                              ? result.sent_to.join(', ')
                              : result.sent_to
                          }`
                        : ''
                    }.`
                  : `Error: ${result.error}`}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t border-slate-100">
              <Button
                variant="outline"
                onClick={handleDelete}
                className="text-red-600 hover:bg-red-50 border-red-200"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
              <div className="flex flex-wrap items-center gap-2 ml-auto">
                <Button variant="outline" onClick={togglePaid}>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {invoice.status === 'paid' ? 'Mark Pending' : 'Mark Paid'}
                </Button>
                <Button variant="outline" onClick={handlePreview}>
                  <Eye className="w-4 h-4 mr-2" />
                  Preview PDF
                </Button>
                <Button
                  onClick={handleSend}
                  disabled={sending || !recipients.length}
                  className="bg-slate-900 hover:bg-slate-800"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {sending
                    ? 'Sending…'
                    : invoice.sent_at
                    ? 'Resend Invoice'
                    : 'Send Invoice'}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
