import { applicationFetch as fetch } from '../api/graphqlTransport.js';
import React, { useEffect, useState } from 'react';
import { UserRound, Plus, Pencil, X, UsersRound } from 'lucide-react';

const emptyProfile = () => ({
  name: '',
  phone: '',
  email: '',
  address: '',
  jobTitle: '',
  department: '',
  startDate: new Date().toISOString().slice(0, 10),
  salaryFrequency: 'Monthly',
  salaryAmount: '',
  hourlyRate: '',
  status: 'Active'
});

function formatMoney(cents, currency) {
  const code = String(currency || 'USD').match(/[A-Z]{3}/i)?.[0]?.toUpperCase() || 'USD';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: code }).format((cents || 0) / 100);
}

export default function StaffManagementView({ showToast }) {
  const [staff, setStaff] = useState([]);
  const [currency, setCurrency] = useState('USD');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyProfile);

  const loadStaff = async () => {
    try {
      const [staffResponse, financeResponse] = await Promise.all([
        fetch('/api/staff'),
        fetch('/api/finance/summary')
      ]);
      const staffData = await staffResponse.json();
      const financeData = await financeResponse.json();
      if (!staffResponse.ok) throw new Error(staffData.error || 'Could not load staff.');
      setStaff(staffData);
      if (financeResponse.ok) setCurrency(financeData.currency || 'USD');
      setError('');
    } catch (loadError) {
      setError(loadError.message || 'Could not load staff records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStaff(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyProfile());
    setShowForm(true);
  };

  const openEdit = person => {
    setEditing(person);
    setShowForm(true);
    setForm({
      ...emptyProfile(),
      ...person,
      salaryAmount: person.salaryAmountCents ? (person.salaryAmountCents / 100).toFixed(2) : '',
      hourlyRate: person.hourlyRateCents ? (person.hourlyRateCents / 100).toFixed(2) : ''
    });
  };

  const saveStaff = async event => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch(editing ? `/api/staff/${editing.id}` : '/api/staff', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save staff profile.');
      await loadStaff();
      setEditing(null);
      setForm(emptyProfile());
      setShowForm(false);
      showToast?.(editing ? 'Staff profile updated.' : 'Staff member added.');
    } catch (saveError) {
      showToast?.(saveError.message || 'Could not save staff profile.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (name, value) => setForm(current => ({ ...current, [name]: value }));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-blue-50 p-3 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"><UsersRound className="h-6 w-6" /></div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">Staff Management</h1>
            <p className="text-sm text-slate-500">Employee profiles, contact details, work roles and pay schedules.</p>
          </div>
        </div>
        <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700"><Plus className="h-4 w-4" /> Add staff</button>
      </header>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}

      {(showForm || (staff.length === 0 && !loading)) && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#111827]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold text-slate-900 dark:text-white">{editing ? `Edit ${editing.name}` : 'New staff profile'}</h2>
            <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} aria-label="Close staff form"><X className="h-4 w-4" /></button>
          </div>
          <form onSubmit={saveStaff} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-xs font-semibold">Full name *
              <input required maxLength={120} value={form.name} onChange={event => updateField('name', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900" />
            </label>
            <label className="text-xs font-semibold">Phone
              <input maxLength={40} value={form.phone} onChange={event => updateField('phone', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900" />
            </label>
            <label className="text-xs font-semibold">Email
              <input type="email" maxLength={254} value={form.email} onChange={event => updateField('email', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900" />
            </label>
            <label className="text-xs font-semibold">Job title
              <input maxLength={120} value={form.jobTitle} onChange={event => updateField('jobTitle', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900" />
            </label>
            <label className="text-xs font-semibold">Department
              <input maxLength={120} value={form.department} onChange={event => updateField('department', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900" />
            </label>
            <label className="text-xs font-semibold">Start date *
              <input required type="date" value={form.startDate} onChange={event => updateField('startDate', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900" />
            </label>
            <label className="text-xs font-semibold">Pay schedule *
              <select value={form.salaryFrequency} onChange={event => updateField('salaryFrequency', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900">
                <option>Monthly</option><option>Weekly</option><option>Hourly</option>
              </select>
            </label>
            {form.salaryFrequency === 'Hourly' ? (
              <label className="text-xs font-semibold">Hourly rate ({currency}) *
                <input required type="number" min="0.01" step="0.01" value={form.hourlyRate} onChange={event => updateField('hourlyRate', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900" />
              </label>
            ) : (
              <label className="text-xs font-semibold">{form.salaryFrequency} salary ({currency}) *
                <input required type="number" min="0.01" step="0.01" value={form.salaryAmount} onChange={event => updateField('salaryAmount', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900" />
              </label>
            )}
            <label className="text-xs font-semibold">Address
              <input maxLength={500} value={form.address} onChange={event => updateField('address', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900" />
            </label>
            {editing && <label className="text-xs font-semibold">Employment status
              <select value={form.status} onChange={event => updateField('status', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"><option>Active</option><option>Inactive</option></select>
            </label>}
            <div className="flex items-end sm:col-span-2 lg:col-span-3">
              <button disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? 'Saving…' : editing ? 'Save changes' : 'Create staff profile'}</button>
            </div>
          </form>
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-gray-800 dark:bg-[#111827]">
        {loading ? <p className="p-6 text-sm text-slate-500">Loading staff…</p> : staff.length === 0 ? (
          <div className="p-10 text-center"><UserRound className="mx-auto mb-3 h-8 w-8 text-slate-400" /><p className="font-semibold">No staff added yet</p><p className="mt-1 text-sm text-slate-500">Add a staff profile to start tracking payroll and advances.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-gray-900"><tr><th className="p-4">Staff member</th><th className="p-4">Role / department</th><th className="p-4">Contact / address</th><th className="p-4">Pay schedule</th><th className="p-4">Advance due</th><th className="p-4">Status</th><th className="p-4">Action</th></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                {staff.map(person => <tr key={person.id}>
                  <td className="p-4"><p className="font-bold">{person.name}</p><p className="text-xs text-slate-500">Started {person.startDate}</p></td>
                  <td className="p-4">{person.jobTitle || '—'}<p className="text-xs text-slate-500">{person.department || '—'}</p></td>
                  <td className="p-4">{person.phone || person.email || '—'}<p className="max-w-48 truncate text-xs text-slate-500">{person.address || ''}</p></td>
                  <td className="p-4">{person.salaryFrequency === 'Hourly' ? `${formatMoney(person.hourlyRateCents, currency)}/hr` : `${formatMoney(person.salaryAmountCents, currency)} / ${person.salaryFrequency.toLowerCase()}`}</td>
                  <td className="p-4 font-semibold">{formatMoney(person.outstandingAdvanceCents, currency)}</td>
                  <td className="p-4"><span className={`rounded-full px-2 py-1 text-xs font-bold ${person.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{person.status}</span></td>
                  <td className="p-4"><button onClick={() => openEdit(person)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold hover:bg-slate-50 dark:border-gray-700"><Pencil className="h-3.5 w-3.5" /> Edit</button></td>
                </tr>)}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
