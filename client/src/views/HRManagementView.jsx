import { applicationFetch as fetch } from '../api/graphqlTransport.js';
import React, { useEffect, useMemo, useState } from 'react';
import { Wallet, CircleDollarSign, ReceiptText, CalendarClock, HandCoins, ArrowDownLeft, ArrowUpRight, UsersRound } from 'lucide-react';

function money(cents, currency) {
  const code = String(currency || 'USD').match(/[A-Z]{3}/i)?.[0]?.toUpperCase() || 'USD';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: code }).format((Number(cents) || 0) / 100);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonthStart() {
  return `${today().slice(0, 7)}-01`;
}

const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900';

export default function HRManagementView({ showToast }) {
  const [summary, setSummary] = useState(null);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [openingAmount, setOpeningAmount] = useState('');
  const [income, setIncome] = useState({ amount: '', category: 'Other income', receivedFrom: '', description: '', paymentMethod: 'Cash', reference: '' });
  const [expense, setExpense] = useState({ amount: '', category: 'Meals / refreshment', recipientName: '', description: '', transportMode: '', location: '', address: '', paymentMethod: 'Cash', reference: '' });
  const [advance, setAdvance] = useState({ staffId: '', amount: '', reason: '', paymentMethod: 'Cash', reference: '' });
  const [repayment, setRepayment] = useState({ staffId: '', amount: '', note: '', paymentMethod: 'Cash', reference: '' });
  const [payrollForm, setPayrollForm] = useState({ staffId: '', periodStart: currentMonthStart(), periodEnd: today(), hours: '', advanceDeduction: '0' });
  const [paymentInputs, setPaymentInputs] = useState({});

  const load = async () => {
    try {
      const [summaryResponse, staffResponse] = await Promise.all([
        fetch('/api/finance/summary'),
        fetch('/api/staff')
      ]);
      const [summaryData, staffData] = await Promise.all([summaryResponse.json(), staffResponse.json()]);
      if (!summaryResponse.ok) throw new Error(summaryData.error || 'Could not load company ledger.');
      if (!staffResponse.ok) throw new Error(staffData.error || 'Could not load staff.');
      setSummary(summaryData);
      setStaff(staffData);
      const firstActive = staffData.find(person => person.status === 'Active');
      const firstWithAdvance = staffData.find(person => person.outstandingAdvanceCents > 0);
      if (firstActive) {
        setAdvance(current => ({ ...current, staffId: current.staffId || firstActive.id }));
        setPayrollForm(current => ({ ...current, staffId: current.staffId || firstActive.id }));
      }
      if (firstWithAdvance) setRepayment(current => ({ ...current, staffId: current.staffId || firstWithAdvance.id }));
      setError('');
    } catch (loadError) {
      setError(loadError.message || 'Could not load HR and finance data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const currency = summary?.currency || 'USD';
  const activeStaff = staff.filter(person => person.status === 'Active');
  const payrollEmployee = activeStaff.find(person => person.id === payrollForm.staffId);
  const totalCashIn = useMemo(() => (summary?.ledger || [])
    .filter(entry => entry.includedInBalance && entry.direction === 'in')
    .reduce((total, entry) => total + (Number(entry.amountCents) || 0), 0), [summary]);
  const totalCashOut = useMemo(() => (summary?.ledger || [])
    .filter(entry => entry.includedInBalance && entry.direction === 'out')
    .reduce((total, entry) => total + (Number(entry.amountCents) || 0), 0), [summary]);

  const submit = async (path, body, successMessage, method = 'POST') => {
    setWorking(true);
    try {
      const response = await fetch(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save this transaction.');
      await load();
      showToast?.(successMessage);
      return result;
    } catch (submitError) {
      showToast?.(submitError.message || 'Could not save this transaction.', 'error');
      return null;
    } finally {
      setWorking(false);
    }
  };

  const recordPayroll = async event => {
    event.preventDefault();
    const result = await submit('/api/hr/payroll', payrollForm, 'Payroll period recorded.');
    if (result) setPayrollForm(current => ({ ...current, hours: '', advanceDeduction: '0' }));
  };

  const payPayroll = async (record, event) => {
    event.preventDefault();
    const payment = paymentInputs[record.id] || { amount: ((record.netPayCents - record.paidCents) / 100).toFixed(2), method: 'Cash', reference: '' };
    const result = await submit(`/api/hr/payroll/${record.id}/payments`, payment, 'Salary payment recorded.');
    if (result) setPaymentInputs(current => ({ ...current, [record.id]: undefined }));
  };

  const updatePaymentInput = (record, key, value) => setPaymentInputs(current => ({
    ...current,
    [record.id]: {
      amount: ((record.netPayCents - record.paidCents) / 100).toFixed(2),
      method: 'Cash',
      reference: '',
      ...current[record.id],
      [key]: value
    }
  }));

  if (loading) return <div className="mx-auto max-w-7xl rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500 dark:border-gray-800 dark:bg-[#111827]">Loading company finance…</div>;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex items-center gap-3">
        <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"><Wallet className="h-6 w-6" /></div>
        <div><h1 className="text-2xl font-black text-slate-900 dark:text-white">HR & Company Finance</h1><p className="text-sm text-slate-500">Payroll, advances, staff expenses, receipts and the company cashbook.</p></div>
      </header>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
      {!summary?.openingBalanceSet && (
        <form onSubmit={event => { event.preventDefault(); submit('/api/finance/opening-balance', { amount: openingAmount }, 'Company opening balance set.'); }} className="grid gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-5 dark:bg-amber-950/20 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="text-sm font-bold text-amber-950 dark:text-amber-100">Set the company’s current starting balance
            <span className="mt-1 block text-xs font-normal text-amber-800 dark:text-amber-200">This is a one-time baseline. Older sales and purchases are not imported; new recorded payments will update the balance.</span>
            <input required type="number" min="0" step="0.01" value={openingAmount} onChange={event => setOpeningAmount(event.target.value)} className={`${inputClass} mt-2 max-w-lg`} />
          </label>
          <button disabled={working} className="rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Set opening balance</button>
        </form>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="Company balance" value={summary?.openingBalanceSet ? money(summary.balanceCents, currency) : 'Set opening balance'} icon={Wallet} tone="blue" />
        <Metric title="Active staff" value={summary?.staffCount ?? 0} icon={UsersRound} tone="violet" />
        <Metric title="Advance outstanding" value={money(summary?.outstandingAdvanceCents, currency)} icon={HandCoins} tone="amber" />
        <Metric title="Payroll payable" value={money(summary?.unpaidPayrollCents, currency)} icon={CalendarClock} tone="rose" />
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Record company income" icon={ArrowDownLeft} description="Record money actually received outside captured sales and customer payments.">
          <form onSubmit={event => { event.preventDefault(); submit('/api/finance/income', income, 'Company income recorded.').then(result => { if (result) setIncome({ amount: '', category: 'Other income', receivedFrom: '', description: '', paymentMethod: 'Cash', reference: '' }); }); }} className="grid gap-3 sm:grid-cols-2">
            <Field label={`Amount (${currency})`}><input required type="number" min="0.01" step="0.01" value={income.amount} onChange={event => setIncome({ ...income, amount: event.target.value })} className={inputClass} /></Field>
            <Field label="Category"><select value={income.category} onChange={event => setIncome({ ...income, category: event.target.value })} className={inputClass}><option>Other income</option><option>Owner capital</option><option>Other receipt</option><option>Cash adjustment</option></select></Field>
            <Field label="Received from"><input maxLength={120} value={income.receivedFrom} onChange={event => setIncome({ ...income, receivedFrom: event.target.value })} className={inputClass} /></Field>
            <Field label="Reason / description"><input required maxLength={500} value={income.description} onChange={event => setIncome({ ...income, description: event.target.value })} className={inputClass} /></Field>
            <PaymentFields method={income.paymentMethod} reference={income.reference} onChange={(key, value) => setIncome(current => ({ ...current, [key]: value }))} />
            <button disabled={working || !summary?.openingBalanceSet} className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 sm:col-span-2">Record received amount</button>
          </form>
        </Panel>

        <Panel title="Record a staff/company expense" icon={ReceiptText} description="Log who received the money, why it was paid, and transport or location details.">
          <form onSubmit={event => { event.preventDefault(); submit('/api/hr/expenses', expense, 'Expense recorded and deducted from company balance.').then(result => { if (result) setExpense({ amount: '', category: 'Meals / refreshment', recipientName: '', description: '', transportMode: '', location: '', address: '', paymentMethod: 'Cash', reference: '' }); }); }} className="grid gap-3 sm:grid-cols-2">
            <Field label={`Amount (${currency})`}><input required type="number" min="0.01" step="0.01" value={expense.amount} onChange={event => setExpense({ ...expense, amount: event.target.value })} className={inputClass} /></Field>
            <Field label="Expense type"><select value={expense.category} onChange={event => setExpense({ ...expense, category: event.target.value })} className={inputClass}><option>Meals / refreshment</option><option>Local transport</option><option>Fuel / vehicle</option><option>Office supplies</option><option>Rent / utilities</option><option>Other</option></select></Field>
            <Field label="Paid to"><input required maxLength={120} value={expense.recipientName} onChange={event => setExpense({ ...expense, recipientName: event.target.value })} placeholder="Staff member or recipient" className={inputClass} /></Field>
            <Field label="Reason"><input required maxLength={500} value={expense.description} onChange={event => setExpense({ ...expense, description: event.target.value })} placeholder="Breakfast, rickshaw fare, client visit…" className={inputClass} /></Field>
            <Field label="Transport type (if relevant)"><input maxLength={60} value={expense.transportMode} onChange={event => setExpense({ ...expense, transportMode: event.target.value })} placeholder="Rickshaw, bus, car…" className={inputClass} /></Field>
            <Field label="Location"><input maxLength={200} value={expense.location} onChange={event => setExpense({ ...expense, location: event.target.value })} className={inputClass} /></Field>
            <Field label="Address / destination"><input maxLength={300} value={expense.address} onChange={event => setExpense({ ...expense, address: event.target.value })} className={inputClass} /></Field>
            <PaymentFields method={expense.paymentMethod} reference={expense.reference} onChange={(key, value) => setExpense(current => ({ ...current, [key]: value }))} />
            <button disabled={working || !summary?.openingBalanceSet} className="rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Record expense & deduct</button>
          </form>
        </Panel>

        <Panel title="Issue salary advance" icon={HandCoins} description="Advance is cash out now and remains owed by the staff member until repaid or deducted from payroll.">
          <form onSubmit={event => { event.preventDefault(); submit('/api/hr/advances', advance, 'Advance recorded and deducted from company balance.').then(result => { if (result) setAdvance(current => ({ ...current, amount: '', reason: '' })); }); }} className="grid gap-3 sm:grid-cols-2">
            <Field label="Staff member"><select required value={advance.staffId} onChange={event => setAdvance({ ...advance, staffId: event.target.value })} className={inputClass}><option value="">Choose staff</option>{activeStaff.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></Field>
            <Field label={`Advance amount (${currency})`}><input required type="number" min="0.01" step="0.01" value={advance.amount} onChange={event => setAdvance({ ...advance, amount: event.target.value })} className={inputClass} /></Field>
            <Field label="Reason / terms"><input required maxLength={500} value={advance.reason} onChange={event => setAdvance({ ...advance, reason: event.target.value })} placeholder="Why it was given and agreed recovery" className={inputClass} /></Field>
            <PaymentFields method={advance.paymentMethod} reference={advance.reference} onChange={(key, value) => setAdvance(current => ({ ...current, [key]: value }))} />
            <button disabled={working || !summary?.openingBalanceSet || !activeStaff.length} className="rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Pay advance</button>
          </form>
        </Panel>

        <Panel title="Repay an advance" icon={CircleDollarSign} description="A repayment adds money back to the company balance and reduces the outstanding advance.">
          <form onSubmit={event => { event.preventDefault(); submit(`/api/hr/advances/${repayment.staffId}/repayments`, repayment, 'Advance repayment received.').then(result => { if (result) setRepayment(current => ({ ...current, amount: '', note: '' })); }); }} className="grid gap-3 sm:grid-cols-2">
            <Field label="Staff member"><select required value={repayment.staffId} onChange={event => setRepayment({ ...repayment, staffId: event.target.value })} className={inputClass}><option value="">Choose staff</option>{staff.filter(person => person.outstandingAdvanceCents > 0).map(person => <option key={person.id} value={person.id}>{person.name} — {money(person.outstandingAdvanceCents, currency)} due</option>)}</select></Field>
            <Field label={`Repayment amount (${currency})`}><input required type="number" min="0.01" step="0.01" value={repayment.amount} onChange={event => setRepayment({ ...repayment, amount: event.target.value })} className={inputClass} /></Field>
            <Field label="Note / receipt no."><input maxLength={500} value={repayment.note} onChange={event => setRepayment({ ...repayment, note: event.target.value })} className={inputClass} /></Field>
            <PaymentFields method={repayment.paymentMethod} reference={repayment.reference} onChange={(key, value) => setRepayment(current => ({ ...current, [key]: value }))} />
            <button disabled={working || !summary?.openingBalanceSet || !repayment.staffId} className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Record repayment received</button>
          </form>
        </Panel>
      </div>

      <Panel title="Prepare payroll" icon={CalendarClock} description="Monthly and weekly salaries are prorated to the selected inclusive dates. Hourly payroll uses approved hours × the staff member’s hourly rate.">
        <form onSubmit={recordPayroll} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Field label="Staff member"><select required value={payrollForm.staffId} onChange={event => setPayrollForm({ ...payrollForm, staffId: event.target.value })} className={inputClass}><option value="">Choose staff</option>{activeStaff.map(person => <option key={person.id} value={person.id}>{person.name} · {person.salaryFrequency}</option>)}</select></Field>
          <Field label="Period start"><input required type="date" max={today()} value={payrollForm.periodStart} onChange={event => setPayrollForm({ ...payrollForm, periodStart: event.target.value })} className={inputClass} /></Field>
          <Field label="Period end"><input required type="date" max={today()} value={payrollForm.periodEnd} onChange={event => setPayrollForm({ ...payrollForm, periodEnd: event.target.value })} className={inputClass} /></Field>
          {payrollEmployee?.salaryFrequency === 'Hourly' && <Field label="Approved hours"><input required type="number" min="0.01" step="0.01" value={payrollForm.hours} onChange={event => setPayrollForm({ ...payrollForm, hours: event.target.value })} className={inputClass} /></Field>}
          <Field label={`Advance deduction (${currency})`}><input type="number" min="0" step="0.01" value={payrollForm.advanceDeduction} onChange={event => setPayrollForm({ ...payrollForm, advanceDeduction: event.target.value })} className={inputClass} /></Field>
          <div className="flex items-end"><button disabled={working || !payrollEmployee} className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Calculate & record</button></div>
        </form>
      </Panel>

      <Panel title="Payroll records & payments" icon={ReceiptText} description="Partial payments are supported. Each payout reduces the company balance; the advance deduction is not counted as a second cash movement.">
        {!summary?.payroll?.length ? <p className="text-sm text-slate-500">No payroll periods recorded yet.</p> : (
          <div className="space-y-3">
            {summary.payroll.map(record => {
              const dueCents = record.netPayCents - record.paidCents;
              const fields = paymentInputs[record.id] || { amount: (dueCents / 100).toFixed(2), method: 'Cash', reference: '' };
              return <div key={record.id} className="grid gap-3 rounded-xl border border-slate-200 p-4 dark:border-gray-700 lg:grid-cols-[1.3fr_1fr_1fr_2fr] lg:items-center">
                <div><p className="font-bold">{record.staffName}</p><p className="text-xs text-slate-500">{record.periodStart} – {record.periodEnd}</p></div>
                <div className="text-xs">Gross <b>{money(record.grossCents, currency)}</b><br />Advance deduction <b>{money(record.advanceDeductionCents, currency)}</b></div>
                <div className="text-xs">Net <b>{money(record.netPayCents, currency)}</b><br />Paid <b>{money(record.paidCents, currency)}</b> · Due <b>{money(dueCents, currency)}</b><br /><span className="font-bold">{record.status}</span></div>
                {dueCents > 0 && <form onSubmit={event => payPayroll(record, event)} className="grid gap-2 sm:grid-cols-3">
                  <input required type="number" min="0.01" step="0.01" max={(dueCents / 100).toFixed(2)} value={fields.amount} onChange={event => updatePaymentInput(record, 'amount', event.target.value)} aria-label="Salary payment amount" className={inputClass} />
                  <select value={fields.method} onChange={event => updatePaymentInput(record, 'method', event.target.value)} aria-label="Salary payment method" className={inputClass}><option>Cash</option><option>Bank transfer</option><option>Mobile payment</option><option>Card</option></select>
                  <div className="flex gap-2"><input required={!/^cash$/i.test(fields.method)} maxLength={120} value={fields.reference} onChange={event => updatePaymentInput(record, 'reference', event.target.value)} placeholder="Reference" aria-label="Payment reference" className={`${inputClass} min-w-0`} /><button disabled={working || !summary?.openingBalanceSet} className="shrink-0 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white disabled:opacity-50">Pay</button></div>
                </form>}
              </div>;
            })}
          </div>
        )}
      </Panel>

      <Panel title="Staff advance & recovery history" icon={HandCoins} description="Every issued advance, payroll deduction and repayment remains in the audit trail with its staff member, reason and amount.">
        {!summary?.staffTransactions?.length ? <p className="text-sm text-slate-500">No staff advances or repayments recorded yet.</p> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-gray-900"><tr><th className="p-3">Date</th><th className="p-3">Staff member</th><th className="p-3">Action</th><th className="p-3">Reason / reference</th><th className="p-3 text-right">Amount</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
              {summary.staffTransactions.map(transaction => <tr key={transaction.id}>
                <td className="p-3 whitespace-nowrap">{new Date(transaction.createdAt).toLocaleString()}</td>
                <td className="p-3">{staff.find(person => person.id === transaction.staffId)?.name || transaction.staffId}</td>
                <td className="p-3">{transaction.type.replaceAll('_', ' ')}</td>
                <td className="p-3">{transaction.reason || transaction.referenceId || '—'}</td>
                <td className="p-3 text-right font-bold">{money(transaction.amountCents, currency)}</td>
              </tr>)}
            </tbody>
          </table></div>
        )}
      </Panel>

      <Panel title="Company cashbook" icon={Wallet} description={`Captured POS receipts, customer and supplier payments, payroll, advances and recorded expenses. Entries before the opening baseline (${summary?.openingBalanceAt ? new Date(summary.openingBalanceAt).toLocaleDateString() : 'not set'}) do not affect the current balance. This is consolidated company cash, not separate bank-account reconciliation.`}>
        <div className="mb-4 flex flex-wrap gap-4 text-sm"><span className="text-emerald-700">Recent inflow: <b>{money(totalCashIn, currency)}</b></span><span className="text-rose-700">Recent outflow: <b>{money(totalCashOut, currency)}</b></span></div>
        {!summary?.ledger?.length ? <p className="text-sm text-slate-500">No money movements yet.</p> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-gray-900"><tr><th className="p-3">Date</th><th className="p-3">In / Out</th><th className="p-3">Category</th><th className="p-3">Description</th><th className="p-3">Payee / source</th><th className="p-3">Method / reference</th><th className="p-3 text-right">Amount</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
              {summary.ledger.map(entry => <tr key={entry.id}>
                <td className="p-3 whitespace-nowrap">{new Date(entry.createdAt).toLocaleString()}{!entry.includedInBalance && <span className="ml-1 text-[10px] text-slate-400">pre-opening</span>}</td>
                <td className={`p-3 font-bold ${entry.direction === 'in' ? 'text-emerald-700' : 'text-rose-700'}`}>{entry.direction === 'in' ? <ArrowDownLeft className="mr-1 inline h-4 w-4" /> : <ArrowUpRight className="mr-1 inline h-4 w-4" />}{entry.direction === 'in' ? 'In' : 'Out'}</td>
                <td className="p-3">{entry.category}</td>
                <td className="p-3">{entry.description}</td>
                <td className="p-3">{entry.recipientName || '—'}</td>
                <td className="p-3">{entry.paymentMethod || 'Cash'}{entry.reference ? ` · ${entry.reference}` : ''}</td>
                <td className="p-3 text-right font-bold">{money(entry.amountCents, currency)}</td>
              </tr>)}
            </tbody>
          </table></div>
        )}
      </Panel>
    </div>
  );
}

function Field({ label, children }) {
  return <label className="block space-y-1 text-xs font-semibold text-slate-700 dark:text-slate-200">{label}{children}</label>;
}

function PaymentFields({ method, reference, onChange }) {
  return <>
    <Field label="Payment method"><select value={method} onChange={event => onChange('paymentMethod', event.target.value)} className={inputClass}><option>Cash</option><option>Bank transfer</option><option>Mobile payment</option><option>Card</option></select></Field>
    <Field label={`Transaction reference${/^cash$/i.test(method) ? ' (optional)' : ''}`}><input required={!/^cash$/i.test(method)} maxLength={120} value={reference} onChange={event => onChange('reference', event.target.value)} placeholder="Bank/mobile transaction ID" className={inputClass} /></Field>
  </>;
}

function Panel({ title, icon: Icon, description, children }) {
  return <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#111827]">
    <div className="flex items-start gap-3"><div className="rounded-xl bg-slate-100 p-2 text-slate-700 dark:bg-gray-800 dark:text-slate-200"><Icon className="h-5 w-5" /></div><div><h2 className="font-bold text-slate-900 dark:text-white">{title}</h2><p className="mt-0.5 text-xs text-slate-500">{description}</p></div></div>
    {children}
  </section>;
}

function Metric({ title, value, icon: Icon, tone }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
    violet: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    rose: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
  };
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-gray-800 dark:bg-[#111827]"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-500">{title}</span><span className={`rounded-lg p-2 ${tones[tone]}`}><Icon className="h-4 w-4" /></span></div><p className="mt-3 text-xl font-black text-slate-900 dark:text-white">{value}</p></div>;
}
