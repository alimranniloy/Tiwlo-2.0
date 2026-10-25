import { applicationFetch as fetch } from '../../../api/graphqlTransport.js';
import React, { useEffect, useState } from 'react';
import {
  Star,
  ShieldCheck,
  Truck,
  RotateCcw,
  CheckCircle2,
  Heart,
  ShoppingBag,
  Zap,
  ChevronRight,
  ArrowLeft,
  Package,
  MessageSquare
} from 'lucide-react';
import { useStoreSettings } from '../../../context/StoreSettingsContext';
import { formatStoreCurrency, getProductDiscount, productDescriptionText } from '../storefrontUtils';

export default function ProductDetailPage({
  product,
  products = [],
  onAddToCart,
  isWishlisted = false,
  onToggleWishlist,
  onSelectCategory,
  onBuyNow,
  onNavigate
}) {
  const { storeSettings } = useStoreSettings();
  const primaryColor = storeSettings?.themeColor || '#2563eb';
  const [selectedImgIdx, setSelectedImgIdx] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState('description');
  const [reviews, setReviews] = useState([]);
  const [customerOrders, setCustomerOrders] = useState([]);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewBody, setReviewBody] = useState('');
  const [reviewOrderId, setReviewOrderId] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);

  useEffect(() => {
    if (!product?.id) return undefined;
    let active = true;
    const loadReviews = async () => {
      try {
        const response = await fetch(`/api/public/reviews/${encodeURIComponent(product.id)}`);
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || `Review request failed with HTTP ${response.status}.`);
        if (active) setReviews(Array.isArray(result.reviews) ? result.reviews : []);
      } catch (error) {
        if (active) setReviewError(error.message || 'Could not load reviews.');
      }
    };
    const loadCustomerOrders = async () => {
      try {
        const response = await fetch('/api/public/customer-auth/me');
        if (response.status === 401) return;
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || `Account lookup failed with HTTP ${response.status}.`);
        if (active) setCustomerOrders(result.orders || []);
      } catch (error) {
        if (active) setReviewError(error.message || 'Could not load purchase verification.');
      }
    };
    loadReviews();
    loadCustomerOrders();
    return () => { active = false; };
  }, [product?.id]);

  const submitReview = async event => {
    event.preventDefault();
    setReviewBusy(true);
    setReviewError('');
    try {
      const response = await fetch('/api/public/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          orderId: reviewOrderId,
          rating: reviewRating,
          title: reviewTitle,
          body: reviewBody
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Review submission failed with HTTP ${response.status}.`);
      setReviewTitle('');
      setReviewBody('');
      setReviewOrderId('');
      setReviewError('Thanks! Your review is submitted and awaiting store moderation.');
    } catch (error) {
      setReviewError(error.message || 'Could not submit your review.');
    } finally {
      setReviewBusy(false);
    }
  };

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

  const discount = getProductDiscount(product);
  const description = productDescriptionText(product.description);

  // Related products from same category
  const relatedProducts = products
    .filter(p => p.id !== product.id && p.category === product.category)
    .slice(0, 4);

  const handleAdd = () => {
    onAddToCart?.(product, quantity);
  };

  const handleBuy = () => {
    if (onAddToCart?.(product, quantity)) onBuyNow?.();
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
          onClick={() => onSelectCategory?.(product.category)}
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
              {discount && (
                <span className="absolute top-4 left-4 z-10 bg-[#ef4444] text-white text-xs font-black px-2.5 py-1 rounded-lg shadow-xs">
                  -{discount.percent}% OFF
                </span>
              )}

              <button
                onClick={() => {
                  onToggleWishlist?.(product.id);
                }}
                aria-label={isWishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
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
                <span className="font-bold text-slate-800">Delivery</span>
                <span className="text-[10px] text-slate-400">Confirm with the store</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex flex-col items-center">
                <ShieldCheck className="w-4 h-4 text-emerald-600 mb-1" />
                <span className="font-bold text-slate-800">Product Information</span>
                <span className="text-[10px] text-slate-400">See the description below</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex flex-col items-center">
                <RotateCcw className="w-4 h-4 text-amber-500 mb-1" />
                <span className="font-bold text-slate-800">Returns</span>
                <span className="text-[10px] text-slate-400">Confirm the return policy</span>
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
              {product.stock != null && (
              <div className="flex items-center space-x-1.5 text-xs text-emerald-600 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>{product.status || (Number(product.stock) > 0 ? 'In Stock' : 'Out of Stock')} ({Number(product.stock)} units available)</span>
              </div>
              )}
            </div>

            {/* Title */}
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-snug">
              {product.name}
            </h1>

            {/* Rating & Reviews */}
            {(product.rating != null || product.reviews != null || product.sold != null) && (
            <div className="flex items-center space-x-3 text-xs text-slate-500">
              {product.rating != null && (
              <div className="flex items-center space-x-1 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-md text-amber-700 font-bold">
                <Star className="w-3.5 h-3.5 fill-amber-400 stroke-amber-400" />
                <span>{product.rating}</span>
              </div>
              )}
              {product.reviews != null && <span>({product.reviews} customer reviews)</span>}
              <span>•</span>
              {product.sold != null && <span className="text-slate-600 font-medium">{product.sold} items sold</span>}
            </div>
            )}

            {/* Price Box */}
            <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-100 space-y-1">
              <div className="flex items-baseline space-x-3">
                <span className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                  {formatStoreCurrency(product.price, storeSettings)}
                </span>
                {discount && <span className="text-base text-slate-400 line-through font-normal">
                  {formatStoreCurrency(discount.originalPrice, storeSettings)}
                </span>}
                {discount && (
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                    Save {formatStoreCurrency(discount.savings, storeSettings)} ({discount.percent}%)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">Taxes and delivery charges, if applicable, are confirmed at checkout.</p>
            </div>

            {/* Quantity Selector & Action Buttons */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center space-x-4">
                <span className="text-xs font-bold text-slate-700">Quantity:</span>
                <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden bg-white shadow-2xs">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                    className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 font-bold transition"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={quantity}
                    min="1"
                    max={Number.isFinite(Number(product.stock)) ? product.stock : undefined}
                    onChange={(e) => setQuantity(Math.min(
                      Number.isFinite(Number(product.stock)) ? Math.max(1, Number(product.stock)) : Number.MAX_SAFE_INTEGER,
                      Math.max(1, parseInt(e.target.value) || 1)
                    ))}
                    className="w-12 text-center text-xs font-bold text-slate-800 outline-none"
                  />
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    disabled={product.stock != null && quantity >= Number(product.stock)}
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
                  disabled={product.stock != null && Number(product.stock) <= 0}
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
                  disabled={product.stock != null && Number(product.stock) <= 0}
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
              {product.barcode && <p><span className="font-semibold text-slate-700">Barcode:</span> {product.barcode}</p>}
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
            <button
              onClick={() => setActiveTab('reviews')}
              className={`text-xs font-bold pb-2 transition ${
                activeTab === 'reviews' ? 'text-[#2563eb] border-b-2 border-[#2563eb]' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Reviews ({reviews.length})
            </button>
          </div>

          <div className="py-6 text-xs text-slate-600 leading-relaxed">
            {activeTab === 'description' && (
              <div className="space-y-3">
                <p>{description || 'No product description has been provided.'}</p>
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
                      <td className="p-3 text-slate-800">{product.status || (product.stock != null ? (Number(product.stock) > 0 ? 'In Stock' : 'Out of Stock') : 'Not specified')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'shipping' && (
              <div className="space-y-3">
                <p>Delivery methods and estimated arrival times are shown at checkout based on your destination.</p>
                {(storeSettings?.storePages || []).filter(page => page.enabled !== false && /return|refund/i.test(page.title)).map(page => (
                  <a key={page.id} href={`#/store/page/${encodeURIComponent(page.slug)}`} className="block font-semibold text-blue-700 hover:underline">
                    Read {page.title}
                  </a>
                ))}
              </div>
            )}
            {activeTab === 'reviews' && (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
                <section className="space-y-3">
                  {reviewError && <p role="status" className="rounded-lg bg-blue-50 p-3 text-xs text-blue-800">{reviewError}</p>}
                  {reviews.map(review => (
                    <article key={review.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-bold text-slate-800">{review.title || 'Customer review'}</h3>
                        <span className="flex items-center gap-1 text-amber-600"><Star className="h-3.5 w-3.5 fill-current" />{review.rating}/5</span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-slate-600">{review.body}</p>
                      <p className="mt-2 text-[10px] text-slate-400">{review.customerName || 'Verified buyer'} · {review.createdAt ? new Date(review.createdAt).toLocaleDateString() : ''}</p>
                      {review.merchantReply && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600"><strong>Store reply:</strong> {review.merchantReply}</p>}
                    </article>
                  ))}
                  {reviews.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">No approved reviews yet.</p>}
                </section>
                <form onSubmit={submitReview} className="h-fit space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="flex items-center gap-2 font-bold text-slate-800"><MessageSquare className="h-4 w-4 text-blue-600" />Review a delivered purchase</h3>
                  {customerOrders.length ? (
                    <>
                      <label className="block text-[11px] font-semibold text-slate-600">Delivered order
                        <select required value={reviewOrderId} onChange={event => setReviewOrderId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2">
                          <option value="">Choose order</option>
                          {customerOrders.filter(order =>
                            order.status === 'Delivered' &&
                            (order.items || []).some(item => String(item.productId || item.id) === String(product.id))
                          ).map(order => <option key={order.id} value={order.id}>{order.invoiceNumber}</option>)}
                        </select>
                      </label>
                      <label className="block text-[11px] font-semibold text-slate-600">Rating
                        <select value={reviewRating} onChange={event => setReviewRating(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2">
                          {[5, 4, 3, 2, 1].map(value => <option key={value} value={value}>{value} star{value === 1 ? '' : 's'}</option>)}
                        </select>
                      </label>
                      <input value={reviewTitle} onChange={event => setReviewTitle(event.target.value)} maxLength={120} placeholder="Review title (optional)" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs" />
                      <textarea required minLength={10} maxLength={3000} value={reviewBody} onChange={event => setReviewBody(event.target.value)} rows={5} placeholder="Share your experience (10–3000 characters)" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs" />
                      <button disabled={reviewBusy || !customerOrders.some(order =>
                        order.status === 'Delivered' &&
                        (order.items || []).some(item => String(item.productId || item.id) === String(product.id))
                      )} className="w-full rounded-lg bg-blue-600 px-3 py-2.5 text-xs font-bold text-white disabled:opacity-50">{reviewBusy ? 'Submitting…' : 'Submit for moderation'}</button>
                    </>
                  ) : (
                    <div className="space-y-2 text-xs text-slate-500">
                      <p>Sign in with the email used for this store order. Only delivered purchases can be reviewed.</p>
                      <button type="button" onClick={() => onNavigate?.('account')} className="font-bold text-blue-700">Open customer account</button>
                    </div>
                  )}
                </form>
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
                    <span className="text-xs font-black text-slate-900">{formatStoreCurrency(rel.price, storeSettings)}</span>
                    {getProductDiscount(rel) && (
                      <span className="text-[10px] text-slate-400 line-through">{formatStoreCurrency(getProductDiscount(rel).originalPrice, storeSettings)}</span>
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
