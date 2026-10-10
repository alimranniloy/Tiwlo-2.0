import { applicationFetch as fetch } from '../api/graphqlTransport.js';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Plus,
  Upload,
  Image as ImageIcon,
  Barcode as BarcodeIcon,
  Layers,
  DollarSign,
  Package,
  FileText,
  Sparkles,
  Camera,
  Trash2,
  Star,
  RefreshCw,
  FolderPlus,
  AlertCircle,
  Code,
  Eye,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Heading2,
  Heading3,
  Table as TableIcon,
  Printer,
  Sliders,
  CheckCircle2,
  Tag
} from 'lucide-react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

export default function AddProductView({
  onBack,
  onSaveProduct,
  onAddCategory,
  onAddSubcategory,
  categories = [],
  subcategories = [],
  onOpenPrintBarcode = null
}) {
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;

  // Main Form Data
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    category: '',
    subCategory: '',
    brand: '',
    unit: 'Pcs',
    stock: 50,
    minStock: 20,
    price: 39.99,
    costPrice: 19.50,
    location: 'Aisle 1, Shelf A',
    supplierName: '',
    status: 'In Stock',
    description: '<p><strong>Premium quality</strong> product manufactured with durable materials. Designed for high performance and everyday reliability.</p><ul><li>High durability rating</li><li>Certified industry standard</li><li>1 Year manufacturer warranty</li></ul>',
    image: '',
    images: []
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Rich HTML Description Editor State
  const [editorMode, setEditorMode] = useState('visual'); // 'visual' | 'code' | 'preview'
  const editorRef = useRef(null);

  // Multi-image upload state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  // Optical Camera state for taking pictures
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Inline Category & Subcategory Taxonomy Creator State
  const [isAddingTaxonomy, setIsAddingTaxonomy] = useState(false);
  const [taxonomyType, setTaxonomyType] = useState('category'); // 'category' | 'subcategory'
  const [newTaxName, setNewTaxName] = useState('');
  const [newTaxDesc, setNewTaxDesc] = useState('');
  const [newTaxParentCatId, setNewTaxParentCatId] = useState('');
  const [savingTaxonomy, setSavingTaxonomy] = useState(false);
  const [taxSuccessMsg, setTaxSuccessMsg] = useState('');
  const [localCategories, setLocalCategories] = useState(categories);
  const [localSubcategories, setLocalSubcategories] = useState(subcategories);

  // Barcode Preview in Step 4
  const barcodeSvgRef = useRef(null);
  const [barcodeFormat, setBarcodeFormat] = useState('CODE128');

  // Initialize categories
  useEffect(() => {
    if (categories && categories.length > 0) {
      setLocalCategories(categories);
      if (!formData.category) {
        setFormData(prev => ({ ...prev, category: categories[0]?.name || 'Electronics' }));
      }
    }
  }, [categories]);

  // Initialize subcategories
  useEffect(() => {
    if (subcategories && subcategories.length > 0) {
      setLocalSubcategories(subcategories);
    }
  }, [subcategories]);

  // Auto-generate unique SKU & Barcode on mount if empty
  useEffect(() => {
    if (!formData.sku) {
      const randSku = `TS-${Math.floor(1000 + Math.random() * 9000)}`;
      const randBarcode = `890${Math.floor(100000000 + Math.random() * 900000000)}`;
      setFormData(prev => ({
        ...prev,
        sku: randSku,
        barcode: randBarcode
      }));
    }
  }, []);

  // Update matching subcategories
  const currentCategory = formData.category || localCategories[0]?.name || 'Clothing';
  const matchingSubcategories = localSubcategories.filter(s =>
    (s.categoryName || '').toLowerCase() === currentCategory.toLowerCase()
  );

  // Stop camera helper
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  // Start Camera
  const startCamera = async () => {
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error('Camera error:', err);
      alert('Could not access camera. Please check browser permissions.');
      setShowCamera(false);
    }
  };

  // Capture Photo from Camera
  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    setFormData(prev => {
      const newImages = [...prev.images, dataUrl];
      return {
        ...prev,
        images: newImages,
        image: prev.image || dataUrl
      };
    });

    stopCamera();
    setShowCamera(false);
  };

  // Handle Multi-file Upload
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setUploading(true);
    setUploadError('');

    const newImgs = [];
    let processed = 0;

    files.forEach(file => {
      if (!file.type.startsWith('image/')) {
        processed++;
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        newImgs.push(event.target.result);
        processed++;
        if (processed === files.length) {
          setFormData(prev => {
            const combined = [...prev.images, ...newImgs];
            return {
              ...prev,
              images: combined,
              image: prev.image || combined[0]
            };
          });
          setUploading(false);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // Preset demo images
  const presetImages = [
    { label: 'Hoodie', url: '/default-product.svg' },
    { label: 'Smartwatch', url: '/default-product.svg' },
    { label: 'Sneakers', url: '/default-product.svg' },
    { label: 'Perfume', url: '/default-product.svg' },
    { label: 'Headphones', url: '/default-product.svg' }
  ];

  // Set Primary Image
  const setPrimaryImage = (imgUrl) => {
    setFormData(prev => ({
      ...prev,
      image: imgUrl
    }));
  };

  // Remove Image from Gallery
  const removeImage = (indexToRemove) => {
    setFormData(prev => {
      const filtered = prev.images.filter((_, idx) => idx !== indexToRemove);
      const newPrimary = prev.image === prev.images[indexToRemove]
        ? (filtered[0] || '')
        : prev.image;
      return {
        ...prev,
        images: filtered,
        image: newPrimary
      };
    });
  };

  // Rich Text Editor Commands
  const executeEditorCommand = (command, value = null) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      setFormData(prev => ({ ...prev, description: editorRef.current.innerHTML }));
    }
  };

  // Insert Table Template in Description
  const insertTableTemplate = () => {
    const tableHtml = `
      <table style="width:100%; border-collapse:collapse; margin:12px 0;">
        <thead>
          <tr style="background:#f1f5f9; border-bottom:2px solid #cbd5e1;">
            <th style="padding:8px; text-align:left;">Specification</th>
            <th style="padding:8px; text-align:left;">Detail</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:6px 8px;">Material</td>
            <td style="padding:6px 8px;">Premium Alloy / Cotton</td>
          </tr>
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:6px 8px;">Origin</td>
            <td style="padding:6px 8px;">Imported</td>
          </tr>
        </tbody>
      </table>
    `;
    executeEditorCommand('insertHTML', tableHtml);
  };

  // Handle Inline Category or Subcategory Create
  const handleSaveTaxonomy = async (e) => {
    if (e) e.preventDefault();
    if (!newTaxName.trim()) return;

    setSavingTaxonomy(true);
    setTaxSuccessMsg('');
    try {
      if (taxonomyType === 'category') {
        const payload = {
          name: newTaxName.trim(),
          description: newTaxDesc.trim() || `${newTaxName.trim()} products and inventory`,
          color: '#3B82F6'
        };
        const res = await fetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const created = await res.json();
          setLocalCategories(prev => [created, ...prev]);
          if (onAddCategory) onAddCategory(payload);
          setFormData(prev => ({ ...prev, category: created.name, subCategory: '' }));
          setTaxSuccessMsg(`Primary category "${created.name}" created and selected!`);
          setTimeout(() => {
            setIsAddingTaxonomy(false);
            setNewTaxName('');
            setNewTaxDesc('');
            setTaxSuccessMsg('');
          }, 1000);
        } else {
          const err = await res.json().catch(() => ({}));
          alert(err.error || 'Failed to create category');
        }
      } else {
        const parentCat = localCategories.find(c => c.id === newTaxParentCatId || c.name.toLowerCase() === (formData.category || '').toLowerCase()) || localCategories[0];
        if (!parentCat) {
          alert('Please select a parent category');
          setSavingTaxonomy(false);
          return;
        }
        const payload = {
          categoryId: parentCat.id,
          categoryName: parentCat.name,
          name: newTaxName.trim(),
          description: newTaxDesc.trim() || `${newTaxName.trim()} in ${parentCat.name}`
        };
        const res = await fetch('/api/subcategories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const created = await res.json();
          setLocalSubcategories(prev => [created, ...prev]);
          if (onAddSubcategory) onAddSubcategory(payload);
          setFormData(prev => ({
            ...prev,
            category: parentCat.name,
            subCategory: created.name
          }));
          setTaxSuccessMsg(`Subcategory "${created.name}" created under ${parentCat.name}!`);
          setTimeout(() => {
            setIsAddingTaxonomy(false);
            setNewTaxName('');
            setNewTaxDesc('');
            setTaxSuccessMsg('');
          }, 1000);
        } else {
          const err = await res.json().catch(() => ({}));
          alert(err.error || 'Failed to create subcategory');
        }
      }
    } catch (err) {
      console.error(err);
      alert('Error connecting to server');
    } finally {
      setSavingTaxonomy(false);
    }
  };

  // Render Barcode in Step 4
  useEffect(() => {
    if (currentStep === 4 && barcodeSvgRef.current) {
      try {
        JsBarcode(barcodeSvgRef.current, formData.barcode || formData.sku || '123456789012', {
          format: 'CODE128',
          width: 1.8,
          height: 48,
          displayValue: true,
          fontSize: 12,
          font: 'monospace',
          margin: 6,
          background: '#ffffff',
          lineColor: '#000000'
        });
      } catch (err) {
        console.warn('Barcode render error in Step 4:', err);
      }
    }
  }, [currentStep, formData.barcode, formData.sku]);

  // Validation per step
  const validateStep = (step) => {
    const errs = {};
    if (step === 1) {
      if (!formData.name.trim()) errs.name = 'Product name is required';
      if (!formData.sku.trim()) errs.sku = 'SKU code is required';
      if (!formData.category) errs.category = 'Category is required';
    } else if (step === 2) {
      if (parseFloat(formData.price) < 0 || isNaN(formData.price)) errs.price = 'Valid selling price required';
      if (parseFloat(formData.costPrice) < 0 || isNaN(formData.costPrice)) errs.costPrice = 'Valid cost price required';
      if (parseInt(formData.stock) < 0 || isNaN(formData.stock)) errs.stock = 'Valid stock quantity required';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(totalSteps, prev + 1));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevStep = () => {
    setCurrentStep(prev => Math.max(1, prev - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Final Submit
  const handleFinalSubmit = async (shouldPrintBarcode = false) => {
    if (!validateStep(1) || !validateStep(2)) {
      alert('Please fill in required fields in Step 1 and Step 2');
      return;
    }

    setLoading(true);
    const finalImgs = formData.images && formData.images.length > 0
      ? formData.images
      : (formData.image ? [formData.image] : [presetImages[0].url]);

    const payload = {
      ...formData,
      image: formData.image || finalImgs[0],
      images: finalImgs,
      price: parseFloat(formData.price) || 0,
      costPrice: parseFloat(formData.costPrice) || 0,
      stock: parseInt(formData.stock) || 0,
      minStock: parseInt(formData.minStock) || 20
    };

    const saved = await onSaveProduct(payload);
    setLoading(false);

    if (shouldPrintBarcode && onOpenPrintBarcode && saved) {
      onOpenPrintBarcode(saved);
    } else {
      onBack();
    }
  };

  // Profit Margin Calculation
  const cost = parseFloat(formData.costPrice) || 0;
  const price = parseFloat(formData.price) || 0;
  const profit = price - cost;
  const profitMargin = price > 0 ? ((profit / price) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-200 pb-16">
      {/* Top Banner */}
      <div className="bg-white dark:bg-[#111827] p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start space-x-3.5">
          <button
            onClick={onBack}
            className="mt-0.5 p-2 rounded-xl bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-600 dark:text-slate-300 transition shadow-xs shrink-0 cursor-pointer"
            title="Back to Product Catalog"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center space-x-2.5">
              <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shrink-0">
                <Package className="w-5 h-5" />
              </span>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Add New Product Studio
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 pl-1">
              Multi-step product creator with multiple image gallery, rich HTML description, and instant barcode generation.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 shrink-0 w-full sm:w-auto">
          <button
            type="button"
            onClick={onBack}
            className="w-full sm:w-auto text-center px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-gray-700 transition cursor-pointer"
          >
            Cancel & Exit
          </button>
        </div>
      </div>

      {/* STEPPER PROGRESS INDICATOR */}
      <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-2xl p-3 sm:p-5 shadow-xs">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
          {[
            { step: 1, title: 'Step 1: General Info', desc: 'Name, SKU & Categories', icon: FileText },
            { step: 2, title: 'Step 2: Pricing & Stock', desc: 'Cost, Price, Inventory', icon: DollarSign },
            { step: 3, title: 'Step 3: Media & HTML', desc: 'Multi-image & Description', icon: ImageIcon },
            { step: 4, title: 'Step 4: Barcode & Publish', desc: 'Summary & Print Barcode', icon: BarcodeIcon }
          ].map((s) => {
            const Icon = s.icon;
            const isCompleted = currentStep > s.step;
            const isActive = currentStep === s.step;

            return (
              <button
                key={s.step}
                type="button"
                onClick={() => {
                  if (s.step < currentStep || validateStep(currentStep)) {
                    setCurrentStep(s.step);
                  }
                }}
                className={`p-2.5 sm:p-3 rounded-xl border text-left transition flex items-center space-x-2.5 sm:space-x-3 ${
                  isActive
                    ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 ring-2 ring-blue-500/20 shadow-xs'
                    : isCompleted
                    ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200'
                    : 'border-slate-200 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-800/40 text-slate-400'
                }`}
              >
                <div
                  className={`w-7 h-7 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 font-black text-xs ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                      : isCompleted
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 dark:bg-gray-700 text-slate-500'
                  }`}
                >
                  {isCompleted ? <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" /> : s.step}
                </div>
                <div className="min-w-0">
                  <p className={`text-[11px] sm:text-xs font-bold truncate ${isActive ? 'text-blue-900 dark:text-blue-200' : 'text-slate-800 dark:text-slate-200'}`}>
                    {s.title}
                  </p>
                  <p className="text-[9px] sm:text-[10px] text-slate-400 truncate">{s.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* FORM BODY CONTAINER */}
      <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 shadow-xs">
        {/* ===================================================
            STEP 1: GENERAL INFO & CATEGORIZATION
        =================================================== */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                Part 1: General Product Information & Categorization
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Enter product identification, SKU codes, categories, and manufacturing brand.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Product Name */}
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                  <span>Product Title / Name *</span>
                  <span className="text-[11px] text-slate-400 font-normal">e.g. Wireless Noise-Cancelling Headphones Pro</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter full product title..."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm bg-slate-50/50 dark:bg-gray-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden transition ${
                    errors.name ? 'border-rose-500' : 'border-slate-200 dark:border-gray-700'
                  }`}
                />
                {errors.name && <p className="text-xs text-rose-500">{errors.name}</p>}
              </div>

              {/* SKU & Auto Generator */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                  <span>SKU (Stock Keeping Unit) *</span>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, sku: `TS-${Math.floor(1000 + Math.random() * 9000)}` })}
                    className="text-[11px] text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Auto Generate
                  </button>
                </label>
                <input
                  type="text"
                  placeholder="TS-1001"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm font-mono bg-slate-50/50 dark:bg-gray-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden transition ${
                    errors.sku ? 'border-rose-500' : 'border-slate-200 dark:border-gray-700'
                  }`}
                />
                {errors.sku && <p className="text-xs text-rose-500">{errors.sku}</p>}
              </div>

              {/* Barcode Number & Auto Generator */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                  <span>Barcode (EAN-13 / Code 128)</span>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, barcode: `890${Math.floor(100000000 + Math.random() * 900000000)}` })}
                    className="text-[11px] text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1"
                  >
                    <BarcodeIcon className="w-3 h-3" />
                    Generate Barcode
                  </button>
                </label>
                <input
                  type="text"
                  placeholder="890123456789"
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-gray-700 text-sm font-mono bg-slate-50/50 dark:bg-gray-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden transition"
                />
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    Category *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setTaxonomyType('category');
                      setIsAddingTaxonomy(!isAddingTaxonomy);
                    }}
                    className="text-[11px] text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1"
                  >
                    <FolderPlus className="w-3 h-3" />
                    + New Category
                  </button>
                </div>

                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value, subCategory: '' })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-gray-700 text-sm bg-slate-50/50 dark:bg-gray-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  {localCategories.map(c => (
                    <option key={c.id || c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Subcategory */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    Subcategory
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setTaxonomyType('subcategory');
                      if (!newTaxParentCatId && localCategories.length > 0) {
                        const current = localCategories.find(c => c.name.toLowerCase() === (formData.category || '').toLowerCase()) || localCategories[0];
                        setNewTaxParentCatId(current.id);
                      }
                      setIsAddingTaxonomy(true);
                    }}
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1"
                  >
                    <Layers className="w-3 h-3" />
                    + New Subcategory
                  </button>
                </div>

                <select
                  value={formData.subCategory}
                  onChange={(e) => setFormData({ ...formData, subCategory: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-gray-700 text-sm bg-slate-50/50 dark:bg-gray-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="">None / General</option>
                  {matchingSubcategories.map(s => (
                    <option key={s.id || s.name} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Inline Taxonomy Creator Drawer (Primary Category vs Subcategory Switcher) */}
              {isAddingTaxonomy && (
                <div className="md:col-span-2 p-5 bg-gradient-to-br from-blue-50/80 to-indigo-50/40 dark:from-gray-900/90 dark:to-blue-950/40 rounded-2xl border border-blue-200/90 dark:border-blue-900/60 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                        Create New Category or Subcategory
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Choose whether to create a top-level parent category or a nested subcategory.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAddingTaxonomy(false)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Taxonomy Switcher Tabs */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setTaxonomyType('category')}
                      className={`p-3 rounded-xl border text-left transition flex items-start gap-3 ${
                        taxonomyType === 'category'
                          ? 'bg-white dark:bg-gray-800 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                          : 'bg-white/60 dark:bg-gray-800/50 border-slate-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800'
                      }`}
                    >
                      <span className={`p-2 rounded-lg shrink-0 ${taxonomyType === 'category' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-gray-700 text-slate-500'}`}>
                        <FolderPlus className="w-4 h-4" />
                      </span>
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">Primary Category</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Main department (e.g. Footwear, Electronics)</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setTaxonomyType('subcategory');
                        if (!newTaxParentCatId && localCategories.length > 0) {
                          const current = localCategories.find(c => c.name.toLowerCase() === (formData.category || '').toLowerCase()) || localCategories[0];
                          setNewTaxParentCatId(current.id);
                        }
                      }}
                      className={`p-3 rounded-xl border text-left transition flex items-start gap-3 ${
                        taxonomyType === 'subcategory'
                          ? 'bg-white dark:bg-gray-800 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                          : 'bg-white/60 dark:bg-gray-800/50 border-slate-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800'
                      }`}
                    >
                      <span className={`p-2 rounded-lg shrink-0 ${taxonomyType === 'subcategory' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-gray-700 text-slate-500'}`}>
                        <Layers className="w-4 h-4" />
                      </span>
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">Subcategory</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Nested child (e.g. Running Shoes, Sneakers)</p>
                      </div>
                    </button>
                  </div>

                  {/* Subcategory: Parent Category Dropdown */}
                  {taxonomyType === 'subcategory' && (
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Parent Primary Category *
                      </label>
                      <select
                        value={newTaxParentCatId}
                        onChange={(e) => setNewTaxParentCatId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-gray-700 text-xs bg-white dark:bg-gray-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500"
                      >
                        {localCategories.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Name Input */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {taxonomyType === 'category' ? 'Primary Category Name *' : 'Subcategory Name *'}
                    </label>
                    <input
                      type="text"
                      placeholder={taxonomyType === 'category' ? 'e.g. Footwear, Accessories, Electronics' : 'e.g. Running Shoes, Wireless Earbuds, Sneakers'}
                      value={newTaxName}
                      onChange={(e) => setNewTaxName(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-gray-700 text-xs bg-white dark:bg-gray-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>

                  {/* Description Input */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Description (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="Brief description for catalog..."
                      value={newTaxDesc}
                      onChange={(e) => setNewTaxDesc(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-gray-700 text-xs bg-white dark:bg-gray-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>

                  {/* Success Banner */}
                  {taxSuccessMsg && (
                    <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{taxSuccessMsg}</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex justify-end space-x-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingTaxonomy(false);
                        setNewTaxName('');
                        setNewTaxDesc('');
                      }}
                      className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveTaxonomy}
                      disabled={savingTaxonomy || !newTaxName.trim()}
                      className={`px-4 py-1.5 text-xs font-bold rounded-xl text-white shadow-sm transition flex items-center gap-1.5 disabled:opacity-50 ${
                        taxonomyType === 'category' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-indigo-600 hover:bg-indigo-700'
                      }`}
                    >
                      {savingTaxonomy ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <span>{taxonomyType === 'category' ? 'Save Primary Category' : 'Save Subcategory'}</span>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Brand */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Brand / Manufacturer
                </label>
                <input
                  type="text"
                  placeholder="e.g. Apple, Nike, Sony, Samsung"
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-gray-700 text-sm bg-slate-50/50 dark:bg-gray-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Unit of Measure */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Unit of Measure
                </label>
                <select
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-gray-700 text-sm bg-slate-50/50 dark:bg-gray-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="Pcs">Pieces (Pcs)</option>
                  <option value="Box">Box</option>
                  <option value="Kg">Kilogram (Kg)</option>
                  <option value="Set">Set</option>
                  <option value="Pack">Pack / Bundle</option>
                  <option value="Liter">Liter (L)</option>
                  <option value="Meter">Meter (m)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================
            STEP 2: PRICING & INVENTORY TRACKING
        =================================================== */}
        {currentStep === 2 && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                Part 2: Pricing, Cost & Stock Management
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Set cost price, selling price, profit margin, opening stock, and warehouse rack location.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Cost Price */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Cost / Purchase Price ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.costPrice}
                  onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-gray-700 text-sm font-semibold bg-slate-50/50 dark:bg-gray-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Selling Price */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Selling / Retail Price ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-gray-700 text-sm font-bold text-emerald-600 dark:text-emerald-400 bg-slate-50/50 dark:bg-gray-900/50 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Profit Margin Preview Card */}
              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl flex flex-col justify-between">
                <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                  Profit Margin Calculation
                </span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-lg font-black text-emerald-700 dark:text-emerald-300">
                    +${profit.toFixed(2)}
                  </span>
                  <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                    {profitMargin}% Margin
                  </span>
                </div>
              </div>

              {/* Initial Stock */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Initial Stock Quantity ({formData.unit}) *
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-gray-700 text-sm font-semibold bg-slate-50/50 dark:bg-gray-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Min Stock Alert */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Low Stock Threshold Alert
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.minStock}
                  onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-gray-700 text-sm bg-slate-50/50 dark:bg-gray-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Warehouse Location */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Warehouse Location / Rack
                </label>
                <input
                  type="text"
                  placeholder="Aisle 2, Rack C, Bin 4"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-gray-700 text-sm bg-slate-50/50 dark:bg-gray-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Inventory Status */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Product Availability Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-gray-700 text-sm bg-slate-50/50 dark:bg-gray-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="In Stock">In Stock</option>
                  <option value="Low Stock">Low Stock Alert</option>
                  <option value="Out of Stock">Out of Stock</option>
                  <option value="Pre-Order">Pre-Order</option>
                </select>
              </div>

              {/* Supplier Reference */}
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Primary Supplier / Vendor
                </label>
                <input
                  type="text"
                  placeholder="e.g. Apex Global Logistics / TechCorp Supply"
                  value={formData.supplierName}
                  onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-gray-700 text-sm bg-slate-50/50 dark:bg-gray-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>
        )}

        {/* ===================================================
            STEP 3: MEDIA GALLERY & RICH HTML DESCRIPTION
        =================================================== */}
        {currentStep === 3 && (
          <div className="space-y-8 animate-in fade-in duration-150">
            {/* MULTI-IMAGE UPLOADER SECTION */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-purple-600" />
                    Part 3A: Product Images Gallery
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Upload multiple high-resolution photos, capture camera images, or select catalog presets.
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={startCamera}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-gray-700 hover:bg-slate-200 dark:hover:bg-gray-600 text-slate-700 dark:text-slate-200 transition"
                  >
                    <Camera className="w-3.5 h-3.5 text-blue-600" />
                    <span>Take Photo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Images</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Camera Live Modal Stream */}
              {showCamera && (
                <div className="p-4 bg-slate-900 rounded-2xl border border-slate-700 space-y-3">
                  <div className="flex items-center justify-between text-white text-xs font-bold">
                    <span>Optical Camera Capture</span>
                    <button type="button" onClick={() => { stopCamera(); setShowCamera(false); }}>
                      ✕ Close
                    </button>
                  </div>
                  <div className="relative aspect-video max-h-[300px] overflow-hidden rounded-xl bg-black">
                    <video ref={videoRef} className="w-full h-full object-cover" />
                  </div>
                  <button
                    type="button"
                    onClick={capturePhoto}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    Capture & Add to Gallery
                  </button>
                </div>
              )}

              {/* Image Gallery Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {formData.images.map((imgUrl, idx) => {
                  const isPrimary = formData.image === imgUrl || (!formData.image && idx === 0);
                  return (
                    <div
                      key={idx}
                      className={`relative group rounded-2xl overflow-hidden border transition aspect-square bg-slate-100 dark:bg-gray-900 ${
                        isPrimary
                          ? 'border-blue-600 ring-2 ring-blue-500/30'
                          : 'border-slate-200 dark:border-gray-700'
                      }`}
                    >
                      <img src={imgUrl} alt={`Upload ${idx}`} className="w-full h-full object-cover" />

                      {/* Primary Cover Badge */}
                      {isPrimary && (
                        <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-md text-[9px] font-black bg-blue-600 text-white shadow-xs">
                          PRIMARY
                        </span>
                      )}

                      {/* Action Overlay */}
                      <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                        {!isPrimary && (
                          <button
                            type="button"
                            onClick={() => setPrimaryImage(imgUrl)}
                            title="Set as Cover"
                            className="p-1.5 rounded-lg bg-white/90 text-blue-600 hover:bg-white transition"
                          >
                            <Star className="w-3.5 h-3.5 fill-current" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeImage(idx)}
                          title="Delete image"
                          className="p-1.5 rounded-lg bg-white/90 text-rose-600 hover:bg-white transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Upload Placeholder Tile */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 dark:border-gray-700 hover:border-blue-500 rounded-2xl aspect-square flex flex-col items-center justify-center p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50/20 dark:hover:bg-blue-950/20 transition cursor-pointer"
                >
                  <Plus className="w-6 h-6 mb-1" />
                  <span className="text-[11px] font-semibold">Add Image</span>
                </button>
              </div>

              {/* Preset Sample Images Bar */}
              <div className="flex items-center space-x-2 pt-1 overflow-x-auto text-xs">
                <span className="text-slate-400 shrink-0 font-medium">Quick Presets:</span>
                {presetImages.map((preset, pidx) => (
                  <button
                    key={pidx}
                    type="button"
                    onClick={() => {
                      setFormData(prev => {
                        const newImgs = [...prev.images, preset.url];
                        return {
                          ...prev,
                          images: newImgs,
                          image: prev.image || preset.url
                        };
                      });
                    }}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 text-slate-600 dark:text-slate-300 hover:border-blue-500 shrink-0"
                  >
                    + {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* RICH HTML PRODUCT DESCRIPTION SECTION */}
            <div className="space-y-3 pt-6 border-t border-slate-100 dark:border-gray-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    Part 3B: Product Description (HTML Allowed)
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Write formatted descriptions with bold, lists, tables, or raw HTML markup.
                  </p>
                </div>

                {/* Editor Mode Tabs */}
                <div className="flex items-center p-1 bg-slate-100 dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => setEditorMode('visual')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      editorMode === 'visual'
                        ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Visual Editor
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditorMode('code')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      editorMode === 'code'
                        ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <Code className="w-3.5 h-3.5" />
                    HTML Source
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditorMode('preview')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      editorMode === 'preview'
                        ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Live Preview
                  </button>
                </div>
              </div>

              {/* Editor Workspace */}
              <div className="border border-slate-200 dark:border-gray-700 rounded-2xl overflow-hidden bg-white dark:bg-gray-900">
                {/* Visual Editor Toolbar */}
                {editorMode === 'visual' && (
                  <div className="p-2 border-b border-slate-200 dark:border-gray-800 bg-slate-50/70 dark:bg-gray-800/50 flex flex-wrap items-center gap-1 text-slate-700 dark:text-slate-300">
                    <button
                      type="button"
                      onClick={() => executeEditorCommand('bold')}
                      className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-gray-700 transition"
                      title="Bold (Ctrl+B)"
                    >
                      <Bold className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => executeEditorCommand('italic')}
                      className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-gray-700 transition"
                      title="Italic (Ctrl+I)"
                    >
                      <Italic className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => executeEditorCommand('underline')}
                      className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-gray-700 transition"
                      title="Underline"
                    >
                      <Underline className="w-4 h-4" />
                    </button>
                    <span className="w-px h-5 bg-slate-300 dark:bg-gray-700 mx-1" />

                    <button
                      type="button"
                      onClick={() => executeEditorCommand('formatBlock', '<h2>')}
                      className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-gray-700 transition"
                      title="Heading 2"
                    >
                      <Heading2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => executeEditorCommand('formatBlock', '<h3>')}
                      className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-gray-700 transition"
                      title="Heading 3"
                    >
                      <Heading3 className="w-4 h-4" />
                    </button>
                    <span className="w-px h-5 bg-slate-300 dark:bg-gray-700 mx-1" />

                    <button
                      type="button"
                      onClick={() => executeEditorCommand('insertUnorderedList')}
                      className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-gray-700 transition"
                      title="Bulleted List"
                    >
                      <List className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => executeEditorCommand('insertOrderedList')}
                      className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-gray-700 transition"
                      title="Numbered List"
                    >
                      <ListOrdered className="w-4 h-4" />
                    </button>
                    <span className="w-px h-5 bg-slate-300 dark:bg-gray-700 mx-1" />

                    <button
                      type="button"
                      onClick={insertTableTemplate}
                      className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-gray-700 transition flex items-center gap-1 text-xs font-semibold"
                      title="Insert Specs Table"
                    >
                      <TableIcon className="w-4 h-4" />
                      <span>Insert Table</span>
                    </button>
                  </div>
                )}

                {/* Content Area Based on Mode */}
                {editorMode === 'visual' && (
                  <div
                    ref={editorRef}
                    contentEditable
                    dangerouslySetInnerHTML={{ __html: formData.description }}
                    onBlur={(e) => setFormData({ ...formData, description: e.currentTarget.innerHTML })}
                    className="p-4 min-h-[220px] max-h-[360px] overflow-y-auto focus:outline-hidden prose prose-sm dark:prose-invert max-w-none text-slate-800 dark:text-slate-200"
                  />
                )}

                {editorMode === 'code' && (
                  <textarea
                    rows="10"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="<p>Enter raw HTML tags here...</p>"
                    className="w-full p-4 font-mono text-xs bg-slate-900 text-emerald-400 focus:outline-hidden resize-y min-h-[220px]"
                  />
                )}

                {editorMode === 'preview' && (
                  <div className="p-5 bg-slate-50 dark:bg-gray-950 min-h-[220px]">
                    <div
                      dangerouslySetInnerHTML={{ __html: formData.description || '<p class="text-slate-400 italic">No description provided.</p>' }}
                      className="prose prose-sm dark:prose-invert max-w-none text-slate-800 dark:text-slate-200"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===================================================
            STEP 4: SUMMARY REVIEW & BARCODE PRINT
        =================================================== */}
        {currentStep === 4 && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Part 4: Product Verification & Barcode Preview
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Review the product summary and verify generated barcode before publishing to catalog.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Product Summary Card */}
              <div className="lg:col-span-7 bg-slate-50 dark:bg-gray-900/60 rounded-2xl p-5 border border-slate-200 dark:border-gray-800 space-y-4">
                <div className="flex items-start space-x-4">
                  <div className="w-24 h-24 rounded-2xl bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 overflow-hidden shrink-0">
                    <img
                      src={formData.image || formData.images[0] || presetImages[0].url}
                      alt="Product Cover"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                        {formData.category}
                      </span>
                      {formData.subCategory && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200 dark:bg-gray-800 text-slate-600 dark:text-slate-300">
                          {formData.subCategory}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                        {formData.status}
                      </span>
                    </div>

                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white mt-1.5 truncate">
                      {formData.name || 'Untitled Product'}
                    </h3>

                    <p className="text-xs text-slate-400 mt-0.5">
                      SKU: <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">{formData.sku}</span>
                      {formData.brand && ` • Brand: ${formData.brand}`}
                    </p>
                  </div>
                </div>

                {/* Key Numbers Grid */}
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-slate-200/80 dark:border-gray-700">
                    <p className="text-[10px] text-slate-400 font-medium">Selling Price</p>
                    <p className="text-base font-black text-emerald-600 dark:text-emerald-400">${parseFloat(formData.price || 0).toFixed(2)}</p>
                  </div>
                  <div className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-slate-200/80 dark:border-gray-700">
                    <p className="text-[10px] text-slate-400 font-medium">Stock Inventory</p>
                    <p className="text-base font-black text-slate-800 dark:text-slate-100">{formData.stock} {formData.unit}</p>
                  </div>
                  <div className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-slate-200/80 dark:border-gray-700">
                    <p className="text-[10px] text-slate-400 font-medium">Profit Margin</p>
                    <p className="text-base font-black text-blue-600 dark:text-blue-400">+{profitMargin}%</p>
                  </div>
                </div>

                {/* Description Preview */}
                <div className="pt-2 border-t border-slate-200/60 dark:border-gray-800">
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Description Preview:</p>
                  <div
                    dangerouslySetInnerHTML={{ __html: formData.description }}
                    className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 prose prose-xs dark:prose-invert"
                  />
                </div>
              </div>

              {/* Right Column: Barcode Preview & Direct Print Trigger */}
              <div className="lg:col-span-5 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl p-5 flex flex-col justify-between items-center text-center space-y-4">
                <div className="w-full">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1.5 mb-2">
                    <BarcodeIcon className="w-4 h-4 text-blue-600" />
                    Generated Barcode Label
                  </span>

                  {/* Rendered SVG Barcode */}
                  <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col items-center justify-center my-2">
                    <p className="text-[9px] font-black uppercase text-slate-500 tracking-wider">TIWLO INVENTORY</p>
                    <p className="text-xs font-bold text-black truncate max-w-[200px]">{formData.name}</p>
                    <svg ref={barcodeSvgRef} className="max-w-[220px] w-full my-1" />
                    <p className="text-sm font-black text-black">${parseFloat(formData.price || 0).toFixed(2)}</p>
                  </div>

                  <p className="text-[11px] text-slate-400 mt-2">
                    Optical code ready for laser scanning and batch sticker printing.
                  </p>
                </div>

                <div className="w-full pt-3 border-t border-slate-100 dark:border-gray-800 space-y-2">
                  <button
                    type="button"
                    onClick={() => handleFinalSubmit(true)}
                    className="w-full py-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/60 font-bold text-xs flex items-center justify-center gap-2 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Save & Open Barcode Print Studio</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEPPER NAVIGATION BUTTONS (FOOTER) */}
        <div className="flex items-center justify-between pt-6 mt-6 border-t border-slate-100 dark:border-gray-800">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={handlePrevStep}
                className="px-5 py-2.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-gray-700 transition"
              >
                ← Back (Previous Part)
              </button>
            )}
          </div>

          <div className="flex items-center space-x-3">
            {currentStep < totalSteps ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="flex items-center space-x-2 px-6 py-2.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25 transition active:scale-98"
              >
                <span>Proceed to Step {currentStep + 1}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleFinalSubmit(false)}
                disabled={loading}
                className="flex items-center space-x-2 px-7 py-2.5 text-xs font-bold rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/25 transition active:scale-98 disabled:opacity-50"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>{loading ? 'Publishing Product...' : 'Publish Product to Catalog'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
