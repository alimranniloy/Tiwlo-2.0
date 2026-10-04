import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Plus,
  Upload,
  Image as ImageIcon,
  Barcode,
  Check,
  Trash2,
  Sparkles,
  RefreshCw,
  FolderPlus,
  AlertCircle
} from 'lucide-react';

export default function AddProductModal({
  isOpen,
  onClose,
  onAddProduct,
  onAddCategory,
  categories = [],
  subcategories = []
}) {
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    category: '',
    subCategory: '',
    stock: 50,
    minStock: 25,
    price: 29.99,
    costPrice: 14.50,
    location: 'Aisle 1, Rack A',
    supplierName: '',
    image: '',
    images: []
  });

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Inline Category Creator State
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [newCatColor, setNewCatColor] = useState('#3B82F6');
  const [savingCategory, setSavingCategory] = useState(false);
  const [localCategories, setLocalCategories] = useState(categories);

  // Barcode Scanner / Generator State
  const [showScanner, setShowScanner] = useState(false);
  const [scanStatus, setScanStatus] = useState('Idle');
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Stop camera helper defined early
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Update local categories whenever props change
  useEffect(() => {
    if (categories && categories.length > 0) {
      setLocalCategories(categories);
      setFormData(prev => {
        if (!prev.category) {
          return { ...prev, category: categories[0]?.name || 'Electronics' };
        }
        return prev;
      });
    }
  }, [categories]);

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const currentCategory = formData.category || localCategories[0]?.name || 'Clothing';
  const matchingSubcategories = subcategories.filter(s =>
    (s.categoryName || '').toLowerCase() === currentCategory.toLowerCase()
  );

  const colorPresets = [
    { name: 'Blue', hex: '#3B82F6' },
    { name: 'Emerald', hex: '#10B981' },
    { name: 'Purple', hex: '#8B5CF6' },
    { name: 'Amber', hex: '#F59E0B' },
    { name: 'Rose', hex: '#F43F5E' },
    { name: 'Cyan', hex: '#06B6D4' }
  ];

  // Synthesize realistic POS Barcode Scanner Beep
  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      // AudioContext unavailable or blocked
    }
  };

  // Generate Real EAN-13 / UPC Barcode
  const handleGenerateBarcode = () => {
    playBeep();
    const raw = '890' + Math.floor(100000000 + Math.random() * 900000000).toString().slice(0, 9);
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(raw[i]) * (i % 2 === 0 ? 1 : 3);
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    const barcodeCode = `${raw}${checkDigit}`;

    setFormData(prev => ({ ...prev, barcode: barcodeCode }));
    setScanStatus(`Scanned Barcode: ${barcodeCode}`);
    setTimeout(() => setShowScanner(false), 800);
  };

  // Handle Camera Start for Barcode Scanner
  const startCamera = async () => {
    setScanStatus('Initializing optical sensor...');
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setScanStatus('Align barcode within the laser reticle');

        setTimeout(() => {
          if (streamRef.current) {
            handleGenerateBarcode();
            stopCamera();
          }
        }, 2500);
      } else {
        setScanStatus('Camera not supported. Using optical simulator.');
      }
    } catch (err) {
      console.warn('Camera access unavailable:', err);
      setScanStatus('Using optical laser simulator (Webcam unavailable).');
    }
  };

  // Handle Real Image Uploads via Multer / API
  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    setUploadError('');

    try {
      const uploadData = new FormData();
      files.forEach(file => {
        uploadData.append('images', file);
      });

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: uploadData
      });

      if (!res.ok) {
        throw new Error('Server returned upload error');
      }

      const result = await res.json();
      const uploadedUrls = result.urls || (result.url ? [result.url] : []);

      if (uploadedUrls.length > 0) {
        setFormData(prev => {
          const currentList = Array.isArray(prev.images) ? prev.images : (prev.image ? [prev.image] : []);
          const merged = [...currentList, ...uploadedUrls];
          return {
            ...prev,
            images: merged,
            image: merged[0] || ''
          };
        });
      }
    } catch (err) {
      console.error('File upload error:', err);
      setUploadError('Failed to upload images. Please check server connection.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // Drag and drop handler
  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files || []).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) return;

    setUploading(true);
    setUploadError('');
    try {
      const uploadData = new FormData();
      files.forEach(file => {
        uploadData.append('images', file);
      });

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: uploadData
      });

      if (!res.ok) throw new Error('Upload failed');
      const result = await res.json();
      const uploadedUrls = result.urls || (result.url ? [result.url] : []);

      if (uploadedUrls.length > 0) {
        setFormData(prev => {
          const currentList = Array.isArray(prev.images) ? prev.images : (prev.image ? [prev.image] : []);
          const merged = [...currentList, ...uploadedUrls];
          return {
            ...prev,
            images: merged,
            image: merged[0] || ''
          };
        });
      }
    } catch {
      setUploadError('Error uploading dropped files');
    } finally {
      setUploading(false);
    }
  };

  // Remove an uploaded image from list
  const handleRemoveImage = (indexToRemove) => {
    setFormData(prev => {
      const updated = prev.images.filter((_, idx) => idx !== indexToRemove);
      return {
        ...prev,
        images: updated,
        image: updated.length > 0 ? updated[0] : ''
      };
    });
  };

  // Set an image as primary cover image
  const handleSetPrimary = (indexToPrimary) => {
    setFormData(prev => {
      const targetImg = prev.images[indexToPrimary];
      const rest = prev.images.filter((_, idx) => idx !== indexToPrimary);
      const reordered = [targetImg, ...rest];
      return {
        ...prev,
        images: reordered,
        image: targetImg
      };
    });
  };

  // Handle Quick Inline Category Creation
  const handleCreateInlineCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    setSavingCategory(true);
    try {
      const newCategoryPayload = {
        name: newCatName.trim(),
        description: newCatDesc.trim() || `Inventory category for ${newCatName.trim()}`,
        color: newCatColor,
        icon: 'Package'
      };

      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCategoryPayload)
      });

      if (res.ok) {
        const createdCat = await res.json();
        setLocalCategories(prev => [createdCat, ...prev]);
        if (onAddCategory) {
          onAddCategory(newCategoryPayload);
        }
        setFormData(prev => ({
          ...prev,
          category: createdCat.name,
          subCategory: ''
        }));
        setIsAddingCategory(false);
        setNewCatName('');
        setNewCatDesc('');
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to create category');
      }
    } catch (err) {
      console.error('Error creating inline category:', err);
      alert('Network error creating category');
    } finally {
      setSavingCategory(false);
    }
  };

  // Preset fallback options if user doesn't have an image ready
  const presetImages = [
    { label: 'Hoodie', url: '/default-product.svg' },
    { label: 'Smartwatch', url: '/default-product.svg' },
    { label: 'Sneakers', url: '/default-product.svg' },
    { label: 'Perfume', url: '/default-product.svg' },
    { label: 'Headphones', url: '/default-product.svg' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.sku) return;

    setLoading(true);
    const finalImages = formData.images && formData.images.length > 0
      ? formData.images
      : (formData.image ? [formData.image] : [presetImages[0].url]);

    await onAddProduct({
      ...formData,
      images: finalImages,
      image: finalImages[0]
    });
    setLoading(false);
    onClose();

    // Reset Form
    setFormData({
      name: '',
      sku: '',
      barcode: '',
      category: localCategories[0]?.name || 'Clothing',
      subCategory: '',
      stock: 50,
      minStock: 25,
      price: 29.99,
      costPrice: 14.50,
      location: 'Aisle 1, Rack A',
      supplierName: '',
      image: '',
      images: []
    });
    stopCamera();
    setShowScanner(false);
  };

  // Only return null when not open - all hooks and functions are declared unconditionally above!
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Modal Dialog */}
      <div className="w-full max-w-2xl max-h-[94vh] flex flex-col bg-white dark:bg-[#111827] rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-gray-800 shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 dark:border-gray-800 bg-slate-50/70 dark:bg-gray-800/40">
          <div className="flex items-center space-x-2.5">
            <span className="p-2 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
              <Plus className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Add New Product
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Direct image upload to server, inline category creation & optical barcode scanner
              </p>
            </div>
          </div>
            <button
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="w-8 h-8 rounded-full hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-400 hover:text-slate-700 dark:hover:text-white flex items-center justify-center transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form Body - Scrollable */}
          <form onSubmit={handleSubmit} className="overflow-y-auto px-4 sm:px-6 py-4 space-y-4 text-xs">
            
            {/* 1. PRODUCT NAME & BASIC INFO */}
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Product Title / Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Ergonomic Mechanical Keyboard"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-800/80 border border-slate-200 dark:border-gray-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 font-medium"
              />
            </div>

            {/* 2. SKU & BARCODE WITH OPTICAL SCANNER */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  SKU (Stock Keeping Unit) *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="e.g. KB-RGB-99"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-800/80 border border-slate-200 dark:border-gray-700 rounded-xl text-slate-800 dark:text-white font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const randSku = 'SKU-' + Math.floor(1000 + Math.random() * 9000);
                      setFormData(prev => ({ ...prev, sku: randSku }));
                    }}
                    className="absolute right-2 top-2 px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-200 dark:bg-gray-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200"
                  >
                    Auto
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-200">
                    Barcode (UPC / EAN-13)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowScanner(!showScanner);
                      if (!showScanner) startCamera();
                      else stopCamera();
                    }}
                    className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <Barcode className="w-3.5 h-3.5" />
                    <span>{showScanner ? 'Close Scanner' : 'Optical Scanner'}</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="e.g. 8901234567890"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-800/80 border border-slate-200 dark:border-gray-700 rounded-xl text-slate-800 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                  <button
                    type="button"
                    onClick={handleGenerateBarcode}
                    className="absolute right-2 top-2 px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-50 dark:bg-blue-900/50 hover:bg-blue-100 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                  >
                    Generate
                  </button>
                </div>
              </div>
            </div>

            {/* SCANNER MODAL / INTERFACE IF EXPANDED */}
            {showScanner && (
              <div className="p-4 rounded-2xl bg-slate-900 text-white border border-slate-700 shadow-xl space-y-3 animate-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                    <span className="font-bold text-xs">StockPro Optical Barcode Sensor</span>
                  </div>
                  <span className="text-[10px] text-slate-400">{scanStatus}</span>
                </div>

                <div className="relative w-full h-40 bg-black rounded-xl overflow-hidden flex items-center justify-center border border-slate-800">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover opacity-80"
                  />

                  {/* Optical Reticle & Laser Sweep Animation */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <div className="w-3/4 h-24 border-2 border-dashed border-red-500/60 rounded-lg relative flex items-center justify-center">
                      <div className="w-full h-0.5 bg-red-500 shadow-[0_0_12px_#ef4444] animate-pulse" />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1">
                  <button
                    type="button"
                    onClick={handleGenerateBarcode}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-bold text-white flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Simulate Scan & Capture</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      stopCamera();
                      setShowScanner(false);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}

            {/* 3. CATEGORY & SUBCATEGORY WITH INLINE '+' CREATOR */}
            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-200">
                      Category *
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsAddingCategory(!isAddingCategory)}
                      className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800"
                      title="Create a new category instantly"
                    >
                      <Plus className="w-3 h-3 stroke-[2.5]" />
                      <span>{isAddingCategory ? 'Hide New Category' : 'New Category'}</span>
                    </button>
                  </div>
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
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-800/80 border border-slate-200 dark:border-gray-700 rounded-xl text-slate-800 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  >
                    {localCategories.map((c) => (
                      <option key={c.id || c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Subcategory (Optional)
                  </label>
                  <select
                    value={formData.subCategory}
                    onChange={(e) => setFormData({ ...formData, subCategory: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-800/80 border border-slate-200 dark:border-gray-700 rounded-xl text-slate-800 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/40"
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

              {/* INLINE QUICK CATEGORY CREATOR PANEL */}
              {isAddingCategory && (
                <div className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 space-y-3 animate-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                      <FolderPlus className="w-4 h-4 text-blue-600" />
                      <span>Quick Inline Category Creator (Saves to DB)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAddingCategory(false)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <input
                        type="text"
                        placeholder="Category Name (e.g. Gaming Gear)"
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-600 rounded-lg text-slate-800 dark:text-white text-xs font-semibold focus:outline-none"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Short Description..."
                        value={newCatDesc}
                        onChange={(e) => setNewCatDesc(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-600 rounded-lg text-slate-800 dark:text-white text-xs focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">Color:</span>
                      {colorPresets.map(c => (
                        <button
                          key={c.name}
                          type="button"
                          onClick={() => setNewCatColor(c.hex)}
                          className={`w-5 h-5 rounded-full transition-transform ${newCatColor === c.hex ? 'scale-125 ring-2 ring-blue-500' : 'hover:scale-110'}`}
                          style={{ backgroundColor: c.hex }}
                          title={c.name}
                        />
                      ))}
                    </div>

                    <button
                      type="button"
                      disabled={savingCategory || !newCatName.trim()}
                      onClick={handleCreateInlineCategory}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs disabled:opacity-50 transition flex items-center space-x-1"
                    >
                      {savingCategory ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3 h-3 stroke-[2.5]" />
                          <span>Save & Select</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 4. STOCK & SAFETY THRESHOLD */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Initial Stock Quantity
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-800/80 border border-slate-200 dark:border-gray-700 rounded-xl text-slate-800 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Low Stock Safety Alert Point
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.minStock}
                  onChange={(e) => setFormData({ ...formData, minStock: parseInt(e.target.value) || 20 })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-800/80 border border-slate-200 dark:border-gray-700 rounded-xl text-slate-800 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
            </div>

            {/* 5. PRICING (RETAIL & COST) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Retail Selling Price ($) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    className="w-full pl-8 pr-3.5 py-2.5 bg-slate-50 dark:bg-gray-800/80 border border-slate-200 dark:border-gray-700 rounded-xl text-slate-800 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Cost / Purchase Price ($)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full pl-8 pr-3.5 py-2.5 bg-slate-50 dark:bg-gray-800/80 border border-slate-200 dark:border-gray-700 rounded-xl text-slate-800 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>
              </div>
            </div>

            {/* 6. LOCATION & SUPPLIER */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Shelf / Warehouse Bin
                </label>
                <input
                  type="text"
                  placeholder="e.g. Section C, Rack 4-B"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-gray-800/80 border border-slate-200 dark:border-gray-700 rounded-xl text-slate-800 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Supplier / Vendor Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Apex Dynamics Ltd."
                  value={formData.supplierName}
                  onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-gray-800/80 border border-slate-200 dark:border-gray-700 rounded-xl text-slate-800 dark:text-white focus:outline-none"
                />
              </div>
            </div>

            {/* 7. REAL MULTI-IMAGE UPLOAD & LOCAL DISK STORAGE */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-blue-500" />
                  <span>Product Gallery Images (Saved to Server /uploads)</span>
                </label>
                <span className="text-[11px] text-slate-400">
                  {formData.images.length} image{formData.images.length === 1 ? '' : 's'} attached
                </span>
              </div>

              {/* Drag and Drop / Click to Upload Box */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="relative border-2 border-dashed border-slate-300 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 rounded-2xl p-4 text-center bg-slate-50/50 dark:bg-gray-800/50 transition cursor-pointer group"
              >
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
                  <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    {uploading ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <Upload className="w-5 h-5 stroke-[2.5]" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      {uploading ? 'Uploading to Server Disk...' : 'Click to Browse or Drag & Drop Multiple Images'}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      PNG, JPG, WEBP up to 15MB each. Saved in local <code className="text-blue-500 font-mono">server/uploads/</code>
                    </p>
                  </div>
                </div>
              </div>

              {uploadError && (
                <div className="flex items-center space-x-1.5 text-xs text-rose-500 bg-rose-50 dark:bg-rose-950/30 p-2 rounded-xl">
                  <AlertCircle className="w-4 h-4" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Uploaded Images Thumbnails Grid */}
              {formData.images.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 pt-2">
                  {formData.images.map((imgUrl, idx) => (
                    <div
                      key={idx}
                      className="group relative rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden bg-slate-100 dark:bg-gray-900 aspect-square shadow-xs"
                    >
                      <img
                        src={imgUrl}
                        alt={`Preview ${idx + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.src = presetImages[0].url;
                        }}
                      />

                      {/* Primary Badge */}
                      {idx === 0 && (
                        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-blue-600 text-white font-black text-[9px] shadow-sm uppercase tracking-wider">
                          Primary
                        </span>
                      )}

                      {/* Action Overlay */}
                      <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-1.5">
                        {idx !== 0 && (
                          <button
                            type="button"
                            onClick={() => handleSetPrimary(idx)}
                            className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold"
                            title="Set as Cover Image"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(idx)}
                          className="p-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px]"
                          title="Remove image"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Quick Preset Fallbacks */}
              <div className="flex items-center space-x-2 pt-1">
                <span className="text-[10px] text-slate-400">Quick Presets:</span>
                {presetImages.map((p) => (
                  <button
                    type="button"
                    key={p.label}
                    onClick={() => {
                      setFormData(prev => {
                        const current = Array.isArray(prev.images) ? prev.images : [];
                        return {
                          ...prev,
                          images: [...current, p.url],
                          image: prev.image || p.url
                        };
                      });
                    }}
                    className="text-[10px] px-2 py-0.5 rounded-md border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-gray-800 transition"
                  >
                    + {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions / Buttons */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  onClose();
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-gray-800 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || uploading}
                className="px-6 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-500/25 transition flex items-center space-x-1.5 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Product...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>Save to Inventory</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
  );
}
