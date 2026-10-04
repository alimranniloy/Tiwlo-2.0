import React, { useState } from 'react';
import {
  Star,
  ShieldCheck,
  Truck,
  RotateCcw,
  CheckCircle2,
  Heart,
  Share2,
  ShoppingBag,
  Zap,
  ChevronRight,
  ArrowLeft,
  Store,
  MapPin,
  Clock,
  Package
} from 'lucide-react';
import { useStoreSettings } from '../../../context/StoreSettingsContext';

export default function ProductDetailPage({
  product,
  products = [],
  onAddToCart,
  onBuyNow,
  onNavigate,
  showToast
}) {
  const { storeSettings } = useStoreSettings();
  const primaryColor = storeSettings?.themeColor || '#2563eb';
  const [selectedImgIdx, setSelectedImgIdx] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState('description');
  const [isWishlisted, setIsWishlisted] = useState(false);

  if (!product) {
    return (
      <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-16 text-center">
        <Package className="w-16 h-16 mx-auto text-slate-300 mb-4" />
        <h2 className="text-xl font-bold text-slate-800">Product Not Found</h2>
        <p className="text-xs text-slate-500 mt-1">The requested item could not be retrieved from the store catalog.</p>
        <button
          onClick={() => onNavigate?.('home')}
          className="mt-6 px-6 py-2.5 rounded-xl bg-[#2563eb] text-white text-xs font-bold hover:bg-blue-700 transition"
        >
          Return to Marketplace Home
        </button>
      </div>
    );
  }

  const images = product.images && product.images.length > 0
    ? product.images
    : [product.image || '/default-product.svg'];

  const discountVal = product.discount || (
    product.originalPrice
      ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
      : null
  );

  const origPrice = product.originalPrice || (product.price * 1.35).toFixed(2);
  const savings = (origPrice - product.price).toFixed(2);

  // Related products from same category
  const relatedProducts = products
    .filter(p => p.id !== product.id && p.category === product.category)
    .slice(0, 4);

  const handleAdd = () => {
    onAddToCart?.(product, quantity);
    showToast?.(`Added ${quantity}x "${product.name}" to your cart!`, 'success');
  };

  const handleBuy = () => {
    onAddToCart?.(product, quantity);
    onBuyNow?.();
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-5 space-y-6">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center space-x-2 text-xs text-slate-500">
        <button
          onClick={() => onNavigate?.('home')}
          className="hover:text-[#2563eb] flex items-center space-x-1"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          <span>Home</span>
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
        <button
          onClick={() => onNavigate?.('category', { category: product.category })}
          className="hover:text-[#2563eb]"
        >
          {product.category || 'General'}
        </button>
        {product.subCategory && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <span className="text-slate-600 font-medium">{product.subCategory}</span>
          </>
        )}
        <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
        <span className="text-slate-800 font-bold truncate max-w-xs">{product.name}</span>
      </nav>

      {/* Main Product Section: Two Columns */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT COLUMN: Image Gallery */}
          <div className="lg:col-span-6 space-y-4">
            <div className="w-full h-80 md:h-[440px] rounded-2xl border border-slate-100 bg-[#FAFAFA] flex items-center justify-center p-6 relative overflow-hidden group">
              {discountVal && (
                <span className="absolute top-4 left-4 z-10 bg-[#ef4444] text-white text-xs font-black px-2.5 py-1 rounded-lg shadow-xs">
                  -{discountVal}% OFF
                </span>
              )}

              <button
                onClick={() => {
                  setIsWishlisted(!isWishlisted);
                  showToast?.(isWishlisted ? 'Removed from wishlist' : 'Saved to wishlist!');
                }}
                className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-white border border-slate-200 shadow-xs flex items-center justify-center text-slate-500 hover:text-rose-500 transition"
              >
                <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-rose-500 text-rose-500' : ''}`} />
              </button>

              <img
                src={images[selectedImgIdx] || images[0]}
                alt={product.name}
                className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300"
              />
            </div>

            {/* Thumbnails strip */}
            {images.length > 1 && (
              <div className="flex items-center space-x-3 overflow-x-auto pb-1">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImgIdx(idx)}
                    className={`w-16 h-16 rounded-xl border-2 p-1 bg-white shrink-0 transition ${
                      selectedImgIdx === idx ? 'border-[#2563eb] shadow-xs' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-contain" />
                  </button>
                ))}
              </div>
            )}

            {/* Service & Trust Badges */}
            <div className="grid grid-cols-3 gap-3 pt-2 text-center text-[11px] text-slate-600">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex flex-col items-center">
                <Truck className="w-4 h-4 text-[#2563eb] mb-1" />
                <span className="font-bold text-slate-800">Free Delivery</span>
                <span className="text-[10px] text-slate-400">On orders over $150</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex flex-col items-center">
                <ShieldCheck className="w-4 h-4 text-emerald-600 mb-1" />
                <span className="font-bold text-slate-800">100% Authentic</span>
                <span className="text-[10px] text-slate-400">Direct verified source</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex flex-col items-center">
                <RotateCcw className="w-4 h-4 text-amber-500 mb-1" />
                <span className="font-bold text-slate-800">30-Day Returns</span>
                <span className="text-[10px] text-slate-400">Hassle-free guarantee</span>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Product Information & Purchase Controls */}
          <div className="lg:col-span-6 space-y-5">
            {/* Category and Stock Indicator */}
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full bg-blue-50 text-[#2563eb] font-bold text-xs">
                {product.category || 'General'}
              </span>
              <div className="flex items-center space-x-1.5 text-xs text-emerald-600 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>{product.status || 'In Stock'} ({product.stock || 45} units available)</span>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-snug">
              {product.name}
            </h1>

            {/* Rating & Reviews */}
            <div className="flex items-center space-x-3 text-xs text-slate-500">
              <div className="flex items-center space-x-1 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-md text-amber-700 font-bold">
                <Star className="w-3.5 h-3.5 fill-amber-400 stroke-amber-400" />
                <span>{product.rating || 4.8}</span>
              </div>
              <span>({product.reviews || '5.2K'} customer reviews)</span>
              <span>•</span>
              <span className="text-slate-600 font-medium">{product.sold || 320} items sold</span>
            </div>

            {/* Price Box */}
            <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-100 space-y-1">
              <div className="flex items-baseline space-x-3">
                <span className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                  ${Number(product.price).toFixed(2)}
                </span>
                <span className="text-base text-slate-400 line-through font-normal">
                  ${Number(origPrice).toFixed(2)}
                </span>
                {discountVal && (
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                    Save ${savings} ({discountVal}%)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">All local taxes and export customs duties included.</p>
            </div>

            {/* Multi-Vendor Seller Info Card matching screenshot */}
            <div className="p-3.5 rounded-2xl border border-slate-200/80 bg-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-slate-900 text-white font-bold text-sm flex items-center justify-center">
                  {(product.supplierName || 'TW').substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-900">{product.supplierName || 'TechWorld Store'}</span>
                    <span className="bg-blue-50 text-[#2563eb] text-[10px] font-bold px-1.5 py-0.2 rounded-full">Top Rated</span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium">
                    150K+ Followers • Ships from {product.supplierCountry || 'China'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => showToast?.(`Viewing ${product.supplierName || 'TechWorld Store'} storefront catalog`)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Visit Store
              </button>
            </div>

            {/* Quantity Selector & Action Buttons */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center space-x-4">
                <span className="text-xs font-bold text-slate-700">Quantity:</span>
                <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden bg-white shadow-2xs">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 font-bold transition"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-12 text-center text-xs font-bold text-slate-800 outline-none"
                  />
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 font-bold transition"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Action Buttons: Add to Cart & Buy Now */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleAdd}
                  className="py-3 px-6 rounded-xl border-2 text-xs font-extrabold flex items-center justify-center space-x-2 transition shadow-xs active:scale-98 cursor-pointer"
                  style={{
                    borderColor: primaryColor,
                    color: primaryColor,
                    backgroundColor: `${primaryColor}0d`
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = `${primaryColor}1a`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = `${primaryColor}0d`;
                  }}
                >
                  <ShoppingBag className="w-4 h-4 stroke-[2.2]" />
                  <span>Add to Cart</span>
                </button>

                <button
                  type="button"
                  onClick={handleBuy}
                  className="py-3 px-6 rounded-xl text-white text-xs font-extrabold flex items-center justify-center space-x-2 transition shadow-md active:scale-98 cursor-pointer hover:opacity-90"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Zap className="w-4 h-4 fill-white" />
                  <span>Buy Now</span>
                </button>
              </div>
            </div>

            {/* Meta tags */}
            <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs text-slate-500">
              <p><span className="font-semibold text-slate-700">SKU:</span> {product.sku}</p>
              <p><span className="font-semibold text-slate-700">Barcode:</span> {product.barcode || '890123405501'}</p>
              <p><span className="font-semibold text-slate-700">Warranty:</span> 1 Year Manufacturer</p>
              <p><span className="font-semibold text-slate-700">Handling:</span> Ships within 24 Hours</p>
            </div>
          </div>

        </div>

        {/* Detailed Tabs: Overview & Specifications */}
        <div className="mt-12 pt-8 border-t border-slate-200">
          <div className="flex items-center space-x-4 border-b border-slate-200 pb-3">
            <button
              onClick={() => setActiveTab('description')}
              className={`text-xs font-bold pb-2 transition ${
                activeTab === 'description' ? 'text-[#2563eb] border-b-2 border-[#2563eb]' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Product Description
            </button>
            <button
              onClick={() => setActiveTab('specs')}
              className={`text-xs font-bold pb-2 transition ${
                activeTab === 'specs' ? 'text-[#2563eb] border-b-2 border-[#2563eb]' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Technical Specifications
            </button>
            <button
              onClick={() => setActiveTab('shipping')}
              className={`text-xs font-bold pb-2 transition ${
                activeTab === 'shipping' ? 'text-[#2563eb] border-b-2 border-[#2563eb]' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Shipping & Multi-Vendor Policy
            </button>
          </div>

          <div className="py-6 text-xs text-slate-600 leading-relaxed">
            {activeTab === 'description' && (
              <div className="space-y-3">
                <p>
                  {product.description ||
                    `${product.name} is manufactured to enterprise industrial standards. Engineered for precision performance, high reliability, and seamless global compatibility. Each unit is inspected and tested through multi-point QA checks prior to packaging.`}
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
                  <li>Genuine OEM certified parts and high-grade materials</li>
                  <li>Energy efficient, certified with global safety standards (CE, FCC, RoHS)</li>
                  <li>Multi-language user manual and rapid setup guide included</li>
                  <li>Worldwide express courier dispatch with live tracking updates</li>
                </ul>
              </div>
            )}

            {activeTab === 'specs' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-slate-100">
                  <tbody>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <td className="p-3 font-semibold text-slate-700 w-1/3">Product Name</td>
                      <td className="p-3 text-slate-800">{product.name}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="p-3 font-semibold text-slate-700">SKU / Model</td>
                      <td className="p-3 text-slate-800">{product.sku}</td>
                    </tr>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <td className="p-3 font-semibold text-slate-700">Category</td>
                      <td className="p-3 text-slate-800">{product.category} {product.subCategory ? `(${product.subCategory})` : ''}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="p-3 font-semibold text-slate-700">Inventory Status</td>
                      <td className="p-3 text-slate-800">{product.status || 'In Stock'}</td>
                    </tr>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <td className="p-3 font-semibold text-slate-700">Origin / Seller</td>
                      <td className="p-3 text-slate-800">{product.supplierName || 'TechWorld Store'} ({product.supplierCountry || 'China'})</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'shipping' && (
              <div className="space-y-3">
                <p>
                  Orders are dispatched directly from the verified vendor logistics terminal within 24 hours of payment authorization.
                </p>
                <p>
                  Estimated delivery timeframe: <strong>3 - 7 business days</strong> depending on delivery location. Full door-to-door tracking provided with automated SMS and email notifications.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Related Products from same category */}
      {relatedProducts.length > 0 && (
        <div className="space-y-4 pt-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-1.5 h-5 bg-[#2563eb] rounded-full"></div>
            <h3 className="text-base font-bold text-slate-900">Related Products</h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {relatedProducts.map((rel) => (
              <div
                key={rel.id}
                onClick={() => onNavigate?.('product', { id: rel.id })}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-blue-300 p-3.5 flex flex-col justify-between cursor-pointer transition group"
              >
                <div className="w-full h-32 flex items-center justify-center overflow-hidden mb-2">
                  <img
                    src={rel.image || rel.images?.[0]}
                    alt={rel.name}
                    className="max-h-28 object-contain group-hover:scale-105 transition"
                  />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 group-hover:text-[#2563eb] transition truncate">
                    {rel.name}
                  </h4>
                  <div className="flex items-baseline space-x-2 mt-1">
                    <span className="text-xs font-black text-slate-900">${Number(rel.price).toFixed(2)}</span>
                    {rel.originalPrice && (
                      <span className="text-[10px] text-slate-400 line-through">${Number(rel.originalPrice).toFixed(2)}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
