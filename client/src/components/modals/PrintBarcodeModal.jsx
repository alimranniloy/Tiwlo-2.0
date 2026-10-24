import React, { useState, useEffect } from 'react';
import {
  X,
  Printer,
  Copy,
  Check,
  Barcode as BarcodeIcon,
  Layers,
  Sparkles,
  Eye,
  Info
} from 'lucide-react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

export default function PrintBarcodeModal({
  isOpen,
  onClose,
  product = null,
  storeName = 'TIWLO INVENTORY'
}) {
  // Barcode configuration state
  const [format, setFormat] = useState('CODE128'); // CODE128, EAN13, UPC, CODE39, QRCODE
  const [copies, setCopies] = useState(product?.stock > 0 ? Math.min(Number(product.stock), 24) : 10);
  const [sheetLayout, setSheetLayout] = useState('single'); // 'single' (thermal roll), 'a4-30', 'a4-24', 'a4-40'

  // Label display toggles
  const [showStoreName, setShowStoreName] = useState(true);
  const [showProductName, setShowProductName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showCodeText, setShowCodeText] = useState(true);
  const currencySymbol = product?.currencySymbol || '$';

  // Preview data
  const [preview, setPreview] = useState({ key: '', dataUrl: '', error: '' });
  const [printError, setPrintError] = useState('');
  const [copied, setCopied] = useState(false);

  const barcodeValue = String(product?.barcode || product?.sku || '123456789012');
  const previewKey = JSON.stringify({
    format,
    barcodeValue,
    showCodeText,
    productName: product?.name,
    productSku: product?.sku,
    productBarcode: product?.barcode,
    price: product?.price
  });
  const hasCurrentPreview = preview.key === previewKey;
  const qrDataUrl = format === 'QRCODE' && hasCurrentPreview ? preview.dataUrl : '';
  const barcodeDataUrl = format !== 'QRCODE' && hasCurrentPreview ? preview.dataUrl : '';
  const barcodeError = (hasCurrentPreview ? preview.error : '') || printError;

  // Generate Single Barcode Preview for modal display
  useEffect(() => {
    if (!isOpen || !product) return undefined;

    let cancelled = false;
    const generatePreview = async () => {
      let dataUrl = '';
      let error = '';
      if (format === 'QRCODE') {
        const qrPayload = JSON.stringify({
          name: product.name,
          sku: product.sku,
          barcode: product.barcode,
          price: product.price
        });
        try {
          dataUrl = await QRCode.toDataURL(qrPayload, {
            width: 140,
            margin: 1,
            color: { dark: '#000000', light: '#ffffff' }
          });
        } catch (generationError) {
          console.error('QR code generation error:', generationError);
          error = 'Failed to generate QR code';
        }
      } else {
        const canvas = document.createElement('canvas');
        try {
          let validValue = barcodeValue;
          if (format === 'EAN13') {
            validValue = barcodeValue.replace(/\D/g, '').padEnd(12, '0').slice(0, 12);
          } else if (format === 'UPC') {
            validValue = barcodeValue.replace(/\D/g, '').padEnd(11, '0').slice(0, 11);
          }

          JsBarcode(canvas, validValue, {
            format,
            width: 2,
            height: 80,
            displayValue: showCodeText,
            fontSize: 12,
            font: 'monospace',
            margin: 6,
            background: '#ffffff',
            lineColor: '#000000'
          });
          dataUrl = canvas.toDataURL('image/png');
        } catch (generationError) {
          console.warn('Barcode render error:', generationError);
          try {
            JsBarcode(canvas, barcodeValue, {
              format: 'CODE128',
              width: 1.8,
              height: 80,
              displayValue: showCodeText,
              fontSize: 12,
              font: 'monospace',
              margin: 6,
              background: '#ffffff',
              lineColor: '#000000'
            });
            dataUrl = canvas.toDataURL('image/png');
            error = 'The selected format did not match this code; Code 128 was used instead.';
          } catch {
            error = 'Invalid barcode format for this SKU';
          }
        }
      }

      if (!cancelled) setPreview({ key: previewKey, dataUrl, error });
    };
    generatePreview();
    return () => { cancelled = true; };
  }, [isOpen, previewKey, product, format, barcodeValue, showCodeText]);

  // Handle native browser print
  const handlePrint = () => {
    if (!hasCurrentPreview || !preview.dataUrl) {
      setPrintError('Wait for the code preview to finish generating before printing.');
      return;
    }
    setPrintError('');
    window.print();
  };

  // Copy Barcode SKU
  const handleCopyBarcode = async () => {
    try {
      await navigator.clipboard.writeText(barcodeValue);
      setCopied(true);
      setPrintError('');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Could not copy barcode:', err);
      setPrintError('Could not copy the code. Check clipboard permissions and try again.');
    }
  };

  if (!isOpen || !product) return null;

  // Generate array of items to print based on copies count
  const safeCopies = Math.max(1, Math.min(Number(copies) || 1, 200));
  const printItems = Array.from({ length: safeCopies }, (_, i) => i);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      {/* Container */}
      <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-gray-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-gray-900/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/25">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                Barcode & Label Print Studio
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold">
                  {format}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Product: <span className="font-semibold text-slate-700 dark:text-slate-200">{product.name}</span> • SKU: <span className="font-mono text-blue-600 dark:text-blue-400">{product.sku}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-gray-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body - 2 Columns: Controls on left, Live Layout Preview on right */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
          {/* LEFT COLUMN: Controls & Settings */}
          <div className="lg:col-span-5 space-y-5">
            {/* Copies to Print */}
            <div className="bg-slate-50 dark:bg-gray-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Printer className="w-3.5 h-3.5 text-blue-600" />
                  Copies to Print
                </label>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-blue-600 text-white">
                  {copies} {copies === 1 ? 'sticker' : 'stickers'}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setCopies(prev => Math.max(1, prev - 1))}
                  className="w-10 h-10 rounded-xl bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-gray-600 transition"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  max="200"
                  value={copies}
                  onChange={(e) => setCopies(Math.max(1, Math.min(200, parseInt(e.target.value) || 1)))}
                  className="flex-1 text-center font-bold text-slate-900 dark:text-white bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl py-2 text-sm focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setCopies(prev => Math.min(200, prev + 1))}
                  className="w-10 h-10 rounded-xl bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-gray-600 transition"
                >
                  +
                </button>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[1, 5, 10, 24, 30].map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setCopies(num)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition ${
                      copies === num
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white dark:bg-gray-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-gray-700 hover:bg-slate-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {num}
                  </button>
                ))}
                {product.stock > 0 && (
                  <button
                    type="button"
                    onClick={() => setCopies(Math.min(200, Number(product.stock)))}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition ${
                      copies === product.stock
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
                    }`}
                  >
                    Stock ({Math.min(200, Number(product.stock))})
                  </button>
                )}
              </div>
            </div>

            {/* Barcode Formats / Symbology Options */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <BarcodeIcon className="w-3.5 h-3.5 text-blue-600" />
                Barcode Format
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'CODE128', label: 'Code 128 (Universal)', sub: 'Alphanumeric SKU' },
                  { id: 'EAN13', label: 'EAN-13', sub: 'Standard 13 Digits' },
                  { id: 'QRCODE', label: 'QR Code 2D', sub: 'Smart Device / Mobile' },
                  { id: 'CODE39', label: 'Code 39', sub: 'Industrial Barcode' }
                ].map((fmt) => (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => setFormat(fmt.id)}
                    className={`p-2.5 text-left rounded-xl border transition flex flex-col justify-between ${
                      format === fmt.id
                        ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 ring-2 ring-blue-500/20'
                        : 'border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="text-xs font-bold flex items-center justify-between">
                      {fmt.label}
                      {format === fmt.id && <Check className="w-3.5 h-3.5 text-blue-600" />}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5">{fmt.sub}</span>
                  </button>
                ))}
              </div>
              {barcodeError && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-1">
                  <Info className="w-3 h-3 shrink-0" />
                  {barcodeError}
                </p>
              )}
            </div>

            {/* Paper Sheet / Printer Type */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                Paper Layout / Printer
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'single', name: 'Thermal Roll (POS)', desc: '50mm × 30mm Roll' },
                  { id: 'a4-30', name: 'A4 Sheet (30-up)', desc: '3 × 10 Grid' },
                  { id: 'a4-24', name: 'A4 Sheet (24-up)', desc: '3 × 8 Grid' },
                  { id: 'a4-40', name: 'A4 Sheet (40-up)', desc: '4 × 10 Compact' }
                ].map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSheetLayout(item.id)}
                    className={`p-2.5 text-left rounded-xl border transition ${
                      sheetLayout === item.id
                        ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-100 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <p className="text-xs font-bold">{item.name}</p>
                    <p className="text-[10px] text-slate-400">{item.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Label Content Display Toggles */}
            <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-gray-800">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Sticker Content Toggles
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="flex items-center space-x-2 p-2 rounded-xl bg-slate-50 dark:bg-gray-800/40 border border-slate-200/60 dark:border-gray-700/60 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showStoreName}
                    onChange={(e) => setShowStoreName(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span className="text-slate-700 dark:text-slate-300 font-medium">Store Name</span>
                </label>

                <label className="flex items-center space-x-2 p-2 rounded-xl bg-slate-50 dark:bg-gray-800/40 border border-slate-200/60 dark:border-gray-700/60 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showProductName}
                    onChange={(e) => setShowProductName(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span className="text-slate-700 dark:text-slate-300 font-medium">Product Name</span>
                </label>

                <label className="flex items-center space-x-2 p-2 rounded-xl bg-slate-50 dark:bg-gray-800/40 border border-slate-200/60 dark:border-gray-700/60 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPrice}
                    onChange={(e) => setShowPrice(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span className="text-slate-700 dark:text-slate-300 font-medium">Price Tag</span>
                </label>

                <label className="flex items-center space-x-2 p-2 rounded-xl bg-slate-50 dark:bg-gray-800/40 border border-slate-200/60 dark:border-gray-700/60 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showCodeText}
                    onChange={(e) => setShowCodeText(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span className="text-slate-700 dark:text-slate-300 font-medium">Barcode Text</span>
                </label>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Live Interactive Print Sheet Preview */}
          <div className="lg:col-span-7 flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-blue-600" />
                Live Print Sheet Preview ({copies} Copies)
              </span>

              <button
                type="button"
                onClick={handleCopyBarcode}
                className="text-xs font-semibold text-slate-500 hover:text-blue-600 flex items-center gap-1 transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied Barcode' : 'Copy Code'}</span>
              </button>
            </div>

            {/* Sticker Preview Paper Sheet */}
            <div className="flex-1 bg-slate-100 dark:bg-gray-950 p-4 rounded-2xl border border-slate-200 dark:border-gray-800 overflow-y-auto max-h-[460px] flex justify-center">
              {sheetLayout === 'single' ? (
                /* Thermal Single Label Mode */
                <div className="w-[240px] bg-white text-black p-3.5 rounded-lg shadow-md border border-slate-300 flex flex-col items-center justify-center text-center self-start my-auto">
                  {showStoreName && (
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-700">
                      {storeName}
                    </p>
                  )}
                  {showProductName && (
                    <p className="text-xs font-bold text-black truncate max-w-[210px] mt-0.5">
                      {product.name}
                    </p>
                  )}

                  {/* Rendered Barcode Graphic */}
                  <div className="my-2 flex justify-center items-center w-full">
                    {format === 'QRCODE' ? (
                      qrDataUrl ? (
                        <img src={qrDataUrl} alt="QR Code" className="w-24 h-24" />
                      ) : (
                        <div className="w-24 h-24 bg-slate-100 flex items-center justify-center text-xs">Generating...</div>
                      )
                    ) : (
                      barcodeDataUrl
                        ? <img src={barcodeDataUrl} alt={`Barcode ${barcodeValue}`} className="max-w-[220px] w-full" />
                        : <div className="h-16 w-full animate-pulse bg-slate-100" aria-label="Generating barcode" />
                    )}
                  </div>

                  {showPrice && (
                    <p className="text-sm font-black text-black tracking-tight">
                      {currencySymbol}{parseFloat(product.price || 0).toFixed(2)}
                    </p>
                  )}
                </div>
              ) : (
                /* A4 Multi-label Grid Sheet Mode */
                <div className="w-full bg-white text-black p-4 rounded-lg shadow-md border border-slate-300 min-h-[380px]">
                  <div className={`grid gap-2.5 ${
                    sheetLayout === 'a4-40' ? 'grid-cols-4' : 'grid-cols-3'
                  }`}>
                    {printItems.slice(0, sheetLayout === 'a4-40' ? 40 : sheetLayout === 'a4-30' ? 30 : 24).map((idx) => (
                      <div
                        key={idx}
                        className="border border-dashed border-slate-300 p-2 rounded flex flex-col items-center justify-center text-center bg-white"
                      >
                        {showStoreName && (
                          <p className="text-[8px] font-black uppercase text-slate-600 truncate max-w-[120px]">
                            {storeName}
                          </p>
                        )}
                        {showProductName && (
                          <p className="text-[9px] font-bold text-black truncate max-w-[120px]">
                            {product.name}
                          </p>
                        )}

                        <div className="my-1 flex justify-center items-center">
                          {format === 'QRCODE' ? (
                            qrDataUrl && <img src={qrDataUrl} alt="QR" className="w-12 h-12" />
                          ) : (
                            barcodeDataUrl && <img src={barcodeDataUrl} alt={`Barcode ${barcodeValue}`} className="w-full max-w-[130px]" />
                          )}
                        </div>

                        {showPrice && (
                          <p className="text-[10px] font-black text-black">
                            {currencySymbol}{parseFloat(product.price || 0).toFixed(2)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Print Tips */}
            <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-blue-50/50 dark:bg-blue-950/20 p-3 rounded-xl border border-blue-100 dark:border-blue-900/30 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>
                Tip: When printing on thermal sticker rolls (50×30mm), select <strong>Thermal Roll</strong> layout with Margins set to <strong>None</strong> in the print dialog.
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-900/50 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400">
            <span>Ready to print: <strong>{copies} barcode stickers</strong></span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-gray-700 transition"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center space-x-2 px-5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 transition active:scale-98"
            >
              <Printer className="w-4 h-4" />
              <span>Print {copies} Labels Now</span>
            </button>
          </div>
        </div>
      </div>

      {/* HIDDEN PRINT CONTAINER (Rendered only on window.print via @media print) */}
      <div id="barcode-print-zone" className="hidden print:block print:fixed print:inset-0 print:bg-white print:z-[999999]">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * { visibility: hidden !important; }
            #barcode-print-zone, #barcode-print-zone * { visibility: visible !important; }
            #barcode-print-zone {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 6mm !important;
              background: white !important;
            }
            @page {
              margin: 0 !important;
              size: auto;
            }
          }
        `}} />

        {sheetLayout === 'single' ? (
          /* Single Thermal Roll Print Output */
          <div className="flex flex-col items-center gap-4">
            {printItems.map(idx => (
              <div
                key={idx}
                className="w-[50mm] h-[30mm] p-2 flex flex-col items-center justify-between text-center page-break-after-always border border-slate-200"
                style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
              >
                {showStoreName && <p className="text-[9px] font-black uppercase text-black">{storeName}</p>}
                {showProductName && <p className="text-[10px] font-bold text-black truncate max-w-[45mm]">{product.name}</p>}

                <div className="my-0.5 flex justify-center items-center">
                  {format === 'QRCODE' ? (
                    qrDataUrl && <img src={qrDataUrl} alt="QR" className="w-[18mm] h-[18mm]" />
                  ) : (
                    barcodeDataUrl && <img src={barcodeDataUrl} alt={`Barcode ${barcodeValue}`} className="max-w-[45mm] max-h-[12mm]" />
                  )}
                </div>

                {showPrice && <p className="text-[11px] font-black text-black">{currencySymbol}{parseFloat(product.price || 0).toFixed(2)}</p>}
              </div>
            ))}
          </div>
        ) : (
          /* A4 Sheet Grid Output */
          <div className={`grid gap-3 ${sheetLayout === 'a4-40' ? 'grid-cols-4' : 'grid-cols-3'}`}>
            {printItems.map(idx => (
              <div
                key={idx}
                className="border border-slate-300 p-2 rounded flex flex-col items-center justify-center text-center bg-white"
                style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
              >
                {showStoreName && <p className="text-[8px] font-black uppercase text-slate-700 truncate max-w-[120px]">{storeName}</p>}
                {showProductName && <p className="text-[9px] font-bold text-black truncate max-w-[120px]">{product.name}</p>}

                <div className="my-1 flex justify-center items-center">
                  {format === 'QRCODE' ? (
                    qrDataUrl && <img src={qrDataUrl} alt="QR" className="w-12 h-12" />
                  ) : (
                    barcodeDataUrl && <img src={barcodeDataUrl} alt={`Barcode ${barcodeValue}`} className="max-w-full max-h-8" />
                  )}
                </div>

                {showPrice && <p className="text-[10px] font-black text-black">{currencySymbol}{parseFloat(product.price || 0).toFixed(2)}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
