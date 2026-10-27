import { applicationFetch as fetch } from '../../../api/graphqlTransport.js';
import React, { useEffect, useState } from 'react';
import { BadgeCheck, MapPin, Package, ShieldCheck, UserRound } from 'lucide-react';
import { useStoreSettings } from '../../../context/StoreSettingsContext';
import { formatStoreCurrency } from '../storefrontUtils';
import { openMaterialDialog } from '../../../components/MaterialDialogProvider.jsx';

const emptyAddress = {
  label: 'Home',
  recipient: '',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  region: '',
  postalCode: '',
  countryCode: '',
  country: '',
  isDefault: false
};

export default function CustomerAccountPage({ onNavigate, showToast }) {
  const { storeSettings } = useStoreSettings();
  const [customer, setCustomer] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('orders');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [address, setAddress] = useState(emptyAddress);
  const [editingAddressId, setEditingAddressId] = useState('');
  const [profileDraft, setProfileDraft] = useState({ name: '', phone: '' });
  const [editOrderId, setEditOrderId] = useState('');
  const [orderEdit, setOrderEdit] = useState(null);
  const [refundRequest, setRefundRequest] = useState(null);

  const loadAccount = async () => {
    try {
      const response = await fetch('/api/public/customer-auth/me');
      if (response.status === 401) {
        setCustomer(null);
        setOrders([]);
        return;
      }
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Account request failed with HTTP ${response.status}.`);
      setCustomer(result.customer);
      setOrders(result.orders || []);
      setName(result.customer?.name || '');
      setProfileDraft({ name: result.customer?.name || '', phone: result.customer?.phone || '' });
    } catch (loadError) {
      setError(loadError.message || 'Could not load your account.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void Promise.resolve().then(loadAccount); }, []);

  const requestCode = async event => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/public/customer-auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Could not send a sign-in code (HTTP ${response.status}).`);
      setVerificationToken(result.verificationToken);
      showToast?.(`Email code sent to ${result.emailMasked}.`);
    } catch (requestError) {
      setError(requestError.message || 'Could not send a sign-in code.');
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async event => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/public/customer-auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationToken, code, name })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Sign-in failed with HTTP ${response.status}.`);
      setCustomer(result.customer);
      setVerificationToken('');
      setCode('');
      await loadAccount();
      showToast?.('Signed in to your store account.');
    } catch (verifyError) {
      setError(verifyError.message || 'Could not verify this code.');
    } finally {
      setBusy(false);
    }
  };

  const saveAddress = async event => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(editingAddressId
        ? `/api/public/customer-auth/addresses/${encodeURIComponent(editingAddressId)}`
        : '/api/public/customer-auth/addresses', {
        method: editingAddressId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(address)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Address save failed with HTTP ${response.status}.`);
      setCustomer(result.customer);
      setAddress(emptyAddress);
      setEditingAddressId('');
      showToast?.('Address saved.');
    } catch (saveError) {
      setError(saveError.message || 'Could not save this address.');
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = async event => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/public/customer-auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileDraft)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Profile update failed with HTTP ${response.status}.`);
      setCustomer(result.customer);
      showToast?.('Profile updated.');
    } catch (profileError) {
      setError(profileError.message || 'Could not update your profile.');
    } finally {
      setBusy(false);
    }
  };

  const removeAddress = async id => {
    if (!await openMaterialDialog({ title: 'Remove saved address?', message: 'This address will be removed from your account.', confirmLabel: 'Remove address', tone: 'danger' })) return;
    try {
      const response = await fetch(`/api/public/customer-auth/addresses/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Address removal failed with HTTP ${response.status}.`);
      setCustomer(result.customer);
    } catch (removeError) {
      setError(removeError.message || 'Could not remove this address.');
    }
  };

  const saveOrderEdit = async event => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/public/customer-auth/orders/${encodeURIComponent(editOrderId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: orderEdit.customerName,
          customerPhone: orderEdit.customerPhone,
          customerEmail: orderEdit.customerEmail,
          shippingAddress: orderEdit.shippingAddress,
          billingAddress: orderEdit.hasBillingAddress ? orderEdit.billingAddress : null
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Order update failed with HTTP ${response.status}.`);
      setEditOrderId('');
      setOrderEdit(null);
      await loadAccount();
      showToast?.('Order contact and address details updated.');
    } catch (saveError) {
      setError(saveError.message || 'Could not update this order.');
    } finally {
      setBusy(false);
    }
  };

  const submitRefund = async event => {
    event.preventDefault();
    if (!refundRequest) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/public/customer-auth/orders/${encodeURIComponent(refundRequest.orderId)}/refunds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: refundRequest.amount, reason: refundRequest.reason })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Refund request failed with HTTP ${response.status}.`);
      setRefundRequest(null);
      await loadAccount();
      showToast?.('Refund request sent to the store for review.');
    } catch (requestError) {
      setError(requestError.message || 'Could not request a refund.');
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    try {
      const response = await fetch('/api/public/customer-auth/logout', { method: 'POST' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Sign-out failed with HTTP ${response.status}.`);
      setCustomer(null);
      setOrders([]);
    } catch (logoutError) {
      setError(logoutError.message || 'Could not sign out.');
    }
  };

  if (loading) return <main className="mx-auto max-w-4xl px-4 py-12 text-sm text-slate-500">Loading your customer account…</main>;

  if (!customer) {
    return (
      <main className="mx-auto max-w-lg px-4 py-12">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><ShieldCheck className="h-6 w-6" /></div>
          <h1 className="text-2xl font-black text-slate-900">Your {storeSettings?.storeName || 'store'} account</h1>
          <p className="mt-2 text-sm text-slate-500">Sign in with an email code to see your orders, saved addresses, and refund requests. This is separate from merchant accounts.</p>
          {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
          {!verificationToken ? (
            <form onSubmit={requestCode} className="mt-6 space-y-3">
              <label className="block text-xs font-semibold text-slate-700">Email address
                <input type="email" required value={email} onChange={event => setEmail(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" autoComplete="email" />
              </label>
              <label className="block text-xs font-semibold text-slate-700">Name <span className="font-normal text-slate-400">(for a new account)</span>
                <input value={name} onChange={event => setName(event.target.value)} maxLength={120} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" autoComplete="name" />
              </label>
              <button disabled={busy} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Sending…' : 'Send sign-in code'}</button>
            </form>
          ) : (
            <form onSubmit={verifyCode} className="mt-6 space-y-3">
              <label className="block text-xs font-semibold text-slate-700">Six-digit email code
                <input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={event => setCode(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-center font-mono text-lg tracking-[0.4em]" autoComplete="one-time-code" />
              </label>
              <button disabled={busy} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Verifying…' : 'Verify and sign in'}</button>
              <button type="button" onClick={() => { setVerificationToken(''); setCode(''); }} className="w-full py-2 text-xs font-semibold text-slate-500">Use a different email</button>
            </form>
          )}
          <button type="button" onClick={() => onNavigate?.('home')} className="mt-5 w-full text-xs font-semibold text-blue-700">Continue shopping</button>
        </section>
      </main>
    );
  }

  const tabs = [
    ['orders', 'Orders'],
    ['addresses', 'Addresses'],
    ['profile', 'Profile']
  ];
  return (
    <main className="mx-auto w-full max-w-6xl space-y-5 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><UserRound className="h-5 w-5" /></span>
          <div><h1 className="text-xl font-black text-slate-900">Hello, {customer.name}</h1><p className="text-xs text-slate-500">{customer.email}</p></div>
        </div>
        <button type="button" onClick={signOut} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Sign out</button>
      </header>
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
      <nav className="flex flex-wrap gap-2">
        {tabs.map(([id, label]) => <button key={id} type="button" onClick={() => setTab(id)} className={`rounded-xl px-4 py-2 text-xs font-bold ${tab === id ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>{label}</button>)}
      </nav>

      {tab === 'orders' && (
        <section className="space-y-3">
          {orders.map(order => {
            const editable = ['Pending', 'Confirmed'].includes(order.status || 'Pending');
            const activeRefund = (order.refundHistory || []).some(refund => ['requested', 'approved'].includes(refund.status));
            return (
              <article key={order.id} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><p className="text-sm font-bold text-slate-900">Order {order.invoiceNumber}</p><p className="text-xs text-slate-500">{order.date ? new Date(order.date).toLocaleDateString() : ''}</p></div>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{order.status} · {order.paymentStatus}</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs">
                  <span>{order.items?.length || 0} item(s)</span><strong>{formatStoreCurrency(order.totalAmount, { ...storeSettings, currency: order.currency || storeSettings.currency })}</strong>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => onNavigate?.('track', { reference: order.invoiceNumber, phone: order.customerPhone || customer.phone })} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold">Track order</button>
                  {editable && <button type="button" onClick={() => {
                    const address = order.shippingAddress || {};
                    setEditOrderId(order.id);
                    setOrderEdit({
                      customerName: customer.name,
                      customerPhone: order.customerPhone || customer.phone,
                      customerEmail: order.customerEmail || customer.email,
                      shippingAddress: { street: address.street || '', city: address.city || '', region: address.region || '', postalCode: address.postalCode || '', country: address.country || '', countryCode: address.countryCode || '' },
                      billingAddress: order.billingAddress || null,
                      hasBillingAddress: Boolean(order.billingAddress)
                    });
                  }} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold">Edit details</button>}
                  {storeSettings?.refundRequestsEnabled !== false && ['Paid', 'Partially Refunded'].includes(order.paymentStatus) && !activeRefund && <button type="button" onClick={() => setRefundRequest({ orderId: order.id, amount: order.totalAmount, reason: '' })} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">Request refund</button>}
                </div>
                {editOrderId === order.id && orderEdit && (
                  <form onSubmit={saveOrderEdit} className="mt-4 grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-2">
                    {[
                      ['customerName', 'Name'],
                      ['customerPhone', 'Phone'],
                      ['customerEmail', 'Email'],
                      ['shippingAddress.street', 'Delivery street'],
                      ['shippingAddress.city', 'City'],
                      ['shippingAddress.region', 'Region'],
                      ['shippingAddress.postalCode', 'Postal code'],
                      ['shippingAddress.country', 'Country']
                    ].map(([key, label]) => {
                      const nested = key.startsWith('shippingAddress.');
                      const value = nested ? orderEdit.shippingAddress[key.split('.')[1]] : orderEdit[key];
                      return <label key={key} className="text-[11px] font-semibold text-slate-600">{label}<input required={nested && ['street', 'country'].includes(key.split('.')[1])} value={value || ''} onChange={event => setOrderEdit(current => nested ? { ...current, shippingAddress: { ...current.shippingAddress, [key.split('.')[1]]: event.target.value } } : { ...current, [key]: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs" /></label>;
                    })}
                    <label className="sm:col-span-2 flex items-center gap-2 text-[11px] font-semibold text-slate-600">
                      <input type="checkbox" checked={orderEdit.hasBillingAddress} onChange={event => setOrderEdit(current => ({
                        ...current,
                        hasBillingAddress: event.target.checked,
                        billingAddress: current.billingAddress || { street: '', city: '', region: '', postalCode: '', country: '', countryCode: '' }
                      }))} />
                      Use a separate billing address
                    </label>
                    {orderEdit.hasBillingAddress && ['street', 'city', 'region', 'postalCode', 'country'].map(key => (
                      <label key={key} className="text-[11px] font-semibold capitalize text-slate-600">Billing {key}
                        <input required={['street', 'country'].includes(key)} value={orderEdit.billingAddress?.[key] || ''} onChange={event => setOrderEdit(current => ({
                          ...current,
                          billingAddress: { ...current.billingAddress, [key]: event.target.value }
                        }))} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs" />
                      </label>
                    ))}
                    <div className="sm:col-span-2 flex justify-end gap-2"><button type="button" onClick={() => { setEditOrderId(''); setOrderEdit(null); }} className="rounded-lg border border-slate-200 px-3 py-2 text-xs">Cancel</button><button disabled={busy} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white">Save changes</button></div>
                  </form>
                )}
                {(order.refundHistory || []).map(refund => <p key={refund.id} className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Refund request: {refund.status.replaceAll('_', ' ')} · {formatStoreCurrency(refund.amount, storeSettings)}</p>)}
              </article>
            );
          })}
          {orders.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><Package className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-700">No orders found for this store account yet.</p><button type="button" onClick={() => onNavigate?.('home')} className="mt-3 text-xs font-bold text-blue-700">Start shopping</button></div>}
        </section>
      )}

      {refundRequest && (
        <form onSubmit={submitRefund} className="rounded-2xl border border-amber-200 bg-white p-5">
          <h2 className="text-sm font-bold text-slate-900">Request a refund</h2>
          <p className="mt-1 text-xs text-slate-500">The store must review this request. This does not automatically move money or confirm a gateway refund.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold">Amount<input type="number" min="0.01" max={orders.find(order => order.id === refundRequest.orderId)?.totalAmount} step="0.01" required value={refundRequest.amount} onChange={event => setRefundRequest({ ...refundRequest, amount: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
            <label className="text-xs font-semibold">Reason<textarea required maxLength={1000} value={refundRequest.reason} onChange={event => setRefundRequest({ ...refundRequest, reason: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
          </div>
          <div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => setRefundRequest(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs">Cancel</button><button disabled={busy} className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white">Send request</button></div>
        </form>
      )}

      {tab === 'addresses' && (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            {(customer.addresses || []).map(item => <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><p className="font-bold text-slate-900">{item.label || 'Address'} {item.isDefault && <span className="ml-2 text-[10px] text-emerald-700">Default</span>}</p><div className="flex gap-3"><button type="button" onClick={() => { setEditingAddressId(item.id); setAddress({ ...emptyAddress, ...item }); }} className="text-xs font-semibold text-blue-700">Edit</button><button type="button" onClick={() => removeAddress(item.id)} className="text-xs font-semibold text-rose-600">Remove</button></div></div><p className="mt-2 text-xs text-slate-600">{item.recipient} · {item.phone}<br />{item.line1} {item.line2}<br />{item.city}, {item.region} {item.postalCode}, {item.country}</p></article>)}
            {(customer.addresses || []).length === 0 && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-xs text-slate-500">Save an address for faster checkout.</p>}
          </div>
          <form onSubmit={saveAddress} className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
            <h2 className="sm:col-span-2 text-sm font-bold">{editingAddressId ? 'Edit delivery address' : 'Add delivery address'}</h2>
            {Object.entries({ label: 'Label', recipient: 'Recipient', phone: 'Phone', line1: 'Address line 1', line2: 'Address line 2', city: 'City', region: 'State/region', postalCode: 'Postal code', country: 'Country', countryCode: 'Country code (ISO-2, optional)' }).map(([key, label]) => <label key={key} className="text-[11px] font-semibold text-slate-600">{label}<input required={!['line2', 'region', 'postalCode', 'countryCode'].includes(key)} maxLength={key === 'countryCode' ? 2 : undefined} value={address[key]} onChange={event => setAddress(current => ({ ...current, [key]: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs" /></label>)}
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={address.isDefault} onChange={event => setAddress(current => ({ ...current, isDefault: event.target.checked }))} />Default address</label>
            <button disabled={busy} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white">{editingAddressId ? 'Update address' : 'Save address'}</button>
          </form>
        </section>
      )}

      {tab === 'profile' && (
        <form onSubmit={saveProfile} className="grid max-w-2xl gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
          <div className="sm:col-span-2 flex items-center gap-2 text-sm font-bold text-slate-800"><BadgeCheck className="h-4 w-4 text-emerald-600" />Verified email: {customer.email}</div>
          <label className="text-xs font-semibold text-slate-600">Name<input required maxLength={120} value={profileDraft.name} onChange={event => setProfileDraft(current => ({ ...current, name: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5" /></label>
          <label className="text-xs font-semibold text-slate-600">Phone<input maxLength={40} value={profileDraft.phone} onChange={event => setProfileDraft(current => ({ ...current, phone: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5" /></label>
          <div className="sm:col-span-2 flex items-center gap-2 text-xs text-slate-500"><MapPin className="h-4 w-4" />{customer.addresses?.length || 0} saved address(es)</div>
          <p className="sm:col-span-2 text-xs text-slate-500">Customer identity and order records are private to this storefront.</p>
          <button disabled={busy} className="sm:col-span-2 rounded-lg bg-blue-600 px-3 py-2.5 text-xs font-bold text-white">Save profile</button>
        </form>
      )}
    </main>
  );
}
