import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const today = () => new Date().toISOString().slice(0, 10);

export default function StudentEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [entries, setEntries] = useState([]);
  const [newEntry, setNewEntry] = useState({ date: today(), description: '', amount: '' });
  const [addingEntry, setAddingEntry] = useState(false);
  const [invoiceHistory, setInvoiceHistory] = useState([]);

  useEffect(() => {
    fetch(`/api/students/${id}`).then((r) => r.json()).then(setForm);
    fetch(`/api/students/${id}/balance`).then((r) => r.json()).then(setEntries);
    fetch(`/api/invoices/history?student_id=${id}`).then((r) => r.json()).then(setInvoiceHistory);
  }, [id]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    await fetch(`/api/students/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, email: form.email }),
    });
    navigate('/');
  };

  const handleDelete = async () => {
    if (!confirm('Delete this student and all their lessons?')) return;
    await fetch(`/api/students/${id}`, { method: 'DELETE' });
    navigate('/');
  };

  const reloadEntries = () =>
    fetch(`/api/students/${id}/balance`).then((r) => r.json()).then(setEntries);

  const handleAddEntry = async () => {
    if (!newEntry.description || !newEntry.amount) return;
    await fetch(`/api/students/${id}/balance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newEntry, amount: Number(newEntry.amount), settled: false }),
    });
    setNewEntry({ date: today(), description: '', amount: '' });
    setAddingEntry(false);
    reloadEntries();
  };

  const handleSettle = async (entry) => {
    await fetch(`/api/students/${id}/balance/${entry.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...entry, settled: !entry.settled }),
    });
    reloadEntries();
  };

  const handleDeleteEntry = async (entryId) => {
    if (!confirm('Remove this balance entry?')) return;
    await fetch(`/api/students/${id}/balance/${entryId}`, { method: 'DELETE' });
    reloadEntries();
  };

  const outstanding = entries.filter((e) => !e.settled).reduce((s, e) => s + e.amount, 0);

  if (!form) return null;

  return (
    <div className="page">
      <button
        onClick={() => navigate('/')}
        style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: 15, cursor: 'pointer', marginBottom: 12, padding: 0 }}
      >
        ← Students
      </button>
      <div className="page-title">Edit Student</div>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Name</label>
          <input value={form.name} onChange={(e) => set('name', e.target.value)} required />
        </div>
        <div className="form-group">
          <label>Email</label>
          <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required />
        </div>
        <button className="btn btn-primary" type="submit">Save Changes</button>
      </form>

      {/* Balance Ledger */}
      <div style={{ marginTop: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Balance History</div>
            {entries.length > 0 && (
              <div style={{ fontSize: 13, color: outstanding === 0 ? '#15803d' : outstanding > 0 ? '#dc2626' : '#15803d', marginTop: 2 }}>
                {outstanding === 0
                  ? 'All settled'
                  : outstanding > 0
                  ? `Owes $${outstanding.toFixed(2)}`
                  : `Credit $${Math.abs(outstanding).toFixed(2)}`}
              </div>
            )}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => setAddingEntry((v) => !v)}>
            {addingEntry ? 'Cancel' : '+ Add Entry'}
          </button>
        </div>

        {addingEntry && (
          <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: 14, marginBottom: 12 }}>
            <div className="form-group" style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 13 }}>Date</label>
              <input type="date" value={newEntry.date} onChange={(e) => setNewEntry((n) => ({ ...n, date: e.target.value }))} />
            </div>
            <div className="form-group" style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 13 }}>Description</label>
              <input
                placeholder="e.g. Payment received"
                value={newEntry.description}
                onChange={(e) => setNewEntry((n) => ({ ...n, description: e.target.value }))}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13 }}>Amount</label>
              <input
                type="number"
                step="0.01"
                placeholder="Positive = owes · Negative = payment/credit"
                value={newEntry.amount}
                onChange={(e) => setNewEntry((n) => ({ ...n, amount: e.target.value }))}
              />
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                Positive = student owes · Negative = payment or credit
              </div>
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleAddEntry}>
              Add Entry
            </button>
          </div>
        )}

        {entries.length === 0 && !addingEntry && (
          <div style={{ color: '#9ca3af', fontSize: 14, padding: '12px 0' }}>No balance entries yet.</div>
        )}

        {entries.map((e) => (
          <div
            key={e.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 0',
              borderBottom: '1px solid #f3f4f6',
              opacity: e.settled ? 0.5 : 1,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 500, fontSize: 14, textDecoration: e.settled ? 'line-through' : 'none' }}>
                {e.description}
              </div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{e.date}</div>
            </div>
            <div style={{ fontWeight: 600, fontSize: 15, color: e.amount < 0 ? '#15803d' : '#dc2626', whiteSpace: 'nowrap' }}>
              {e.amount < 0 ? `-$${Math.abs(e.amount).toFixed(2)}` : `+$${e.amount.toFixed(2)}`}
            </div>
            <button
              title={e.settled ? 'Mark unsettled' : 'Mark settled'}
              onClick={() => handleSettle(e)}
              style={{
                background: e.settled ? '#d1fae5' : '#f3f4f6',
                border: 'none',
                borderRadius: 6,
                padding: '4px 8px',
                fontSize: 13,
                cursor: 'pointer',
                color: e.settled ? '#15803d' : '#374151',
              }}
            >
              {e.settled ? '✓' : 'Settle'}
            </button>
          </div>
        ))}
      </div>

      {/* Invoice History */}
      {invoiceHistory.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>Invoice History</div>
          {invoiceHistory.map((inv) => {
            const [year, mon] = inv.month.split('-');
            const label = new Date(year, mon - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
            const sentDate = new Date(inv.sent_at).toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' });
            return (
              <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{label}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>Sent {sentDate}</div>
                </div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>${inv.total.toFixed(2)}</div>
              </div>
            );
          })}
        </div>
      )}

      <button className="btn btn-danger" style={{ marginTop: 24 }} onClick={handleDelete}>
        Delete Student
      </button>
    </div>
  );
}
