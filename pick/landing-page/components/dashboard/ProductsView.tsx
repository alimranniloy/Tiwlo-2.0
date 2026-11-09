'use client'

import React, { useMemo, useState } from 'react'
import { Edit2, Plus, Search, Trash2 } from 'lucide-react'
import {
  pickAdminRequest,
  usePickAdminData,
  type AdminCategory,
  type AdminProduct,
} from '@/lib/pick-admin-api'

interface ProductForm {
  nameEn: string
  nameBn: string
  categoryId: string
  unitsEn: string
  unitsBn: string
  unitPrices: string
  oldPrice: string
  stockQuantity: string
  sku: string
  imageUrl: string
  origin: string
  deliveryTime: string
  badge: string
  descriptionEn: string
  descriptionBn: string
}

const emptyForm: ProductForm = {
  nameEn: '',
  nameBn: '',
  categoryId: '',
  unitsEn: '',
  unitsBn: '',
  unitPrices: '',
  oldPrice: '',
  stockQuantity: '',
  sku: '',
  imageUrl: '',
  origin: '',
  deliveryTime: '',
  badge: '',
  descriptionEn: '',
  descriptionBn: '',
}

const money = (amount: number) => `৳${Number(amount || 0).toLocaleString('en-BD')}`
const listFromInput = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean)

export const ProductsView: React.FC = () => {
  const { data: productData, loading, error, reload } = usePickAdminData<{ products: AdminProduct[] }>('/products')
  const { data: categoryData, error: categoryError, reload: reloadCategories } = usePickAdminData<{ categories: AdminCategory[] }>('/categories')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editing, setEditing] = useState<AdminProduct | null>(null)
  const [form, setForm] = useState<ProductForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState('')
  const products = productData?.products || []
  const categories = (categoryData?.categories || []).filter((category) => category.active)
  const groups = useMemo(() => ['All', ...new Set(categories.map((category) => category.groupEn).filter(Boolean))], [categories])
  const visibleProducts = products.filter((product) => {
    const category = categories.find((item) => item.id === product.categoryId)
    const matchesGroup = categoryFilter === 'All' || category?.groupEn === categoryFilter
    const matchesText = `${product.nameEn} ${product.name} ${product.category || ''} ${product.sku || ''}`.toLowerCase().includes(search.toLowerCase())
    return matchesGroup && matchesText
  })

  const openAdd = () => {
    setEditing(null)
    setForm(emptyForm)
    setActionError('')
    setIsModalOpen(true)
  }

  const openEdit = (product: AdminProduct) => {
    setEditing(product)
    setIsModalOpen(true)
    setForm({
      nameEn: product.nameEn,
      nameBn: product.name,
      categoryId: product.categoryId || '',
      unitsEn: Array.isArray(product.unitsEn) ? product.unitsEn.join(', ') : product.unitEn,
      unitsBn: Array.isArray(product.units) ? product.units.join(', ') : product.unit,
      unitPrices: Array.isArray(product.unitPrices) ? product.unitPrices.join(', ') : String(product.price),
      oldPrice: product.oldPrice === null ? '' : String(product.oldPrice),
      stockQuantity: String(product.stockCount),
      sku: product.sku || '',
      imageUrl: product.image || '',
      origin: product.origin || '',
      deliveryTime: product.deliveryTime || '',
      badge: product.badge || '',
      descriptionEn: product.descriptionEn || '',
      descriptionBn: product.description || '',
    })
    setActionError('')
  }

  const saveProduct = async (event: React.FormEvent) => {
    event.preventDefault()
    const unitsEn = listFromInput(form.unitsEn)
    const unitsBn = listFromInput(form.unitsBn)
    const priceList = listFromInput(form.unitPrices).map(Number)
    if (!unitsEn.length || unitsEn.length !== unitsBn.length || unitsEn.length !== priceList.length ||
        priceList.some((price) => !Number.isFinite(price) || price < 0)) {
      setActionError('Add the same number of English units, Bangla units, and valid prices in each comma-separated list.')
      return
    }

    setSaving(true)
    setActionError('')
    try {
      const payload = {
        nameEn: form.nameEn,
        nameBn: form.nameBn,
        categoryId: form.categoryId || null,
        unitsEn,
        unitsBn,
        unitPrices: priceList,
        oldPrice: form.oldPrice || null,
        stockQuantity: Number(form.stockQuantity),
        sku: form.sku || null,
        imageUrl: form.imageUrl,
        origin: form.origin,
        deliveryTime: form.deliveryTime,
        badge: form.badge || null,
        descriptionEn: form.descriptionEn,
        descriptionBn: form.descriptionBn,
        rating: editing?.rating ?? 0,
        reviewsCount: editing?.reviews || '',
      }
      await pickAdminRequest(editing ? `/products/${editing.id}` : '/products', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      })
      setEditing(null)
      setForm(emptyForm)
      setIsModalOpen(false)
      await reload()
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'Could not save this product.')
    } finally {
      setSaving(false)
    }
  }

  const deactivateProduct = async (product: AdminProduct) => {
    if (!window.confirm(`Remove ${product.nameEn} from the PICK app catalog?`)) return
    setActionError('')
    try {
      await pickAdminRequest(`/products/${product.id}`, { method: 'DELETE' })
      await reload()
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'Could not deactivate this product.')
    }
  }

  return (
    <div className="flex flex-col gap-5 p-5 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-ink">Products & Inventory</h2>
          <p className="mt-1 text-sm text-ink/55">Products and stock saved in the PICK catalog database.</p>
        </div>
        <button onClick={openAdd} className="flex h-10 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-semibold text-white"><Plus size={16} /> Add product</button>
      </div>

      {(error || categoryError || actionError) && <div role="alert" className="flex items-center justify-between rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{actionError || error || categoryError}<button onClick={() => { void reload(); void reloadCategories() }} className="ml-3 font-semibold underline">Retry</button></div>}

      <section className="ios-card flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-56 flex-1">
            <Search size={15} className="absolute left-3 top-2.5 text-ink/40" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products, SKU, or category…" className="h-9 w-full pl-9" />
          </div>
          <span className="text-sm text-ink/55">{loading ? 'Loading…' : `${visibleProducts.length} of ${products.length} products`}</span>
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {groups.map((group) => <button key={group} onClick={() => setCategoryFilter(group)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${categoryFilter === group ? 'bg-ink text-white' : 'bg-[#f2f2f7] text-ink/60'}`}>{group}</button>)}
        </div>
      </section>

      <section className="ios-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-paper text-xs text-ink/50">
              <tr><th className="px-4 py-3">Product</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Unit prices</th><th className="px-4 py-3">Stock</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody>
              {visibleProducts.map((product) => (
                <tr key={product.id} className="border-t border-black/5">
                  <td className="px-4 py-3"><strong>{product.nameEn}</strong><div className="text-xs text-ink/55">{product.name}{product.sku ? ` · ${product.sku}` : ''}</div></td>
                  <td className="px-4 py-3">{product.categoryEn || '—'}<div className="text-xs text-ink/55">{product.category || ''}</div></td>
                  <td className="px-4 py-3">{product.unitsEn.map((unit, index) => <div key={`${unit}-${index}`} className="text-xs">{unit}: <strong>{money(product.unitPrices[index] ?? product.price)}</strong></div>)}</td>
                  <td className="px-4 py-3">{product.stockCount}</td>
                  <td className="px-4 py-3"><span className={`badge ${product.active ? product.inStock ? 'badge-success' : 'badge-warning' : 'badge-neutral'}`}>{!product.active ? 'Inactive' : product.inStock ? 'In stock' : 'Out of stock'}</span></td>
                  <td className="px-4 py-3 text-right"><div className="inline-flex gap-2"><button onClick={() => openEdit(product)} aria-label={`Edit ${product.nameEn}`} className="rounded-lg bg-[#f2f2f7] p-2"><Edit2 size={15} /></button>{product.active && <button onClick={() => void deactivateProduct(product)} aria-label={`Deactivate ${product.nameEn}`} className="rounded-lg bg-red-50 p-2 text-red-700"><Trash2 size={15} /></button>}</div></td>
                </tr>
              ))}
              {!loading && !error && !visibleProducts.length && <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-ink/50">No products match this filter. Add products with the prices and stock you actually sell.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="product-form-title">
          <form onSubmit={saveProduct} className="ios-card my-6 w-full max-w-3xl space-y-4 p-6">
            <div className="flex items-center justify-between"><h3 id="product-form-title" className="text-lg font-semibold">{editing ? 'Edit product' : 'Add a PICK product'}</h3><button type="button" onClick={() => { setEditing(null); setForm(emptyForm); setIsModalOpen(false); setActionError('') }} aria-label="Close" className="rounded-full bg-[#f2f2f7] px-3 py-1">×</button></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">Name (English)<input required maxLength={255} value={form.nameEn} onChange={(event) => setForm({ ...form, nameEn: event.target.value })} className="mt-1 h-10 w-full" /></label>
              <label className="text-sm font-medium">Name (বাংলা)<input required maxLength={255} value={form.nameBn} onChange={(event) => setForm({ ...form, nameBn: event.target.value })} className="mt-1 h-10 w-full" /></label>
              <label className="text-sm font-medium">Category<select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })} className="mt-1 h-10 w-full"><option value="">No category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.nameEn} / {category.nameBn}</option>)}</select></label>
              <label className="text-sm font-medium">SKU (optional)<input maxLength={128} value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} className="mt-1 h-10 w-full" /></label>
              <label className="text-sm font-medium sm:col-span-2">English units, comma separated<input required value={form.unitsEn} onChange={(event) => setForm({ ...form, unitsEn: event.target.value })} placeholder="500 g, 1 kg" className="mt-1 h-10 w-full" /></label>
              <label className="text-sm font-medium sm:col-span-2">Bangla units, same order<input required value={form.unitsBn} onChange={(event) => setForm({ ...form, unitsBn: event.target.value })} placeholder="৫০০ গ্রাম, ১ কেজি" className="mt-1 h-10 w-full" /></label>
              <label className="text-sm font-medium sm:col-span-2">Unit prices in ৳, same order<input required value={form.unitPrices} onChange={(event) => setForm({ ...form, unitPrices: event.target.value })} placeholder="25, 45" className="mt-1 h-10 w-full" /></label>
              <label className="text-sm font-medium">Previous price (optional)<input type="number" min="0" step="0.01" value={form.oldPrice} onChange={(event) => setForm({ ...form, oldPrice: event.target.value })} className="mt-1 h-10 w-full" /></label>
              <label className="text-sm font-medium">Stock quantity<input required type="number" min="0" step="0.001" value={form.stockQuantity} onChange={(event) => setForm({ ...form, stockQuantity: event.target.value })} className="mt-1 h-10 w-full" /></label>
              <label className="text-sm font-medium">Image URL<input type="url" maxLength={2000} value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} className="mt-1 h-10 w-full" /></label>
              <label className="text-sm font-medium">Origin<input maxLength={255} value={form.origin} onChange={(event) => setForm({ ...form, origin: event.target.value })} className="mt-1 h-10 w-full" /></label>
              <label className="text-sm font-medium">Delivery time<input maxLength={64} value={form.deliveryTime} onChange={(event) => setForm({ ...form, deliveryTime: event.target.value })} className="mt-1 h-10 w-full" /></label>
              <label className="text-sm font-medium">Badge<input maxLength={64} value={form.badge} onChange={(event) => setForm({ ...form, badge: event.target.value })} className="mt-1 h-10 w-full" /></label>
              <label className="text-sm font-medium">Description (English)<textarea maxLength={1000} value={form.descriptionEn} onChange={(event) => setForm({ ...form, descriptionEn: event.target.value })} className="mt-1 min-h-20 w-full" /></label>
              <label className="text-sm font-medium">Description (বাংলা)<textarea maxLength={1000} value={form.descriptionBn} onChange={(event) => setForm({ ...form, descriptionBn: event.target.value })} className="mt-1 min-h-20 w-full" /></label>
            </div>
            {actionError && <p role="alert" className="text-sm text-red-700">{actionError}</p>}
            <div className="flex justify-end gap-2"><button type="button" onClick={() => { setEditing(null); setForm(emptyForm); setIsModalOpen(false) }} className="rounded-full bg-[#f2f2f7] px-4 py-2 text-sm">Cancel</button><button disabled={saving} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save product'}</button></div>
          </form>
        </div>
      )}
    </div>
  )
}
