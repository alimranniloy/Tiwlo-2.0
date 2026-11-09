'use client'

import React, { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { pickAdminRequest, usePickAdminData, type AdminCategory } from '@/lib/pick-admin-api'

export const CategoriesView: React.FC = () => {
  const { data, loading, error, reload } = usePickAdminData<{ categories: AdminCategory[] }>('/categories')
  const [search, setSearch] = useState('')
  const [selectedGroup, setSelectedGroup] = useState('All')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [nameEn, setNameEn] = useState('')
  const [nameBn, setNameBn] = useState('')
  const [groupEn, setGroupEn] = useState('')
  const [groupBn, setGroupBn] = useState('')
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState('')
  const categories = data?.categories || []
  const groups = useMemo(
    () => ['All', ...new Set(categories.map((category) => category.groupEn).filter(Boolean))],
    [categories],
  )
  const filtered = categories.filter((category) => {
    const matchesGroup = selectedGroup === 'All' || category.groupEn === selectedGroup
    const matchesSearch = `${category.nameEn} ${category.nameBn}`.toLowerCase().includes(search.toLowerCase())
    return matchesGroup && matchesSearch
  })

  const addCategory = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setActionError('')
    try {
      await pickAdminRequest('/categories', {
        method: 'POST',
        body: JSON.stringify({ nameEn, nameBn, groupEn, groupBn }),
      })
      setIsModalOpen(false)
      setNameEn('')
      setNameBn('')
      setGroupEn('')
      setGroupBn('')
      await reload()
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'Could not save this category.')
    } finally {
      setSaving(false)
    }
  }

  const toggleCategory = async (category: AdminCategory) => {
    setActionError('')
    try {
      await pickAdminRequest(`/categories/${encodeURIComponent(category.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !category.active }),
      })
      await reload()
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'Could not update this category.')
    }
  }

  return (
    <div className="flex flex-col gap-5 p-5 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-ink">PICK Product Categories</h2>
          <p className="mt-1 text-sm text-ink/55">Categories currently saved in the PICK PostgreSQL catalog.</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="flex h-10 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-semibold text-white">
          <Plus size={16} /> Create category
        </button>
      </div>

      {(error || actionError) && (
        <div role="alert" className="flex items-center justify-between rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {actionError || error}<button onClick={reload} className="ml-3 font-semibold underline">Retry</button>
        </div>
      )}

      <section className="ios-card flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-56 flex-1">
            <Search size={15} className="absolute left-3 top-2.5 text-ink/40" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search category names…" className="h-9 w-full pl-9" />
          </div>
          <span className="text-sm text-ink/55">{loading ? 'Loading…' : `${filtered.length} of ${categories.length} categories`}</span>
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {groups.map((group) => (
            <button key={group} onClick={() => setSelectedGroup(group)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${selectedGroup === group ? 'bg-ink text-white' : 'bg-[#f2f2f7] text-ink/60'}`}>
              {group}
            </button>
          ))}
        </div>
      </section>

      <section className="ios-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-paper text-xs text-ink/50">
              <tr><th className="px-4 py-3">Category</th><th className="px-4 py-3">Group</th><th className="px-4 py-3">ID</th><th className="px-4 py-3">Products</th><th className="px-4 py-3 text-right">Status</th></tr>
            </thead>
            <tbody>
              {filtered.map((category) => (
                <tr key={category.id} className="border-t border-black/5">
                  <td className="px-4 py-3"><strong>{category.nameEn}</strong><div className="text-xs text-ink/55">{category.nameBn}</div></td>
                  <td className="px-4 py-3">{category.groupEn || '—'}{category.groupBn && <div className="text-xs text-ink/55">{category.groupBn}</div>}</td>
                  <td className="px-4 py-3 font-mono text-xs">{category.id}</td>
                  <td className="px-4 py-3">{category.itemCount}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => void toggleCategory(category)} className={`rounded-full px-3 py-1 text-xs font-semibold ${category.active ? 'bg-[#f2f2f7] text-ink' : 'bg-red-50 text-red-700'}`}>
                      {category.active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && !error && !filtered.length && <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-ink/50">No matching categories exist in the PICK catalog.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="create-category-title">
          <form onSubmit={addCategory} className="ios-card w-full max-w-lg space-y-4 p-6">
            <h3 id="create-category-title" className="text-lg font-semibold">Create a PICK category</h3>
            <label className="block text-sm font-medium">English name<input required maxLength={255} value={nameEn} onChange={(event) => setNameEn(event.target.value)} className="mt-1 h-10 w-full" /></label>
            <label className="block text-sm font-medium">Bangla name<input required maxLength={255} value={nameBn} onChange={(event) => setNameBn(event.target.value)} className="mt-1 h-10 w-full" /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium">Group (English)<input maxLength={128} value={groupEn} onChange={(event) => setGroupEn(event.target.value)} className="mt-1 h-10 w-full" /></label>
              <label className="block text-sm font-medium">Group (Bangla)<input maxLength={128} value={groupBn} onChange={(event) => setGroupBn(event.target.value)} className="mt-1 h-10 w-full" /></label>
            </div>
            {actionError && <p role="alert" className="text-sm text-red-700">{actionError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-full bg-[#f2f2f7] px-4 py-2 text-sm">Cancel</button>
              <button disabled={saving} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save category'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
