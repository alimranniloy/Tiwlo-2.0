import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  Upload,
  Image as ImageIcon,
  Trash2,
  RefreshCw,
  AlertCircle,
  Sparkles
} from 'lucide-react';

export default function EditProductModal({
  isOpen,
  onClose,
  product,
  onUpdateProduct,
  categories = [],
  subcategories = []
}) {
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    category: 'Clothing',
    subCategory: '',
    stock: 0,
    minStock: 30,
    price: 0,
    costPrice: 0,
    location: '',
    supplierName: '',
    image: '',
    images: []
  });

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    if (product) {
      const existingImages = Array.isArray(product.images) && product.images.length > 0
        ? product.images
        : (product.image ? [product.image] : []);

      setFormData({
        name: product.name || '',
        sku: product.sku || '',
        barcode: product.barcode || '',
        category: product.category || 'Clothing',
        subCategory: product.subCategory || '',
        stock: product.stock !== undefined ? product.stock : 0,
        minStock: product.minStock !== undefined ? product.minStock : 30,
        price: product.price !== undefined ? product.price : 0,
        costPrice: product.costPrice !== undefined ? product.costPrice : 0,
        location: product.location || '',
        supplierName: product.supplierName || '',
        image: product.image || (existingImages[0] || ''),
        images: existingImages
      });
    }
  }, [product]);

  const currentCategory = formData.category || 'Clothing';
  const matchingSubcategories = subcategories.filter(s =>
    (s.categoryName || '').toLowerCase() === currentCategory.toLowerCase()
  );

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    setUploadError('');
    try {
      const uploadData = new FormData();
      files.forEach(f => uploadData.append('images', f));

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: uploadData
      });
      if (!res.ok) throw new Error('Upload error');
      const result = await res.json();
      const urls = result.urls || (result.url ? [result.url] : []);

      if (urls.length > 0) {
        setFormData(prev => {
          const current = Array.isArray(prev.images) ? prev.images : [];
          const updated = [...current, ...urls];
          return {
            ...prev,
            images: updated,
            image: updated[0] || ''
          };
        });
      }
    } catch (err) {
      setUploadError('Failed to upload file(s)');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveImage = (index) => {
    setFormData(prev => {
      const updated = prev.images.filter((_, i) => i !== index);
      return {
        ...prev,
        images: updated,
        image: updated.length > 0 ? updated[0] : ''
      };
    });
  };

  const handleSetPrimary = (index) => {
    setFormData(prev => {
      const target = prev.images[index];
      const rest = prev.images.filter((_, i) => i !== index);
      const reordered = [target, ...rest];
      return {
        ...prev,
        images: reordered,
        image: target
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const finalImages = formData.images && formData.images.length > 0
      ? formData.images
      : (formData.image ? [formData.image] : []);

    await onUpdateProduct(product.id, {
      ...formData,
      images: finalImages,
      image: finalImages[0] || ''
    });
    setLoading(false);
    onClose();
  };

  if (!isOpen || !product) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl max-h-[94vh] flex flex-col bg-white dark:bg-[#111827] rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-gray-800 shadow-2xl overflow-hidden">
        
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 dark:border-gray-800 bg-slate-50/70 dark:bg-gray-800/40">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Edit Product Details</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                {formData.sku || 'SKU'}
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Update inventory stock levels, pricing, category classification & photos
            </p>
          </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-400 hover:text-slate-600 dark:hover:text-white flex items-center justify-center transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="overflow-y-auto px-4 sm:px-6 py-4 space-y-3.5 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Product Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-slate-800 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  SKU *
                </label>
                <input
                  type="text"
                  required
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-slate-800 dark:text-white uppercase font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Barcode (UPC/EAN)
                </label>
                <input
                  type="text"
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-slate-800 dark:text-white font-mono focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => {
                    const newCat = e.target.value;
                    const firstSub = subcategories.find(s => (s.categoryName || '').toLowerCase() === newCat.toLowerCase());
                    setFormData({
                      ...formData,
                      category: newCat,
                      subCategory: firstSub?.name || ''
                    });
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                >
                  {categories.map((c) => (
                    <option key={c.id || c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Subcategory
                </label>
                <select
                  value={formData.subCategory}
                  onChange={(e) => setFormData({ ...formData, subCategory: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-slate-800 dark:text-white focus:outline-none"
                >
                  <option value="">None / General</option>
                  {matchingSubcategories.map((s) => (
                    <option key={s.id || s.name} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Stock Units (Available)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-slate-800 dark:text-white font-semibold focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Low Stock Safety Threshold
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.minStock}
                  onChange={(e) => setFormData({ ...formData, minStock: parseInt(e.target.value) || 1 })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-slate-800 dark:text-white font-semibold focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Retail Selling Price ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-slate-800 dark:text-white font-bold focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Cost / Buy Price ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.costPrice}
                  onChange={(e) => setFormData({ ...formData, costPrice: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-slate-800 dark:text-white font-bold focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Location / Rack
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Supplier Name
                </label>
                <input
                  type="text"
                  value={formData.supplierName}
                  onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-slate-800 dark:text-white"
                />
              </div>
            </div>

            {/* Gallery Images Management */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-blue-500" />
                  <span>Product Gallery ({formData.images.length})</span>
                </label>
                <label className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-1">
                  <Upload className="w-3 h-3" />
                  <span>{uploading ? 'Uploading...' : 'Upload Photos'}</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              {uploadError && (
                <div className="text-xs text-rose-500 bg-rose-50 dark:bg-rose-950/30 p-2 rounded-xl">
                  {uploadError}
                </div>
              )}

              {formData.images.length > 0 ? (
                <div className="grid grid-cols-4 gap-2.5">
                  {formData.images.map((imgUrl, idx) => (
                    <div
                      key={idx}
                      className="group relative rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden aspect-square bg-slate-100 dark:bg-gray-900"
                    >
                      <img
                        src={imgUrl}
                        alt={`Photo ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      {idx === 0 && (
                        <span className="absolute top-1 left-1 px-1 py-0.5 rounded bg-blue-600 text-white font-bold text-[8px] uppercase">
                          Cover
                        </span>
                      )}
                      <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-1">
                        {idx !== 0 && (
                          <button
                            type="button"
                            onClick={() => handleSetPrimary(idx)}
                            className="p-1 rounded bg-blue-600 text-white text-[10px]"
                            title="Set as Cover"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(idx)}
                          className="p-1 rounded bg-rose-600 text-white text-[10px]"
                          title="Remove"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-3 border border-dashed border-slate-200 dark:border-gray-700 rounded-xl text-slate-400 text-xs">
                  No images uploaded yet. Click "Upload Photos" above.
                </div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100 dark:border-gray-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-gray-800 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || uploading}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 transition flex items-center space-x-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{loading ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
  );
}
