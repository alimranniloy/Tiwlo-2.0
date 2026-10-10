import { applicationFetch as fetch } from '../api/graphqlTransport.js';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  Search,
  Bell,
  ChevronDown,
  ShoppingCart,
  Package,
  Users,
  LayoutGrid,
  Star,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Smartphone,
  MoreHorizontal,
  ShieldCheck,
  Printer,
  Sparkles,
  X,
  RotateCcw,
  Tag,
  Laptop,
  Shirt,
  Home,
  Coffee,
  Headphones,
  Sliders,
  Layers,
  Check,
  ScanLine,
  UserPlus,
  UserCheck,
  FileText,
  Download,
  Barcode,
  Volume2,
  VolumeX,
  MapPin,
  Phone,
  Mail,
  Zap,
  CheckCircle,
  Copy,
  Briefcase,
  Building2,
  Truck,
  Globe,
  Award,
  AlertCircle,
  User,
  ChevronRight
} from 'lucide-react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

export default function POSView({
  onBack,
  products = [],
  categories = [],
  customers = [],
  suppliers = [],
  onAddCustomer,
  onRecordSale,
  onRefreshData
}) {
  // View Modes: 'cashier' | 'invoice' (NO MODAL POPUPS!)
  const [posViewMode, setPosViewMode] = useState('cashier');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Products');
  const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash' | 'card' | 'upi' | 'more'
  const [discountInput, setDiscountInput] = useState('');
  const [discountApplied, setDiscountApplied] = useState(0);
  const [discountType, setDiscountType] = useState('percent'); // 'percent' or 'fixed'
  const [isCompletingSale, setIsCompletingSale] = useState(false);
  const [completedSale, setCompletedSale] = useState(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Customer Management State
  const [selectedCustomer, setSelectedCustomer] = useState(null); // null = Walk-in Customer
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [isLiveSearchOpen, setIsLiveSearchOpen] = useState(false);
  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState(false);
  const [customerFormErrors, setCustomerFormErrors] = useState({});
  const [newCustomerForm, setNewCustomerForm] = useState({
    name: '',
    customerType: 'Retail', // 'Retail' | 'Wholesale' | 'Corporate' | 'Supplier' | 'Distributor'
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    country: 'United States',
    taxId: '',
    paymentTerms: 'Immediate',
    creditLimit: '',
    notes: ''
  });
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const customerDropdownRef = useRef(null);

  // Barcode Scanner State
  const [scannerInput, setScannerInput] = useState('');
  const [scannerLaserActive, setScannerLaserActive] = useState(false);
  const [scannerBeepEnabled, setScannerBeepEnabled] = useState(true);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');

  const searchInputRef = useRef(null);
  const scannerInputRef = useRef(null);
  const receiptBarcodeRef = useRef(null);

  const sessionId = useRef(`POS-${Math.floor(1000 + Math.random() * 9000)}`).current;
  const cashierName = (() => {
    try {
      const saved = localStorage.getItem('tiwlo_user');
      const u = saved ? JSON.parse(saved) : null;
      return u?.storeName || u?.name || 'Tiwlo Cashier';
    } catch (e) {
      return 'Tiwlo Cashier';
    }
  })();

  // Cart starts empty initially as requested
  const [cart, setCart] = useState([]);

  // Web Audio API POS Chime
  const playScannerBeep = (isSuccess = true) => {
    if (!scannerBeepEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      if (isSuccess) {
        osc.frequency.setValueAtTime(920, ctx.currentTime);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } else {
        osc.frequency.setValueAtTime(320, ctx.currentTime);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
        osc.start();
        osc.stop(ctx.currentTime + 0.18);
      }
    } catch (e) {}
  };

  // Hardware USB/Bluetooth Barcode Scanner Listener
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleGlobalKeyDown = (e) => {
      // Don't intercept if typing in standard input fields (except search/scanner)
      const tag = e.target.tagName?.toLowerCase();
      if (tag === 'textarea' || (tag === 'input' && e.target !== searchInputRef.current && e.target !== scannerInputRef.current)) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      const now = Date.now();
      const char = e.key;

      if (now - lastKeyTime > 120) {
        buffer = '';
      }
      lastKeyTime = now;

      if (char === 'Enter') {
        if (buffer.trim().length >= 3) {
          e.preventDefault();
          handleBarcodeScan(buffer.trim());
          buffer = '';
        }
      } else if (char.length === 1) {
        buffer += char;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [products]);

  // Close live customer dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target)) {
        setIsLiveSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Close new customer modal on ESC key
  useEffect(() => {
    const handleEscKey = (e) => {
      if (e.key === 'Escape' && isNewCustomerModalOpen) {
        setIsNewCustomerModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleEscKey);
    return () => window.removeEventListener('keydown', handleEscKey);
  }, [isNewCustomerModalOpen]);

  // Multi-Classification Customer & Entity System
  const CUSTOMER_TYPES = [
    {
      id: 'Retail',
      label: 'Retail Customer (B2C)',
      short: 'Retail',
      description: 'Individual shopper / counter consumer',
      icon: User,
      color: 'blue',
      badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-200 dark:border-blue-800',
      activeRing: 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
    },
    {
      id: 'Wholesale',
      label: 'Wholesale Client (B2B)',
      short: 'Wholesale',
      description: 'Bulk purchase client with trade discounts',
      icon: Briefcase,
      color: 'purple',
      badgeClass: 'bg-purple-100 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300 border border-purple-200 dark:border-purple-800',
      activeRing: 'border-purple-500 bg-purple-50/70 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300'
    },
    {
      id: 'Corporate',
      label: 'Corporate / Enterprise',
      short: 'Corporate',
      description: 'Company account with tax invoicing & credit terms',
      icon: Building2,
      color: 'emerald',
      badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
      activeRing: 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
    },
    {
      id: 'Supplier',
      label: 'Supplier / Vendor',
      short: 'Supplier',
      description: 'Inventory vendor, manufacturer or procurement partner',
      icon: Truck,
      color: 'amber',
      badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
      activeRing: 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
    },
    {
      id: 'Distributor',
      label: 'Distributor / Agent',
      short: 'Distributor',
      description: 'Regional dealer, reseller or channel agent',
      icon: Globe,
      color: 'cyan',
      badgeClass: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/70 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800',
      activeRing: 'border-cyan-500 bg-cyan-50/70 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300'
    }
  ];

  const getCustomerTypeMeta = (type) => {
    return (
      CUSTOMER_TYPES.find((t) => t.id.toLowerCase() === (type || '').toLowerCase()) || {
        id: type || 'Retail',
        label: type || 'Retail',
        short: type || 'Retail',
        description: 'Standard account',
        icon: User,
        color: 'blue',
        badgeClass: 'bg-slate-100 text-slate-700 dark:bg-gray-800 dark:text-slate-300 border border-slate-200',
        activeRing: 'border-blue-500 bg-blue-50/70 text-blue-700'
      }
    );
  };

  // Generate Barcode & QR Code when completedSale is active in Invoice View
  useEffect(() => {
    if (completedSale && posViewMode === 'invoice') {
      if (receiptBarcodeRef.current) {
        try {
          JsBarcode(receiptBarcodeRef.current, completedSale.invoiceNumber || 'INV-10001', {
            format: 'CODE128',
            width: 1.8,
            height: 48,
            displayValue: true,
            fontSize: 12,
            font: 'monospace',
            margin: 4
          });
        } catch (err) {
          console.warn('Barcode render error in invoice:', err);
        }
      }

      QRCode.toDataURL(
        `TIWLO-POS-VERIFIED|INV:${completedSale.invoiceNumber}|TOTAL:$${completedSale.totalAmount}|DATE:${completedSale.date}|CUSTOMER:${completedSale.customer?.name || 'Walk-in'}`,
        { width: 90, margin: 1 }
      )
        .then((url) => setQrCodeDataUrl(url))
        .catch(() => {});
    }
  }, [completedSale, posViewMode]);

  const showNotification = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2500);
  };

  // Fixed list of categories matching screenshot
  const categoryChips = useMemo(() => {
    const base = [
      { id: 'All Products', name: 'All Products', count: products.length || 128, icon: LayoutGrid },
      { id: 'Electronics', name: 'Electronics', count: products.filter(p => p.category?.toLowerCase() === 'electronics').length || 24, icon: Laptop },
      { id: 'Clothing', name: 'Clothing', count: products.filter(p => p.category?.toLowerCase() === 'clothing').length || 18, icon: Shirt },
      { id: 'Home & Living', name: 'Home & Living', count: products.filter(p => p.category?.toLowerCase() === 'home & living').length || 16, icon: Home },
      { id: 'Food & Beverage', name: 'Food & Beverage', count: products.filter(p => p.category?.toLowerCase() === 'food & beverage').length || 32, icon: Coffee },
      { id: 'Accessories', name: 'Accessories', count: products.filter(p => p.category?.toLowerCase() === 'accessories').length || 14, icon: Headphones },
      { id: 'Others', name: 'Others', count: products.filter(p => !['electronics', 'clothing', 'home & living', 'food & beverage', 'accessories'].includes(p.category?.toLowerCase())).length || 6, icon: MoreHorizontal }
    ];
    return base;
  }, [products]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat =
        selectedCategory === 'All Products' ||
        (p.category && p.category.toLowerCase() === selectedCategory.toLowerCase());

      const matchSearch =
        !searchQuery.trim() ||
        (p.name && p.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.barcode && p.barcode.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchCat && matchSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // Unified list of customers + suppliers with classification
  const unifiedCustomerList = useMemo(() => {
    const custs = customers.map(c => ({
      ...c,
      customerType: c.customerType || 'Retail',
      contactPerson: c.contactPerson || '',
      taxId: c.taxId || '',
      country: c.country || '',
      paymentTerms: c.paymentTerms || 'Immediate',
      creditLimit: c.creditLimit || 0
    }));

    // Also include suppliers so cashiers can sell/transact with suppliers if needed
    const sups = suppliers.map(s => ({
      id: s.id,
      name: s.companyName || s.contactPerson || 'Supplier Account',
      contactPerson: s.contactPerson || '',
      phone: s.phone || '',
      email: s.email || '',
      address: s.address || '',
      city: s.city || '',
      country: s.country || '',
      customerType: 'Supplier',
      taxId: s.taxId || '',
      paymentTerms: s.paymentTerms || 'Immediate',
      totalOrders: s.totalPurchases || 0,
      totalSpent: s.totalAmount || 0,
      isSupplier: true
    }));

    return [...custs, ...sups];
  }, [customers, suppliers]);

  // Filtered customer search
  const filteredCustomers = useMemo(() => {
    if (!customerSearchQuery.trim()) return unifiedCustomerList;
    const q = customerSearchQuery.toLowerCase().trim();
    return unifiedCustomerList.filter(
      c =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.phone && c.phone.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.address && c.address.toLowerCase().includes(q)) ||
        (c.city && c.city.toLowerCase().includes(q)) ||
        (c.contactPerson && c.contactPerson.toLowerCase().includes(q)) ||
        (c.taxId && c.taxId.toLowerCase().includes(q)) ||
        (c.customerType && c.customerType.toLowerCase().includes(q))
    );
  }, [unifiedCustomerList, customerSearchQuery]);

  // Cart Calculations
  const subtotal = useMemo(() => {
    return parseFloat(cart.reduce((acc, item) => acc + (parseFloat(item.price) || 0) * item.quantity, 0).toFixed(2));
  }, [cart]);

  const discountAmount = useMemo(() => {
    if (discountType === 'percent') {
      return parseFloat(((subtotal * discountApplied) / 100).toFixed(2));
    }
    return parseFloat(Math.min(subtotal, discountApplied).toFixed(2));
  }, [subtotal, discountApplied, discountType]);

  const tax = useMemo(() => {
    // 5% Standard POS Tax with safe 2-decimal precision
    const taxableAmount = Math.max(0, subtotal - discountAmount);
    return parseFloat((taxableAmount * 0.05).toFixed(2));
  }, [subtotal, discountAmount]);

  const grandTotal = useMemo(() => {
    return parseFloat(Math.max(0, subtotal - discountAmount + tax).toFixed(2));
  }, [subtotal, discountAmount, tax]);

  // Cart operations
  const addToCart = (product) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === product.id);
      if (existingIndex > -1) {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: next[existingIndex].quantity + 1
        };
        return next;
      }
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          category: product.category || 'General',
          sku: product.sku || 'SKU-000',
          barcode: product.barcode || '',
          price: parseFloat(product.price) || 0,
          quantity: 1,
          image: product.image || '/default-product.svg'
        }
      ];
    });
    showNotification(`Added ${product.name} to cart`);
  };

  const updateQuantity = (id, delta) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.id === id) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean);
    });
  };

  const removeFromCart = (id) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
    setDiscountApplied(0);
    setDiscountInput('');
  };

  // Barcode Zap Handler
  const handleBarcodeScan = (code) => {
    if (!code || !code.trim()) return;
    const cleanCode = code.trim().toLowerCase();

    const matched = products.find(
      p =>
        (p.barcode && p.barcode.toLowerCase() === cleanCode) ||
        (p.sku && p.sku.toLowerCase() === cleanCode) ||
        (p.id && p.id.toLowerCase() === cleanCode)
    );

    if (matched) {
      playScannerBeep(true);
      setScannerLaserActive(true);
      setTimeout(() => setScannerLaserActive(false), 500);
      addToCart(matched);
      showNotification(`✓ Scanned: ${matched.name} added to sale!`);
      setScannerInput('');
    } else {
      playScannerBeep(false);
      showNotification(`❌ Unrecognized barcode / SKU: "${code}"`);
    }
  };

  const handleApplyDiscount = () => {
    const val = parseFloat(discountInput);
    if (!isNaN(val) && val >= 0) {
      if (discountType === 'percent') {
        const capped = Math.min(100, val);
        setDiscountApplied(capped);
        showNotification(`${capped}% discount applied`);
      } else {
        const capped = Math.min(subtotal, val);
        setDiscountApplied(capped);
        showNotification(`Fixed discount of $${capped.toFixed(2)} applied`);
      }
    } else {
      setDiscountApplied(0);
      showNotification('Discount cleared');
    }
  };

  // Create new customer handler with validation & required field checks
  const handleCreateNewCustomer = async (e) => {
    if (e) e.preventDefault();
    const errors = {};
    if (!newCustomerForm.name.trim()) {
      errors.name = 'Customer / Company name is required';
    }
    if (!newCustomerForm.phone.trim()) {
      errors.phone = 'Phone number is required';
    }
    if (!newCustomerForm.address.trim()) {
      errors.address = 'Street address is required';
    }

    if (Object.keys(errors).length > 0) {
      setCustomerFormErrors(errors);
      showNotification('Please fill in all required fields marked with *');
      return;
    }

    setCustomerFormErrors({});

    try {
      setIsSavingCustomer(true);
      let created = null;

      // Persist to backend /api/customers
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCustomerForm)
      });
      if (res.ok) {
        created = await res.json();
      }

      // Also trigger onAddCustomer callback to update parent state if provided
      if (onAddCustomer) {
        await onAddCustomer(newCustomerForm);
      }

      const fullCustomer = {
        ...(created || { id: `cust-${Date.now()}` }),
        ...newCustomerForm,
        customerType: newCustomerForm.customerType || 'Retail'
      };

      setSelectedCustomer(fullCustomer);
      setIsNewCustomerModalOpen(false);
      setIsLiveSearchOpen(false);
      setCustomerSearchQuery('');
      setNewCustomerForm({
        name: '',
        customerType: 'Retail',
        contactPerson: '',
        phone: '',
        email: '',
        address: '',
        city: '',
        country: 'United States',
        taxId: '',
        paymentTerms: 'Immediate',
        creditLimit: '',
        notes: ''
      });
      showNotification(`✓ ${fullCustomer.customerType} account "${fullCustomer.name}" registered & selected!`);
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error(err);
      showNotification('Failed to create customer');
    } finally {
      setIsSavingCustomer(false);
    }
  };

  // Checkout & Sale Completion
  const handleCompleteSale = async () => {
    if (cart.length === 0) return;
    setIsCompletingSale(true);

    const salePayload = {
      customerId: selectedCustomer?.id || '',
      customerName: selectedCustomer?.name || 'Walk-in Customer',
      customerType: selectedCustomer?.customerType || 'Retail',
      customerPhone: selectedCustomer?.phone || '',
      customerAddress: selectedCustomer?.address || '',
      items: cart.map(item => ({
        productId: item.id,
        productName: item.name,
        sku: item.sku || 'SKU-000',
        quantity: item.quantity,
        unitPrice: item.price
      })),
      subtotal,
      discount: discountAmount,
      tax,
      totalAmount: grandTotal,
      paymentMethod: paymentMethod.toUpperCase(),
      sessionId,
      cashier: cashierName
    };

    let result = null;
    if (onRecordSale) {
      result = await onRecordSale(salePayload);
    } else {
      try {
        const res = await fetch('/api/sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(salePayload)
        });
        if (res.ok) result = await res.json();
      } catch (err) {
        console.error(err);
      }
    }

    setIsCompletingSale(false);

    const invoiceData = {
      id: result?.id || `inv-${Date.now()}`,
      invoiceNumber: result?.invoiceNumber || `INV-${Math.floor(10000 + Math.random() * 90000)}`,
      date: result?.date || new Date().toISOString(),
      customer: {
        id: selectedCustomer?.id || null,
        name: selectedCustomer?.name || 'Walk-in Customer',
        customerType: selectedCustomer?.customerType || 'Counter Sale',
        contactPerson: selectedCustomer?.contactPerson || '',
        phone: selectedCustomer?.phone || 'N/A',
        email: selectedCustomer?.email || 'N/A',
        address: selectedCustomer?.address || 'Over The Counter',
        city: selectedCustomer?.city || 'Local',
        country: selectedCustomer?.country || 'Global',
        taxId: selectedCustomer?.taxId || '',
        paymentTerms: selectedCustomer?.paymentTerms || 'Immediate'
      },
      items: [...cart],
      subtotal,
      discount: discountAmount,
      tax,
      totalAmount: grandTotal,
      paymentMethod: paymentMethod.toUpperCase(),
      cashier: cashierName,
      sessionId
    };

    setCompletedSale(invoiceData);
    setPosViewMode('invoice'); // Switch to dedicated Invoice View (NO POPUP MODAL!)
    if (onRefreshData) onRefreshData();
  };

  const handleCloseInvoiceAndNewSale = () => {
    clearCart();
    setSelectedCustomer(null);
    setCompletedSale(null);
    setPosViewMode('cashier');
  };

  const handlePrintInvoice = () => {
    window.print();
  };

  const handleDownloadReceipt = () => {
    if (!completedSale) return;
    const dateFormatted = new Date(completedSale.date).toLocaleString();

    let text = `========================================================\n`;
    text += `               TIWLO RETAIL ENTERPRISE                 \n`;
    text += `         102 Business Avenue, Suite 500                \n`;
    text += `       Phone: +1 (800) 555-0199 • Tax: TIW-8934        \n`;
    text += `========================================================\n\n`;
    text += `Invoice Number : ${completedSale.invoiceNumber}\n`;
    text += `Date & Time    : ${dateFormatted}\n`;
    text += `Cashier        : ${completedSale.cashier}\n`;
    text += `Register / POS : ${completedSale.sessionId}\n\n`;
    text += `BILLED TO:\n`;
    text += `Customer Name  : ${completedSale.customer.name} (${completedSale.customer.customerType || 'Retail'})\n`;
    text += `Phone Number   : ${completedSale.customer.phone}\n`;
    text += `Address        : ${completedSale.customer.address}\n\n`;
    text += `--------------------------------------------------------\n`;
    text += `ITEM DESCRIPTION               QTY   UNIT     TOTAL     \n`;
    text += `--------------------------------------------------------\n`;

    completedSale.items.forEach((item) => {
      const name = (item.name || item.productName).padEnd(28).slice(0, 28);
      const qty = String(item.quantity).padStart(4);
      const unit = `$${parseFloat(item.price || item.unitPrice).toFixed(2)}`.padStart(8);
      const total = `$${((parseFloat(item.price || item.unitPrice) || 0) * item.quantity).toFixed(2)}`.padStart(10);
      text += `${name} ${qty} ${unit} ${total}\n`;
    });

    text += `--------------------------------------------------------\n`;
    text += `Subtotal                         : $${parseFloat(completedSale.subtotal).toFixed(2)}\n`;
    if (completedSale.discount > 0) {
      text += `Discount                         : -$${parseFloat(completedSale.discount).toFixed(2)}\n`;
    }
    text += `Tax (5%)                         : $${parseFloat(completedSale.tax).toFixed(2)}\n`;
    text += `========================================================\n`;
    text += `GRAND TOTAL                      : $${parseFloat(completedSale.totalAmount).toFixed(2)}\n`;
    text += `Payment Method                   : ${completedSale.paymentMethod} (PAID)\n`;
    text += `========================================================\n\n`;
    text += `Terms & Conditions:\n`;
    text += `1. Goods once sold can be returned or exchanged within 7 days.\n`;
    text += `2. Keep this invoice slip for any warranty or exchange requests.\n\n`;
    text += `       *** THANK YOU FOR SHOPPING WITH TIWLO! ***       \n`;

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Invoice-${completedSale.invoiceNumber}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    showNotification(`Receipt downloaded for ${completedSale.invoiceNumber}`);
  };

  // =========================================================
  // VIEW MODE: DEDICATED FULL INVOICE SCREEN (NO POPUP MODALS!)
  // =========================================================
  if (posViewMode === 'invoice' && completedSale) {
    return (
      <div className="min-h-screen bg-[#F1F5F9] dark:bg-[#0B0F17] flex flex-col font-sans antialiased text-slate-800 dark:text-slate-100">
        <style>{`
          @media print {
            body * { visibility: hidden !important; }
            #printable-invoice, #printable-invoice * { visibility: visible !important; }
            #printable-invoice {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 24px !important;
              box-shadow: none !important;
              border: none !important;
            }
            .no-print { display: none !important; }
          }
        `}</style>

        {/* Top Invoice Actions Bar */}
        <header className="h-auto min-h-16 py-2.5 px-3 sm:px-8 bg-white dark:bg-[#111827] border-b border-slate-200 dark:border-gray-800 sticky top-0 z-30 flex flex-wrap items-center justify-between gap-2.5 no-print shadow-xs">
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Close cross button returning to clean POS session as requested */}
            <button
              onClick={handleCloseInvoiceAndNewSale}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-gray-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition shadow-2xs cursor-pointer"
              title="Close and Start New Sale"
            >
              <X className="w-4 h-4 text-rose-500" />
              <span>Close & New Sale</span>
            </button>

            <div className="h-5 w-px bg-slate-200 dark:bg-gray-700 hidden sm:block"></div>

            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-black text-slate-900 dark:text-white">
                  Retail Tax Invoice
                </span>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                  {completedSale.invoiceNumber}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Saved in database • Cashier: {completedSale.cashier} • Register: {completedSale.sessionId}
              </p>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownloadReceipt}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 text-xs font-bold transition shadow-xs cursor-pointer"
              title="Download text receipt slip"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download Slip</span>
            </button>

            <button
              onClick={handlePrintInvoice}
              className="flex items-center space-x-1.5 px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-md shadow-blue-500/25 cursor-pointer"
              title="Print Receipt via Printer or Save as PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Invoice</span>
            </button>
          </div>
        </header>

        {/* Dedicated Full Invoice Document Sheet */}
        <main className="flex-1 py-4 sm:py-8 px-2.5 sm:px-6 flex justify-center overflow-y-auto">
          <div
            id="printable-invoice"
            className="w-full max-w-3xl bg-white dark:bg-gray-900 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-gray-800 shadow-xl p-4 sm:p-8 md:p-10 space-y-6"
          >
            {/* Store & Header Information */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-slate-200 dark:border-gray-800">
              <div className="space-y-1">
                <div className="flex items-center space-x-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                    <Layers className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <div>
                    <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight leading-none">
                      TIWLO RETAIL ENTERPRISE
                    </h1>
                    <p className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold tracking-wide">
                      Point of Sale • Inventory System
                    </p>
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 pt-2">
                  102 Business Avenue, Suite 500 • New York, NY 10001
                </p>
                <p className="text-xs text-slate-400">
                  Phone: +1 (800) 555-0199 • Tax ID: TIW-8934-2026
                </p>
              </div>

              <div className="text-left sm:text-right space-y-1">
                <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  PAID IN FULL
                </span>
                <p className="text-xs font-bold text-slate-900 dark:text-white pt-1">
                  Invoice #{completedSale.invoiceNumber}
                </p>
                <p className="text-[11px] text-slate-500 font-mono">
                  {new Date(completedSale.date).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Billed To (Customer Details) & Transaction Meta */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50 dark:bg-gray-800/60 p-5 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 text-xs">
              <div className="space-y-1.5">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                    BILLED TO:
                  </span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                    {completedSale.customer.customerType || 'Retail Customer'}
                  </span>
                </div>
                <p className="text-sm font-black text-slate-900 dark:text-white">
                  {completedSale.customer.name}
                </p>
                <div className="space-y-0.5 text-slate-600 dark:text-slate-300">
                  <p className="flex items-center gap-1.5">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span>{completedSale.customer.phone || 'N/A'}</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    <span>{completedSale.customer.address || 'Over the counter'}</span>
                  </p>
                  {completedSale.customer.email && completedSale.customer.email !== 'N/A' && (
                    <p className="flex items-center gap-1.5">
                      <Mail className="w-3 h-3 text-slate-400" />
                      <span>{completedSale.customer.email}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5 sm:text-right">
                <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                  PAYMENT & REGISTER DETAILS:
                </span>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Payment Method:{' '}
                  <span className="text-blue-600 font-mono font-bold">
                    {completedSale.paymentMethod}
                  </span>
                </p>
                <p className="text-xs text-slate-500">Cashier: {completedSale.cashier}</p>
                <p className="text-xs text-slate-500 font-mono">Register: {completedSale.sessionId}</p>
                <p className="text-xs text-emerald-600 font-semibold">Payment Status: Settled & Confirmed</p>
              </div>
            </div>

            {/* Itemized Products Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b-2 border-slate-200 dark:border-gray-700 text-slate-400 font-bold uppercase text-[10px]">
                    <th className="py-2.5">#</th>
                    <th className="py-2.5">Item Description</th>
                    <th className="py-2.5">Category</th>
                    <th className="py-2.5 text-center">Qty</th>
                    <th className="py-2.5 text-right">Unit Price</th>
                    <th className="py-2.5 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                  {completedSale.items.map((it, idx) => {
                    const price = parseFloat(it.price || it.unitPrice) || 0;
                    const lineTotal = price * it.quantity;

                    return (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-gray-800/40">
                        <td className="py-3 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-3">
                          <span className="font-bold text-slate-900 dark:text-white block">
                            {it.name || it.productName}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">{it.sku || 'SKU-000'}</span>
                        </td>
                        <td className="py-3 text-slate-500">{it.category || 'General'}</td>
                        <td className="py-3 text-center font-bold font-mono text-slate-800 dark:text-white">
                          {it.quantity}
                        </td>
                        <td className="py-3 text-right font-mono text-slate-600 dark:text-slate-300">
                          $ {price.toFixed(2)}
                        </td>
                        <td className="py-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                          $ {lineTotal.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Financial Summary */}
            <div className="flex flex-col sm:flex-row justify-between items-start pt-4 border-t border-slate-200 dark:border-gray-800 gap-6">
              {/* Barcode & QR Code */}
              <div className="space-y-2 flex flex-col items-start">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Verification Code & Barcode:
                </span>
                <div className="flex items-center gap-3">
                  <svg ref={receiptBarcodeRef} className="max-w-[220px] h-12 bg-white p-1 rounded-lg border border-slate-200"></svg>
                  {qrCodeDataUrl && (
                    <img
                      src={qrCodeDataUrl}
                      alt="Verification QR Code"
                      className="w-12 h-12 rounded-lg border border-slate-200 bg-white p-0.5"
                    />
                  )}
                </div>
              </div>

              {/* Totals Table */}
              <div className="w-full sm:w-64 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Subtotal</span>
                  <span className="font-mono font-semibold">$ {parseFloat(completedSale.subtotal).toFixed(2)}</span>
                </div>
                {completedSale.discount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Discount</span>
                    <span className="font-mono">- $ {parseFloat(completedSale.discount).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Tax (5%)</span>
                  <span className="font-mono font-semibold">$ {parseFloat(completedSale.tax).toFixed(2)}</span>
                </div>
                <div className="pt-2 border-t-2 border-slate-900 dark:border-white flex justify-between items-center">
                  <span className="text-sm font-black text-slate-900 dark:text-white uppercase">
                    Grand Total
                  </span>
                  <span className="text-xl font-black text-blue-600 dark:text-blue-400 font-mono">
                    $ {parseFloat(completedSale.totalAmount).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Terms and Return Policy */}
            <div className="pt-6 border-t border-slate-100 dark:border-gray-800 text-center space-y-1 text-[11px] text-slate-400">
              <p className="font-medium text-slate-600 dark:text-slate-300">
                Terms: Goods once sold can be exchanged within 7 days with this original receipt.
              </p>
              <p>Thank you for shopping with Tiwlo Retail Enterprise!</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // =========================================================
  // VIEW MODE: ACTIVE CASHIER POS WORKSTATION
  // =========================================================
  return (
    <div className="min-h-screen bg-[#F6F8FB] dark:bg-[#0B0F17] font-sans antialiased text-slate-800 dark:text-slate-100 flex flex-col relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-18 right-6 z-50 bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-4 py-2.5 rounded-2xl shadow-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-150">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Laser Scan Red Beam Animation Effect across screen */}
      {scannerLaserActive && (
        <div className="fixed inset-x-0 top-0 h-1 bg-red-500 shadow-[0_0_15px_rgba(239,68,68,1)] z-50 animate-pulse pointer-events-none transition-all"></div>
      )}

      {/* =========================================================
          1. TOP BAR HEADER (Slim & Ergonomic)
      ========================================================= */}
      <header className="h-auto min-h-14 py-2 px-3 sm:px-6 bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md border-b border-[#EDF2F7] dark:border-gray-800 sticky top-0 z-30 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 sm:gap-3">
        {/* Left: Back button + Brand */}
        <div className="flex items-center space-x-2.5 sm:space-x-3 shrink-0">
          <button
            onClick={onBack}
            className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition shadow-xs cursor-pointer"
            title="Back to Main Dashboard"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Back</span>
          </button>

          {/* Logo */}
          <div className="flex items-center space-x-2 pl-0.5 sm:pl-1">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
              <Layers className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-xs font-black text-slate-900 dark:text-white tracking-tight leading-none">
                POS System
              </h1>
              <p className="text-[9px] text-slate-400 font-medium tracking-wide mt-0.5">
                Sell • Manage • Grow
              </p>
            </div>
          </div>
        </div>

        {/* Center: Search Bar (Full width on mobile below header row) */}
        <div className="order-3 sm:order-2 w-full sm:flex-1 sm:max-w-xl sm:mx-2">
          <div className="flex items-center bg-slate-50 dark:bg-gray-800 border border-slate-200/90 dark:border-gray-700 rounded-full px-3.5 py-1.5 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition shadow-2xs">
            <Search className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search products, barcode, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-bold text-slate-400 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-md font-mono shadow-2xs shrink-0 ml-1">
              Ctrl + K
            </kbd>
          </div>
        </div>

        {/* Right: Hardware Scanner Status & Profile */}
        <div className="order-2 sm:order-3 flex items-center space-x-2 shrink-0">
          <div
            className="flex items-center space-x-1.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 px-2 sm:px-2.5 py-1 rounded-full border border-emerald-200/80 text-[10px] font-bold"
            title="Hardware Barcode Scanner is listening"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="hidden md:inline">Scanner:</span>
            <span>Online</span>
          </div>

          <button
            onClick={() => setScannerBeepEnabled(!scannerBeepEnabled)}
            className="w-8 h-8 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-50 cursor-pointer shadow-2xs"
            title={scannerBeepEnabled ? 'Mute scanner chime' : 'Enable scanner chime'}
          >
            {scannerBeepEnabled ? <Volume2 className="w-3.5 h-3.5 text-blue-600" /> : <VolumeX className="w-3.5 h-3.5 text-slate-400" />}
          </button>

          <button
            className="w-8 h-8 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-50 cursor-pointer relative shadow-2xs"
            title="Notifications"
          >
            <Bell className="w-3.5 h-3.5" />
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center ring-2 ring-white dark:ring-gray-900">
              3
            </span>
          </button>

          {/* Cashier Profile */}
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center space-x-1.5 sm:space-x-2 p-1 rounded-xl hover:bg-slate-50 dark:hover:bg-gray-800 transition border border-transparent hover:border-slate-200 dark:border-gray-700 cursor-pointer"
            >
              <img
                src="/default-avatar.svg"
                alt="Profile"
                className="w-6 h-6 rounded-full object-cover ring-1 ring-slate-200 dark:ring-gray-700"
              />
              <div className="text-left hidden sm:block">
                <p className="text-xs font-bold text-slate-800 dark:text-white leading-none">
                  {cashierName}
                </p>
                <p className="text-[9px] font-medium text-slate-400 mt-0.5">Admin</p>
              </div>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-2xl shadow-xl py-2 z-40 animate-in fade-in duration-100 text-xs">
                <div className="px-3 py-1.5 border-b border-slate-100 dark:border-gray-700 text-slate-500 text-[11px]">
                  Register: <span className="font-mono font-bold text-blue-600">{sessionId}</span>
                </div>
                <button
                  onClick={onBack}
                  className="w-full text-left px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-gray-700 cursor-pointer"
                >
                  Exit POS to Dashboard
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* =========================================================
          2. DEDICATED CUSTOMER & QUICK-BAR SUB-SECTION (Directly Below Header across the page)
      ========================================================= */}
      <section className="bg-white/95 dark:bg-[#111827]/95 border-b border-slate-200/90 dark:border-gray-800 px-3 sm:px-6 py-2 shadow-xs sticky top-[92px] sm:top-14 z-20 backdrop-blur-md">
        <div className="max-w-[1720px] mx-auto flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Left & Middle: Active Customer Card + Live Customer Search + +New Customer Button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 min-w-0">
            {/* Active Customer Summary Box */}
            <div className="flex items-center space-x-2.5 bg-slate-50 dark:bg-gray-800/90 border border-slate-200/80 dark:border-gray-700/80 rounded-2xl px-3 py-1.5 min-w-[230px] max-w-xs shadow-2xs">
              <div
                className={`w-8 h-8 rounded-xl font-bold text-xs flex items-center justify-center shrink-0 shadow-xs ${
                  selectedCustomer
                    ? selectedCustomer.customerType === 'Wholesale'
                      ? 'bg-purple-600 text-white'
                      : selectedCustomer.customerType === 'Corporate'
                      ? 'bg-emerald-600 text-white'
                      : selectedCustomer.customerType === 'Supplier'
                      ? 'bg-amber-600 text-white'
                      : selectedCustomer.customerType === 'Distributor'
                      ? 'bg-cyan-600 text-white'
                      : 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-white'
                }`}
              >
                {selectedCustomer ? (selectedCustomer.name ? selectedCustomer.name[0].toUpperCase() : 'C') : 'W'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {selectedCustomer ? selectedCustomer.name : 'Walk-in Customer'}
                  </span>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase shrink-0 ${
                      selectedCustomer
                        ? getCustomerTypeMeta(selectedCustomer.customerType).badgeClass
                        : 'bg-slate-100 text-slate-600 dark:bg-gray-700 dark:text-slate-300'
                    }`}
                  >
                    {selectedCustomer ? getCustomerTypeMeta(selectedCustomer.customerType).short : 'Counter'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 truncate">
                  {selectedCustomer
                    ? `${selectedCustomer.phone || 'No Phone'} • ${selectedCustomer.address || selectedCustomer.city || 'Counter'}`
                    : 'Direct Counter Retail Buyer'}
                </p>
              </div>
              {selectedCustomer && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCustomer(null);
                    showNotification('Reset to Walk-in Customer');
                  }}
                  className="text-[11px] font-bold text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 p-1 rounded-lg transition cursor-pointer"
                  title="Reset to Walk-in Customer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* LIVE CUSTOMER SEARCH INPUT WITH FLOATING DROPDOWN */}
            <div className="relative flex-1 max-w-md sm:max-w-lg" ref={customerDropdownRef}>
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search customer, company, phone, supplier..."
                  value={customerSearchQuery}
                  onChange={(e) => {
                    setCustomerSearchQuery(e.target.value);
                    setIsLiveSearchOpen(true);
                  }}
                  onFocus={() => setIsLiveSearchOpen(true)}
                  className="w-full pl-9 pr-8 py-2 text-xs font-medium rounded-xl bg-slate-50 dark:bg-gray-800/90 border border-slate-200/80 dark:border-gray-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-2xs"
                />
                {customerSearchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerSearchQuery('');
                      setIsLiveSearchOpen(false);
                    }}
                    className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* LIVE FLOATING SEARCH RESULTS DROPDOWN */}
              {isLiveSearchOpen && (
                <div className="absolute left-0 right-0 sm:w-[520px] top-full mt-2 z-50 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  {/* Dropdown Header */}
                  <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-gray-800/70 border-b border-slate-100 dark:border-gray-800 flex items-center justify-between">
                    <div className="flex items-center space-x-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                      <Users className="w-3.5 h-3.5 text-blue-600" />
                      <span>Live Directory Results ({filteredCustomers.length})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsLiveSearchOpen(false);
                        setNewCustomerForm((prev) => ({
                          ...prev,
                          name: customerSearchQuery.trim()
                        }));
                        setIsNewCustomerModalOpen(true);
                      }}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center space-x-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Register New</span>
                    </button>
                  </div>

                  {/* Dropdown List */}
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-gray-800 p-1">
                    {/* Walk-in Customer Option */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCustomer(null);
                        setIsLiveSearchOpen(false);
                        showNotification('Selected: Walk-in Customer (General Counter)');
                      }}
                      className={`w-full p-2.5 rounded-xl text-left transition flex items-center justify-between cursor-pointer ${
                        !selectedCustomer
                          ? 'bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800'
                          : 'hover:bg-slate-50 dark:hover:bg-gray-800/50'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-gray-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center shrink-0">
                          W
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <p className="text-xs font-bold text-slate-900 dark:text-white">Walk-in Customer</p>
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-slate-300">
                              DEFAULT B2C
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400">General Counter Sales • No Account Link</p>
                        </div>
                      </div>
                      {!selectedCustomer && (
                        <Check className="w-4 h-4 text-blue-600 shrink-0" />
                      )}
                    </button>

                    {/* Filtered Matches */}
                    {filteredCustomers.length > 0 ? (
                      filteredCustomers.map((c) => {
                        const typeMeta = getCustomerTypeMeta(c.customerType);
                        const isSelected = selectedCustomer?.id === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setSelectedCustomer(c);
                              setIsLiveSearchOpen(false);
                              showNotification(`✓ Linked ${c.customerType || 'Customer'}: ${c.name}`);
                            }}
                            className={`w-full p-2.5 rounded-xl text-left transition flex items-center justify-between cursor-pointer ${
                              isSelected
                                ? 'bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800'
                                : 'hover:bg-slate-50 dark:hover:bg-gray-800/50'
                            }`}
                          >
                            <div className="flex items-center space-x-2.5 min-w-0 flex-1 pr-2">
                              <div
                                className={`w-8 h-8 rounded-xl font-bold text-xs flex items-center justify-center shrink-0 ${
                                  c.customerType === 'Wholesale'
                                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                                    : c.customerType === 'Corporate'
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                    : c.customerType === 'Supplier'
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                    : c.customerType === 'Distributor'
                                    ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300'
                                    : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                                }`}
                              >
                                {c.name ? c.name[0].toUpperCase() : 'C'}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center space-x-1.5">
                                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                    {c.name}
                                  </p>
                                  <span
                                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase shrink-0 ${typeMeta.badgeClass}`}
                                  >
                                    {typeMeta.short}
                                  </span>
                                  {c.contactPerson && (
                                    <span className="text-[10px] text-slate-400 truncate hidden sm:inline">
                                      ({c.contactPerson})
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center space-x-2 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                                  <span>{c.phone || 'No phone'}</span>
                                  <span>•</span>
                                  <span className="truncate">
                                    {c.address || c.city || 'No address registered'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="text-right shrink-0 flex items-center space-x-2">
                              {c.totalSpent > 0 && (
                                <div className="text-[10px] font-mono text-slate-400 hidden sm:block">
                                  <p className="font-semibold text-slate-700 dark:text-slate-300">
                                    ${parseFloat(c.totalSpent).toFixed(2)}
                                  </p>
                                  <p className="text-[9px]">{c.totalOrders || 0} orders</p>
                                </div>
                              )}
                              {isSelected ? (
                                <Check className="w-4 h-4 text-blue-600" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                              )}
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      <div className="p-4 text-center space-y-2">
                        <AlertCircle className="w-6 h-6 text-slate-400 mx-auto" />
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          No matching customer or supplier found
                        </p>
                        <p className="text-[10px] text-slate-400">
                          No records matched "{customerSearchQuery}". Would you like to create a new profile?
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setIsLiveSearchOpen(false);
                            setNewCustomerForm((prev) => ({
                              ...prev,
                              name: customerSearchQuery.trim()
                            }));
                            setIsNewCustomerModalOpen(true);
                          }}
                          className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition cursor-pointer shadow-xs inline-flex items-center space-x-1.5"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Register "{customerSearchQuery.trim()}"</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Dropdown Footer */}
                  <div className="px-3.5 py-1.5 bg-slate-50/60 dark:bg-gray-800/40 border-t border-slate-100 dark:border-gray-800 text-[10px] text-slate-400 flex items-center justify-between">
                    <span>Click any profile to link live to this sale</span>
                    <button
                      type="button"
                      onClick={() => setIsLiveSearchOpen(false)}
                      className="text-slate-400 hover:text-slate-600 font-medium cursor-pointer"
                    >
                      Close (Esc)
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* + New Customer Registration Button (Opens Dedicated Modal Popup) */}
            <button
              type="button"
              onClick={() => {
                setIsLiveSearchOpen(false);
                setIsNewCustomerModalOpen(true);
              }}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-xs shadow-blue-500/25 transition cursor-pointer shrink-0"
              title="Register a new retail customer, wholesale client, supplier or company"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ New Customer</span>
            </button>
          </div>

          {/* Right: Quick Barcode Zap Station & Test Chips */}
          <div className="flex items-center space-x-2 shrink-0">
            <div className="flex items-center space-x-1.5 bg-slate-50 dark:bg-gray-800 border border-slate-200/80 dark:border-gray-700 rounded-xl px-2.5 py-1">
              <ScanLine className="w-3.5 h-3.5 text-blue-600" />
              <input
                ref={scannerInputRef}
                type="text"
                placeholder="Scan Barcode / SKU..."
                value={scannerInput}
                onChange={(e) => setScannerInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleBarcodeScan(scannerInput);
                  }
                }}
                className="w-36 sm:w-44 bg-transparent text-xs font-mono text-slate-800 dark:text-white placeholder-slate-400 focus:outline-hidden"
              />
              <button
                onClick={() => handleBarcodeScan(scannerInput)}
                className="px-2 py-0.5 rounded-lg bg-blue-600 text-white text-[10px] font-bold hover:bg-blue-700 transition cursor-pointer"
              >
                Zap
              </button>
            </div>

            <div className="hidden xl:flex items-center space-x-1 text-xs">
              <span className="text-[10px] text-slate-400 font-semibold pr-1">Test:</span>
              {[
                { code: '890123401101', sku: 'ACC-EAR-01' },
                { code: '890123401102', sku: 'ELE-LAP-02' },
                { code: '890123401103', sku: 'CLO-HOD-03' }
              ].map((t) => (
                <button
                  key={t.code}
                  onClick={() => handleBarcodeScan(t.code)}
                  className="px-1.5 py-0.5 bg-slate-100 dark:bg-gray-800 hover:bg-blue-50 hover:text-blue-600 rounded text-[9px] font-mono font-semibold border border-slate-200 cursor-pointer"
                >
                  {t.sku}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          3. MAIN BODY: 2-COLUMN VIEW (Left Catalog, Right Sticky Cart)
          Notice: "Ready to make a sale?" hero banner has been completely removed as requested!
      ========================================================= */}
      <main className="flex-1 p-3 sm:p-5 max-w-[1720px] mx-auto w-full flex flex-col lg:flex-row gap-5 items-start">
        {/* LEFT COLUMN: CATEGORIES + POPULAR PRODUCTS */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* CATEGORIES ROW */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <LayoutGrid className="w-3.5 h-3.5 text-blue-600" />
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Categories</h3>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setSelectedCategory('All Products')}
                  className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  View All
                </button>
                <div className="flex items-center space-x-1">
                  <button className="w-5 h-5 rounded-full bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 flex items-center justify-center text-slate-500 hover:bg-slate-50 text-[10px] cursor-pointer">
                    ‹
                  </button>
                  <button className="w-5 h-5 rounded-full bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 flex items-center justify-center text-slate-500 hover:bg-slate-50 text-[10px] cursor-pointer">
                    ›
                  </button>
                </div>
              </div>
            </div>

            {/* Category Chips Container */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-1.5 sm:gap-2">
              {categoryChips.map((cat) => {
                const Icon = cat.icon;
                const isSelected = selectedCategory.toLowerCase() === cat.id.toLowerCase();

                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`p-2 sm:p-2.5 rounded-xl border text-center transition-all duration-150 flex flex-col items-center justify-center cursor-pointer ${
                      isSelected
                        ? 'bg-white dark:bg-gray-800 border-blue-500 ring-2 ring-blue-500/20 shadow-sm shadow-blue-500/10'
                        : 'bg-white dark:bg-gray-800/80 border-slate-200/80 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700/60 shadow-2xs'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center mb-1 transition ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                    <span
                      className={`text-[11px] sm:text-xs font-bold truncate max-w-full ${
                        isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {cat.name}
                    </span>
                    <span className="text-[9px] text-slate-400 font-medium">
                      {cat.count} items
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* POPULAR PRODUCTS GRID */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Popular Products</h3>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                Showing {filteredProducts.length} items
              </span>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center border border-slate-200 dark:border-gray-700 space-y-2">
                <Package className="w-10 h-10 text-slate-300 mx-auto" />
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  No matching products found
                </h4>
                <p className="text-[11px] text-slate-400">
                  Try adjusting your search query or selecting a different category.
                </p>
                <button
                  onClick={() => {
                    setSelectedCategory('All Products');
                    setSearchQuery('');
                  }}
                  className="px-3 py-1 rounded-lg bg-blue-600 text-white text-[11px] font-bold hover:bg-blue-700 cursor-pointer"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-6 gap-2.5 sm:gap-3">
                {filteredProducts.map((prod) => {
                  const isOutOfStock = prod.stock === 0;
                  const isLowStock = prod.stock > 0 && prod.stock <= (prod.minStock || 20);

                  return (
                    <div
                      key={prod.id}
                      className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200/80 dark:border-gray-700/80 p-2.5 flex flex-col justify-between hover:shadow-md hover:border-blue-300 transition-all duration-200 group relative shadow-2xs"
                    >
                      {/* Top Badges */}
                      {prod.badge && (
                        <div className="absolute top-2 right-2 z-10">
                          {prod.badge === 'Hot' ? (
                            <span className="bg-gradient-to-r from-rose-500 to-amber-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-2xs">
                              Hot
                            </span>
                          ) : (
                            <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-2xs">
                              Best Seller
                            </span>
                          )}
                        </div>
                      )}

                      {/* Product Thumbnail */}
                      <div className="w-full h-24 sm:h-26 rounded-lg bg-slate-50 dark:bg-gray-900/60 flex items-center justify-center overflow-hidden mb-2 relative">
                        <img
                          src={prod.image || '/default-product.svg'}
                          alt={prod.name}
                          className="w-full h-full object-contain p-1.5 group-hover:scale-105 transition-transform duration-200"
                        />
                      </div>

                      {/* Info */}
                      <div className="space-y-0.5 mb-2">
                        <h4
                          className="text-[11px] sm:text-xs font-bold text-slate-900 dark:text-white truncate"
                          title={prod.name}
                        >
                          {prod.name}
                        </h4>
                        <div className="flex items-center justify-between text-[9px] text-slate-400">
                          <span className="truncate">{prod.category}</span>
                          <span className="font-mono">{prod.sku}</span>
                        </div>
                        <div className="pt-0.5 flex items-center justify-between">
                          <span className="text-xs font-black text-slate-900 dark:text-white">
                            $ {parseFloat(prod.price || 0).toFixed(2)}
                          </span>
                          {/* Stock Status Indicator */}
                          <div className="flex items-center space-x-1">
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isOutOfStock
                                  ? 'bg-rose-500'
                                  : isLowStock
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                            ></span>
                            <span
                              className={`text-[9px] font-semibold ${
                                isOutOfStock
                                  ? 'text-rose-500'
                                  : isLowStock
                                  ? 'text-amber-500'
                                  : 'text-emerald-600 dark:text-emerald-400'
                              }`}
                            >
                              {isOutOfStock ? 'Out' : isLowStock ? 'Low Stock' : 'In Stock'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Add to Cart Button */}
                      <button
                        onClick={() => addToCart(prod)}
                        disabled={isOutOfStock}
                        className={`w-full py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center space-x-1.5 transition cursor-pointer ${
                          isOutOfStock
                            ? 'bg-slate-100 dark:bg-gray-700 text-slate-400 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95 shadow-xs shadow-blue-500/20'
                        }`}
                      >
                        <ShoppingCart className="w-3 h-3" />
                        <span>Add to Cart</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* =========================================================
            RIGHT COLUMN: STICKY "CURRENT SALE" CART & CHECKOUT
        ========================================================= */}
        <div id="pos-checkout-section" className="w-full lg:w-[360px] xl:w-[390px] shrink-0 lg:sticky lg:top-[116px] lg:self-start lg:max-h-[calc(100vh-132px)] flex flex-col">
          <div className="bg-white dark:bg-gray-800 rounded-3xl border border-slate-200/90 dark:border-gray-700/80 shadow-[0_4px_24px_rgba(0,0,0,0.03)] p-4 flex flex-col max-h-[calc(100vh-132px)] space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-gray-700 shrink-0">
              <div className="flex items-center space-x-2">
                <ShoppingCart className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">
                  Current Sale
                </h3>
                {cart.length > 0 && (
                  <span className="bg-blue-50 text-blue-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {cart.reduce((s, i) => s + i.quantity, 0)} items
                  </span>
                )}
              </div>
              <button
                onClick={clearCart}
                disabled={cart.length === 0}
                className="text-[11px] font-semibold text-slate-400 hover:text-rose-500 transition px-2 py-0.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                Clear All
              </button>
            </div>

            {/* Cart Items List */}
            <div className="space-y-2 flex-1 overflow-y-auto min-h-[140px] max-h-[260px] pr-1">
              {cart.length === 0 ? (
                <div className="h-full min-h-[140px] flex flex-col items-center justify-center text-center space-y-1.5 py-8">
                  <div className="w-11 h-11 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-500 flex items-center justify-center">
                    <ShoppingCart className="w-5 h-5 stroke-[1.5]" />
                  </div>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    Your cart is empty
                  </p>
                  <p className="text-[10px] text-slate-400 max-w-[200px] leading-relaxed">
                    Zap a barcode or click "Add to Cart" to add items to this sale.
                  </p>
                </div>
              ) : (
                cart.map((item) => {
                  const itemTotal = (parseFloat(item.price) || 0) * item.quantity;

                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-gray-700/60 last:border-0"
                    >
                      {/* Left: Thumbnail & Name */}
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-8 h-8 rounded-lg object-contain bg-slate-50 dark:bg-gray-900 border border-slate-200/60 dark:border-gray-700 p-0.5 shrink-0"
                        />
                        <div className="space-y-0.5 min-w-0">
                          <h4 className="text-[11px] font-bold text-slate-800 dark:text-white truncate max-w-[110px]">
                            {item.name}
                          </h4>
                          <p className="text-[9px] text-slate-400 truncate">{item.category}</p>
                          <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                            $ {parseFloat(item.price).toFixed(2)}
                          </p>
                        </div>
                      </div>

                      {/* Middle: Stepper */}
                      <div className="flex items-center space-x-1 bg-slate-50 dark:bg-gray-700/60 rounded-lg px-1.5 py-0.5 border border-slate-200/60 dark:border-gray-600 shrink-0">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="text-slate-500 hover:text-slate-900 dark:hover:text-white text-[11px] font-bold px-1 cursor-pointer"
                        >
                          -
                        </button>
                        <span className="text-[11px] font-bold text-slate-900 dark:text-white min-w-[14px] text-center font-mono">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          className="text-slate-500 hover:text-slate-900 dark:hover:text-white text-[11px] font-bold px-1 cursor-pointer"
                        >
                          +
                        </button>
                      </div>

                      {/* Right: Item Total & Delete */}
                      <div className="flex items-center space-x-2 shrink-0">
                        <span className="text-[11px] font-black text-slate-900 dark:text-white font-mono">
                          $ {itemTotal.toFixed(2)}
                        </span>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-slate-300 hover:text-rose-500 transition p-0.5 cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* =========================================================
                ADVANCED REFINED DISCOUNT CONTROLLER (Upgraded)
            ========================================================= */}
            <div className="bg-slate-50 dark:bg-gray-900/60 rounded-2xl p-2.5 border border-slate-200/80 dark:border-gray-700/80 space-y-2 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <Tag className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                    Discount & Coupon
                  </span>
                </div>
                {/* Toggle % vs $ */}
                <div className="flex items-center bg-slate-200/80 dark:bg-gray-700 p-0.5 rounded-lg text-[9px] font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      setDiscountType('percent');
                      if (discountInput) {
                        const val = parseFloat(discountInput);
                        if (!isNaN(val)) setDiscountApplied(val);
                      }
                    }}
                    className={`px-1.5 py-0.5 rounded-md transition cursor-pointer ${
                      discountType === 'percent'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                    }`}
                  >
                    % Percent
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDiscountType('fixed');
                      if (discountInput) {
                        const val = parseFloat(discountInput);
                        if (!isNaN(val)) setDiscountApplied(val);
                      }
                    }}
                    className={`px-1.5 py-0.5 rounded-md transition cursor-pointer ${
                      discountType === 'fixed'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                    }`}
                  >
                    $ Fixed
                  </button>
                </div>
              </div>

              {/* Quick Preset Discount Chips */}
              <div className="flex items-center gap-1">
                {[5, 10, 15, 20, 25].map((pct) => {
                  const isActive = discountType === 'percent' && discountApplied === pct;
                  return (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => {
                        setDiscountType('percent');
                        setDiscountInput(String(pct));
                        setDiscountApplied(pct);
                        showNotification(`${pct}% discount applied!`);
                      }}
                      className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition border cursor-pointer ${
                        isActive
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700 text-slate-700 dark:text-slate-300 hover:border-blue-400'
                      }`}
                    >
                      {pct}%
                    </button>
                  );
                })}
              </div>

              {/* Custom Input + Apply + Clear */}
              <div className="flex items-center space-x-1.5">
                <div className="relative flex-1">
                  <input
                    type="number"
                    min="0"
                    max={discountType === 'percent' ? 100 : subtotal}
                    placeholder={discountType === 'percent' ? 'Custom % (e.g. 12)' : 'Custom $ (e.g. 25)'}
                    value={discountInput}
                    onChange={(e) => setDiscountInput(e.target.value)}
                    className="w-full pl-2.5 pr-6 py-1 text-xs rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-900 dark:text-white focus:outline-hidden"
                  />
                  <span className="absolute right-2.5 top-1 text-[11px] text-slate-400 font-bold font-mono">
                    {discountType === 'percent' ? '%' : '$'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleApplyDiscount}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs"
                >
                  Apply
                </button>
                {discountAmount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setDiscountApplied(0);
                      setDiscountInput('');
                      showNotification('Discount removed');
                    }}
                    className="p-1 bg-slate-200 dark:bg-gray-700 hover:bg-rose-100 hover:text-rose-600 text-slate-600 text-xs font-bold rounded-xl transition cursor-pointer"
                    title="Remove discount"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Active Discount Status Pill */}
              {discountAmount > 0 && (
                <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-lg text-[10px] font-bold border border-emerald-200/80">
                  <span>
                    ✓ {discountType === 'percent' ? `${discountApplied}%` : `$${discountApplied.toFixed(2)}`} Applied
                  </span>
                  <span className="font-mono font-black">- $ {discountAmount.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Calculations Breakdown */}
            <div className="space-y-1.5 pt-1.5 border-t border-slate-100 dark:border-gray-700 text-xs shrink-0">
              {/* Subtotal */}
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span className="text-[11px]">Subtotal</span>
                <span className="font-bold text-slate-800 dark:text-white font-mono text-[11px]">
                  $ {subtotal.toFixed(2)}
                </span>
              </div>

              {/* Discount Line if any */}
              {discountAmount > 0 && (
                <div className="flex items-center justify-between text-emerald-600 text-[11px] font-semibold">
                  <span>Discount</span>
                  <span className="font-mono">- $ {discountAmount.toFixed(2)}</span>
                </div>
              )}

              {/* Tax (5%) */}
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span className="text-[11px]">Tax (5%)</span>
                <span className="font-bold text-slate-800 dark:text-white font-mono text-[11px]">
                  $ {tax.toFixed(2)}
                </span>
              </div>

              {/* Grand Total */}
              <div className="pt-2 border-t border-slate-200 dark:border-gray-700 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900 dark:text-white">Total</span>
                <span className="text-xl font-black text-blue-600 dark:text-blue-400 font-mono tracking-tight">
                  $ {grandTotal.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Complete Sale Button */}
            <button
              onClick={handleCompleteSale}
              disabled={isCompletingSale || cart.length === 0}
              className={`w-full py-3 px-3 rounded-xl text-white font-bold text-xs flex items-center justify-center space-x-2 transition shadow-md shadow-blue-500/20 shrink-0 ${
                cart.length === 0
                  ? 'bg-slate-200 dark:bg-gray-700 text-slate-400 cursor-not-allowed shadow-none'
                  : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.99] cursor-pointer'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>{isCompletingSale ? 'Recording Sale...' : 'Complete Sale'}</span>
              <span>→</span>
            </button>

            {/* Payment Method Selector */}
            <div className="grid grid-cols-4 gap-1 pt-0.5 shrink-0">
              {[
                { id: 'cash', label: 'Cash', icon: DollarSign },
                { id: 'card', label: 'Card', icon: CreditCard },
                { id: 'upi', label: 'UPI/Wallet', icon: Smartphone },
                { id: 'more', label: 'More', icon: MoreHorizontal }
              ].map((m) => {
                const Icon = m.icon;
                const isSelected = paymentMethod === m.id;

                return (
                  <button
                    key={m.id}
                    onClick={() => setPaymentMethod(m.id)}
                    className={`p-1.5 rounded-lg text-center text-[10px] font-bold transition flex flex-col items-center justify-center space-y-0.5 cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                        : 'bg-slate-50 dark:bg-gray-700/50 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-gray-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    <span className="truncate w-full">{m.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Trust Footer with Fluid Wave Accent */}
            <div className="relative overflow-hidden rounded-xl bg-slate-50/80 dark:bg-gray-900/50 p-2.5 border border-slate-200/60 dark:border-gray-700/60 shrink-0">
              <div
                className="absolute right-0 bottom-0 w-32 h-16 opacity-20 dark:opacity-10 pointer-events-none bg-no-repeat bg-right-bottom bg-contain"
                style={{ backgroundImage: `url('/waves/ocean_waves_blue.jpg')` }}
              ></div>

              <div className="relative z-10 flex items-start space-x-2">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-bold text-slate-800 dark:text-slate-200">
                    Fast • Secure • Reliable.
                  </p>
                  <p className="text-[9px] text-slate-400 mt-0.5">
                    Your business, our priority.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Floating Mobile Cart Summary (Only on mobile viewports < lg) */}
      {cart.length > 0 && (
        <div className="fixed bottom-4 inset-x-3 z-40 lg:hidden bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-3 shadow-2xl border border-white/10 flex items-center justify-between animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-xs relative shrink-0">
              <ShoppingCart className="w-4 h-4" />
              <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {cart.reduce((s, i) => s + i.quantity, 0)}
              </span>
            </div>
            <div>
              <p className="text-xs font-bold leading-tight">${grandTotal.toFixed(2)}</p>
              <p className="text-[10px] text-slate-400">Tap to scroll to Checkout</p>
            </div>
          </div>
          <button
            onClick={() => {
              document.getElementById('pos-checkout-section')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            Go to Cart & Pay
          </button>
        </div>
      )}

      {/* =========================================================
          PAGE FOOTER
      ========================================================= */}
      <footer className="px-4 sm:px-6 py-3 border-t border-slate-200/80 dark:border-gray-800 flex items-center justify-between text-xs text-slate-400 mt-auto bg-white/50 dark:bg-[#111827]/50 pb-16 lg:pb-3">
        <div className="flex items-center space-x-1.5 font-medium text-[11px]">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
          <span>POS System v1.0</span>
        </div>
        <p className="font-semibold text-slate-500 dark:text-slate-400 text-[11px]">
          Powered by <span className="font-bold text-blue-600 dark:text-blue-400">Tiwlo</span>
        </p>
      </footer>

      {/* =========================================================
          NEW CUSTOMER / ENTITY REGISTRATION MODAL POPUP
      ========================================================= */}
      {isNewCustomerModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200"
          onClick={() => setIsNewCustomerModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-3xl shadow-2xl max-w-3xl w-full my-auto overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-gray-800 flex items-center justify-between bg-slate-50/70 dark:bg-gray-800/40">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Register Customer Account</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      Multi-Classification
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Worldwide directory registration for retail, wholesale, corporate clients, or suppliers
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNewCustomerModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center transition cursor-pointer"
                title="Close (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateNewCustomer} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* SECTION 1: ACCOUNT CLASSIFICATION */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center">
                    <span>1. Account Classification</span>
                    <span className="text-rose-500 font-bold ml-1.5 text-[11px]">* Required</span>
                  </label>
                  <span className="text-[10px] text-slate-400">Select entity role in your business</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                  {CUSTOMER_TYPES.map((t) => {
                    const IconComp = t.icon;
                    const isSelected = newCustomerForm.customerType === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setNewCustomerForm((prev) => ({ ...prev, customerType: t.id }))}
                        className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${
                          isSelected
                            ? `${t.activeRing} ring-2 ring-blue-500/20 shadow-xs`
                            : 'border-slate-200 dark:border-gray-800 hover:border-slate-300 dark:hover:border-gray-700 bg-slate-50/50 dark:bg-gray-800/30'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div
                            className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                              isSelected
                                ? 'bg-white dark:bg-gray-800 shadow-2xs'
                                : 'bg-slate-100 dark:bg-gray-800'
                            }`}
                          >
                            <IconComp className="w-3.5 h-3.5" />
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                            {t.short}
                          </p>
                          <p className="text-[9px] text-slate-400 mt-0.5 line-clamp-1">
                            {t.id === 'Retail'
                              ? 'B2C Shopper'
                              : t.id === 'Wholesale'
                              ? 'B2B Trade'
                              : t.id === 'Corporate'
                              ? 'Enterprise'
                              : t.id === 'Supplier'
                              ? 'Vendor'
                              : 'Partner'}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* SECTION 2: PRIMARY ACCOUNT IDENTITY */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-gray-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    2. Primary Identity
                  </label>
                  <span className="text-[10px] text-slate-400">Legal entity or individual name</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                      Customer or Company Name <span className="text-rose-500">* Required</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Apex Tech Global Ltd / Sarah Jenkins"
                      value={newCustomerForm.name}
                      onChange={(e) => {
                        setNewCustomerForm((prev) => ({ ...prev, name: e.target.value }));
                        if (customerFormErrors.name) {
                          setCustomerFormErrors((prev) => ({ ...prev, name: null }));
                        }
                      }}
                      className={`w-full px-3 py-2 text-xs rounded-xl border bg-slate-50 dark:bg-gray-800/80 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 ${
                        customerFormErrors.name
                          ? 'border-rose-500 ring-2 ring-rose-500/20'
                          : 'border-slate-200 dark:border-gray-700'
                      }`}
                    />
                    {customerFormErrors.name && (
                      <p className="text-[10px] text-rose-500 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {customerFormErrors.name}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                      Contact Person / Representative
                      <span className="text-slate-400 font-normal ml-1">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Marcus Vance (Procurement Head)"
                      value={newCustomerForm.contactPerson}
                      onChange={(e) =>
                        setNewCustomerForm((prev) => ({ ...prev, contactPerson: e.target.value }))
                      }
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800/80 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 3: CONTACT CHANNELS */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-gray-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    3. Contact Channels
                  </label>
                  <span className="text-[10px] text-slate-400">Communication & billing dispatches</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                      Phone Number <span className="text-rose-500">* Required</span>
                    </label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="+1 (555) 234-5678 or +880 1711..."
                        value={newCustomerForm.phone}
                        onChange={(e) => {
                          setNewCustomerForm((prev) => ({ ...prev, phone: e.target.value }));
                          if (customerFormErrors.phone) {
                            setCustomerFormErrors((prev) => ({ ...prev, phone: null }));
                          }
                        }}
                        className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border bg-slate-50 dark:bg-gray-800/80 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 ${
                          customerFormErrors.phone
                            ? 'border-rose-500 ring-2 ring-rose-500/20'
                            : 'border-slate-200 dark:border-gray-700'
                        }`}
                      />
                    </div>
                    {customerFormErrors.phone && (
                      <p className="text-[10px] text-rose-500 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {customerFormErrors.phone}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                      Email Address
                      <span className="text-slate-400 font-normal ml-1">(Optional for digital invoice)</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="email"
                        placeholder="billing@example.com"
                        value={newCustomerForm.email}
                        onChange={(e) =>
                          setNewCustomerForm((prev) => ({ ...prev, email: e.target.value }))
                        }
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800/80 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 4: LOCATION & BILLING ADDRESS */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-gray-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    4. Location & Address
                  </label>
                  <span className="text-[10px] text-slate-400">Tax jurisdiction & delivery address</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                      Street Address <span className="text-rose-500">* Required</span>
                    </label>
                    <div className="relative">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="e.g. 402 Silicon Way, Suite 400"
                        value={newCustomerForm.address}
                        onChange={(e) => {
                          setNewCustomerForm((prev) => ({ ...prev, address: e.target.value }));
                          if (customerFormErrors.address) {
                            setCustomerFormErrors((prev) => ({ ...prev, address: null }));
                          }
                        }}
                        className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border bg-slate-50 dark:bg-gray-800/80 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 ${
                          customerFormErrors.address
                            ? 'border-rose-500 ring-2 ring-rose-500/20'
                            : 'border-slate-200 dark:border-gray-700'
                        }`}
                      />
                    </div>
                    {customerFormErrors.address && (
                      <p className="text-[10px] text-rose-500 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {customerFormErrors.address}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                      City / Region
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Austin, TX / Dhaka"
                      value={newCustomerForm.city}
                      onChange={(e) =>
                        setNewCustomerForm((prev) => ({ ...prev, city: e.target.value }))
                      }
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800/80 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                      Country / Jurisdiction
                    </label>
                    <select
                      value={newCustomerForm.country}
                      onChange={(e) =>
                        setNewCustomerForm((prev) => ({ ...prev, country: e.target.value }))
                      }
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800/80 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="United States">United States (USD)</option>
                      <option value="United Kingdom">United Kingdom (GBP)</option>
                      <option value="Canada">Canada (CAD)</option>
                      <option value="Australia">Australia (AUD)</option>
                      <option value="Germany">Germany / EU (EUR)</option>
                      <option value="Bangladesh">Bangladesh (BDT)</option>
                      <option value="United Arab Emirates">United Arab Emirates (AED)</option>
                      <option value="Singapore">Singapore (SGD)</option>
                      <option value="Global">Worldwide / Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                      Tax ID / VAT / Trade License No
                      <span className="text-slate-400 font-normal ml-1">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. US-EIN: 12-3456789 or VAT-8829"
                      value={newCustomerForm.taxId}
                      onChange={(e) =>
                        setNewCustomerForm((prev) => ({ ...prev, taxId: e.target.value }))
                      }
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800/80 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 5: COMMERCIAL TERMS & NOTES */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-gray-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    5. Commercial Terms & Preferences
                  </label>
                  <span className="text-[10px] text-slate-400">Payment terms & credit limit</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                      Payment / Credit Terms
                    </label>
                    <select
                      value={newCustomerForm.paymentTerms}
                      onChange={(e) =>
                        setNewCustomerForm((prev) => ({ ...prev, paymentTerms: e.target.value }))
                      }
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800/80 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="Immediate">Immediate (Due Upon Receipt / POS Cashier)</option>
                      <option value="Net 15">Net 15 Days</option>
                      <option value="Net 30">Net 30 Days (Standard Commercial B2B)</option>
                      <option value="Net 60">Net 60 Days</option>
                      <option value="Cash on Delivery">Cash on Delivery (COD)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                      Credit Limit ($ USD)
                      <span className="text-slate-400 font-normal ml-1">(Optional)</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 5000.00"
                      value={newCustomerForm.creditLimit}
                      onChange={(e) =>
                        setNewCustomerForm((prev) => ({ ...prev, creditLimit: e.target.value }))
                      }
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800/80 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                <div className="pt-1">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                    Internal Notes / Special Instructions
                    <span className="text-slate-400 font-normal ml-1">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Special bulk pricing discount, delivery instructions, VIP client"
                    value={newCustomerForm.notes}
                    onChange={(e) =>
                      setNewCustomerForm((prev) => ({ ...prev, notes: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800/80 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              {/* Modal Actions Footer */}
              <div className="pt-4 border-t border-slate-100 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-[10px] text-slate-400 order-2 sm:order-1">
                  * Fields marked with red asterisks are required for invoice verification.
                </p>
                <div className="flex items-center space-x-2 order-1 sm:order-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => setIsNewCustomerModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-gray-800 rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingCustomer}
                    className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-md shadow-blue-500/25 transition cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>
                      {isSavingCustomer ? 'Registering Account...' : 'Register & Select Customer'}
                    </span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
