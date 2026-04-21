import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Settings as SettingsIcon, Save } from 'lucide-react';
import DataBackup from '@/components/DataBackup';

export default function Settings() {
  const [form, setForm] = useState({
    default_hourly_rate: '50',
    name: '',
    email: '',
    phone: '',
    address: '',
    website: '',
    tax_number: '',
    payment_instructions_etransfer: '',
    accepts_cheque_cash: true,
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    api
      .get('/api/profile')
      .then((profile) => {
        if (!profile) return;
        setForm((f) => ({
          ...f,
          default_hourly_rate:
            profile.default_hourly_rate != null ? String(profile.default_hourly_rate) : f.default_hourly_rate,
          name: profile.name || '',
          email: profile.email || '',
          phone: profile.phone || '',
          address: profile.address || '',
          website: profile.website || '',
          tax_number: profile.tax_number || '',
          payment_instructions_etransfer: profile.payment_instructions_etransfer || '',
          accepts_cheque_cash:
            profile.accepts_cheque_cash === undefined ? true : Boolean(profile.accepts_cheque_cash),
        }));
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.put('/api/profile', {
        default_hourly_rate: Number(form.default_hourly_rate) || 50,
        name: form.name.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        website: form.website.trim() || undefined,
        tax_number: form.tax_number.trim() || undefined,
        payment_instructions_etransfer: form.payment_instructions_etransfer.trim() || undefined,
        accepts_cheque_cash: form.accepts_cheque_cash,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err.message || 'Failed to save profile');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <SettingsIcon className="w-6 h-6 text-slate-600" />
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
          <p className="text-slate-500 mt-0.5">Configure your coaching preferences</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900">Lesson Settings</h2>
          <p className="text-sm text-slate-500 mb-4">
            Configure your default rates and lesson preferences.
          </p>
          <Field label="Default Hourly Rate ($) *">
            <Input
              type="number"
              step="0.01"
              value={form.default_hourly_rate}
              onChange={(e) => set('default_hourly_rate', e.target.value)}
            />
          </Field>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900">Coach Information</h2>
          <p className="text-sm text-slate-500 mb-4">
            This information will appear on your invoices.
          </p>
          <div className="space-y-4">
            <Field label="Name (optional)">
              <Input
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Your name"
              />
            </Field>
            <Field label="Email (optional)">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="coach@example.com"
              />
            </Field>
            <Field label="Phone (optional)">
              <Input
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="+1 (555) 123-4567"
              />
            </Field>
            <Field label="Address (optional)">
              <Input
                value={form.address}
                onChange={(e) => set('address', e.target.value)}
                placeholder="123 Main St, City, State"
              />
            </Field>
            <Field label="Website (optional)">
              <Input
                value={form.website}
                onChange={(e) => set('website', e.target.value)}
                placeholder="https://example.com"
              />
            </Field>
            <Field label="Tax/Business Number (optional)">
              <Input
                value={form.tax_number}
                onChange={(e) => set('tax_number', e.target.value)}
                placeholder="e.g., GST/HST Number, Tax ID"
              />
            </Field>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900">Payment Instructions</h2>
          <p className="text-sm text-slate-500 mb-4">Shown at the bottom of every invoice.</p>
          <div className="space-y-4">
            <Field label="E-Transfer email">
              <Input
                type="email"
                value={form.payment_instructions_etransfer}
                onChange={(e) => set('payment_instructions_etransfer', e.target.value)}
                placeholder="coach@example.com"
              />
            </Field>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.accepts_cheque_cash}
                onChange={(e) => set('accepts_cheque_cash', e.target.checked)}
              />
              Accept cheque &amp; cash
            </label>
          </div>
        </section>

        <div className="flex items-center justify-between">
          {error && <span className="text-sm text-red-600">{error}</span>}
          {saved && <span className="text-sm text-green-600">Saved!</span>}
          <Button
            type="submit"
            disabled={submitting}
            className="bg-slate-900 hover:bg-slate-800 ml-auto"
          >
            <Save className="w-4 h-4 mr-2" /> {submitting ? 'Saving…' : 'Save Settings'}
          </Button>
        </div>
      </form>

      <div className="mt-6">
        <DataBackup />
      </div>
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
