import React, { useState, useEffect, useMemo } from 'react';
import { StoreSettingsProvider, useStoreSettings } from '../../context/StoreSettingsContext';
import TopUtilityBar from './components/TopUtilityBar';
import MainHeader from './components/MainHeader';
import NavigationBar from './components/NavigationBar';
import HeroSection from './components/HeroSection';
import FeaturedCategoriesSection from './components/FeaturedCategoriesSection';
import TodaysDealsSection from './components/TodaysDealsSection';
import TiwiFooter from './components/TiwiFooter';
import TiwiMobileNav from './components/TiwiMobileNav';
import { getProductDiscount } from './storefrontUtils';

// Dedicated Standalone Pages (ZERO POPUPS)
import ProductDetailPage from './pages/ProductDetailPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import OrderSuccessPage from './pages/OrderSuccessPage';
import TrackOrderPage from './pages/TrackOrderPage';
import CustomerAccountPage from './pages/CustomerAccountPage';

function readStoredItems(key) {
  try {
    const stored = JSON.parse(window.localStorage.getItem(key) || '[]');
    return Array.isArray(stored) ? stored : [];
  } catch (error) {
    console.error(`Could not restore storefront data for ${key}:`, error);
    return [];
  }
}

function TiwiMartContent({
  products = [],
  categories = [],
  showToast
}) {
  const { storeSettings } = useStoreSettings();
  // -------------------------------------------------------------
  // FLASH / HASH ROUTING ENGINE FOR DEDICATED PAGES (ZERO POPUPS)
  // -------------------------------------------------------------
  const parseCurrentRoute = () => {
    const hash = window.location.hash || '';
    const search = new URLSearchParams(window.location.search);
    const customPageMatch = hash.match(/^#\/store\/page\/([^/?]+)/);
    if (customPageMatch) {
      let slug = customPageMatch[1];
      try {
        slug = decodeURIComponent(slug);
      } catch (error) {
        console.warn('Could not decode storefront page URL:', error);
      }
      return { page: 'custom-page', params: { slug } };
    }

    // Hash pattern: #/store/product/:id
    if (hash.startsWith('#/store/product/')) {
      const id = hash.replace('#/store/product/', '').trim();
      return { page: 'product', params: { id } };
    }
    if (hash === '#/store/cart' || search.get('page') === 'cart') {
      return { page: 'cart', params: {} };
    }
    if (hash === '#/store/checkout' || search.get('page') === 'checkout') {
      return { page: 'checkout', params: {} };
    }
    const trackMatch = hash.match(/^#\/store\/track(?:\?(.*))?$/);
    if (trackMatch || search.get('page') === 'track') {
      const trackParams = new URLSearchParams(trackMatch?.[1] || '');
      return {
        page: 'track',
        params: {
          reference: trackParams.get('reference') || search.get('reference') || '',
          phone: trackParams.get('phone') || search.get('phone') || ''
        }
      };
    }
    if (hash === '#/store/account' || search.get('page') === 'account') {
      return { page: 'account', params: {} };
    }
    const orderSuccessMatch = hash.match(/^#\/store\/order-success\/([^?]+)(?:\?(.*))?$/);
    if (orderSuccessMatch) {
      const successParams = new URLSearchParams(orderSuccessMatch[2] || '');
      let orderId = orderSuccessMatch[1];
      try {
        orderId = decodeURIComponent(orderId);
      } catch (error) {
        console.warn('Could not decode order confirmation URL:', error);
      }
      return {
        page: 'order-success',
        params: {
          orderId,
          receiptToken: successParams.get('receipt') || '',
          paymentState: successParams.get('payment') || ''
        }
      };
    }
    if (search.get('view') === 'product' && search.get('id')) {
      return { page: 'product', params: { id: search.get('id') } };
    }

    return { page: 'home', params: {} };
  };

  const [routeState, setRouteState] = useState(parseCurrentRoute);
  const [selectedProductId, setSelectedProductId] = useState(routeState.params?.id || null);
  const [lastPlacedOrder, setLastPlacedOrder] = useState(null);

  // Sync route on browser back/forward buttons
  useEffect(() => {
    const handleLocationChange = () => {
      const parsed = parseCurrentRoute();
      setRouteState(parsed);
      if (parsed.page === 'product' && parsed.params.id) {
        setSelectedProductId(parsed.params.id);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.addEventListener('hashchange', handleLocationChange);
    window.addEventListener('popstate', handleLocationChange);
    return () => {
      window.removeEventListener('hashchange', handleLocationChange);
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  // Programmatic Page Navigator
  const navigateTo = (page, params = {}) => {
    let newHash = '#/store';
    if (page === 'product' && params.id) {
      newHash = `#/store/product/${params.id}`;
      setSelectedProductId(params.id);
    } else if (page === 'cart') {
      newHash = '#/store/cart';
    } else if (page === 'checkout') {
      newHash = '#/store/checkout';
    } else if (page === 'track') {
      const trackParams = new URLSearchParams();
      if (params.reference) trackParams.set('reference', params.reference);
      if (params.phone) trackParams.set('phone', params.phone);
      const query = trackParams.toString();
      newHash = `#/store/track${query ? `?${query}` : ''}`;
    } else if (page === 'account') {
      newHash = '#/store/account';
    } else if (page === 'order-success') {
      newHash = `#/store/order-success/${params.orderId || 'success'}`;
      const successParams = new URLSearchParams();
      if (params.receiptToken) successParams.set('receipt', params.receiptToken);
      if (params.paymentState) successParams.set('payment', params.paymentState);
      const successQuery = successParams.toString();
      if (successQuery) newHash += `?${successQuery}`;
      if (params.order) setLastPlacedOrder(params.order);
    } else if (page === 'custom-page' && params.slug) {
      newHash = `#/store/page/${encodeURIComponent(params.slug)}`;
    }

    window.location.hash = newHash;
    setRouteState({ page, params });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // -------------------------------------------------------------
  // CART STATE - 100% FRESH & EMPTY BY DEFAULT (ZERO PRE-ADDED ITEMS)
  // -------------------------------------------------------------
  const storefrontStorageKey = `tiwlo-storefront:${window.location.hostname}`;
  const [cartItems, setCartItems] = useState(() => readStoredItems(`${storefrontStorageKey}:cart`));

  // Wishlist state
  const [wishlist, setWishlist] = useState(() => readStoredItems(`${storefrontStorageKey}:wishlist`));

  useEffect(() => {
    try {
      window.localStorage.setItem(`${storefrontStorageKey}:cart`, JSON.stringify(cartItems));
    } catch (error) {
      console.error('Could not save storefront cart:', error);
    }
  }, [cartItems, storefrontStorageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(`${storefrontStorageKey}:wishlist`, JSON.stringify(wishlist));
    } catch (error) {
      console.error('Could not save storefront wishlist:', error);
    }
  }, [wishlist, storefrontStorageKey]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [activeSpecialFilter, setActiveSpecialFilter] = useState('');

  // Cart Handlers
  const handleAddToCart = (product, qty = 1) => {
    const availableStock = Number(product.stock);
    if (Number.isFinite(availableStock) && availableStock <= 0) {
      showToast?.(`${product.name} is out of stock.`, 'error');
      return false;
    }
    if (Number.isFinite(availableStock) && qty > availableStock) {
      showToast?.(`Only ${availableStock} units are currently available.`, 'error');
    } else {
      showToast?.(`Added ${qty}x "${product.name}" to cart!`, 'success');
    }
    setCartItems(prev => {
      const existing = prev.find(item => item.id === product.id);
      const requestedQuantity = (existing?.quantity || 0) + qty;
      const quantity = Number.isFinite(availableStock)
        ? Math.min(availableStock, requestedQuantity)
        : requestedQuantity;
      if (existing) {
        return prev.map(item =>
          item.id === product.id ? { ...item, quantity } : item
        );
      }
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          sku: product.sku,
          price: product.price,
          quantity,
          image: product.image || product.images?.[0]
        }
      ];
    });
    return true;
  };

  const handleUpdateCartQty = (id, newQty) => {
    if (newQty <= 0) {
      handleRemoveCartItem(id);
      return;
    }
    const product = products.find(item => item.id === id);
    const stock = Number(product?.stock);
    if (Number.isFinite(stock) && stock <= 0) {
      showToast?.('This product is out of stock.', 'error');
      handleRemoveCartItem(id);
      return;
    }
    const quantity = Number.isFinite(stock) ? Math.min(newQty, stock) : newQty;
    if (quantity < newQty) showToast?.(`Only ${quantity} units are currently available.`, 'error');
    setCartItems(prev => prev.map(item => item.id === id ? { ...item, quantity } : item));
  };

  const handleRemoveCartItem = (id) => {
    setCartItems(prev => prev.filter(item => item.id !== id));
    showToast?.('Item removed from cart');
  };

  const handleClearCart = () => {
    setCartItems([]);
    showToast?.('Shopping cart cleared');
  };

  const handleToggleWishlist = (productId) => {
    setWishlist(prev => {
      if (prev.includes(productId)) {
        showToast?.('Removed from wishlist');
        return prev.filter(id => id !== productId);
      } else {
        showToast?.('Saved to wishlist!');
        return [...prev, productId];
      }
    });
  };

  // Filtered Products for search or category selection
  const filteredProducts = useMemo(() => {
    let list = [...products];

    if (selectedCategory && selectedCategory !== 'All Categories') {
      list = list.filter(p => (p.category || '').toLowerCase().includes(selectedCategory.toLowerCase()));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        (p.supplierName || '').toLowerCase().includes(q)
      );
    }

    if (activeSpecialFilter === 'hot-deals') {
      list = list.filter(p => getProductDiscount(p));
    } else if (activeSpecialFilter === 'wishlist') {
      list = list.filter(product => wishlist.includes(product.id));
    }

    return list;
  }, [products, selectedCategory, searchQuery, activeSpecialFilter, wishlist]);

  // Current product object for ProductDetailPage
  const currentProduct = useMemo(() => {
    if (!selectedProductId) return products[0] || null;
    return products.find(p => p.id === selectedProductId) || products[0] || null;
  }, [products, selectedProductId]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-blue-600 selection:text-white pb-16 lg:pb-0 flex flex-col justify-between">
      <div>
        {/* 1. Top Announcement & Utility Bar matching screenshot */}
        <TopUtilityBar
          onTrackOrder={() => navigateTo('track')}
        />

        {/* 2. Main Header (Logo, Search, Wishlist, Cart Count 0 Fresh, Account) */}
        <MainHeader
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedCategory={selectedCategory}
          setSelectedCategory={(category) => {
            setSelectedCategory(category);
            setActiveSpecialFilter('');
          }}
          categories={categories}
          cartCount={cartItems.reduce((acc, item) => acc + item.quantity, 0)}
          wishlistCount={wishlist.length}
          onOpenCart={() => navigateTo('cart')}
          onOpenAccount={() => navigateTo('account')}
          onOpenWishlist={() => {
            setActiveSpecialFilter('wishlist');
            setSelectedCategory('All Categories');
            if (routeState.page !== 'home') navigateTo('home');
          }}
          onNavigateHome={() => {
            if (routeState.page !== 'home') navigateTo('home');
          }}
        />

        {/* 3. Sub-Navigation Menu */}
        <NavigationBar
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={(cat) => {
            setSelectedCategory(cat);
            setActiveSpecialFilter('');
            if (routeState.page !== 'home') navigateTo('home');
          }}
          onFilterSpecial={(filterId) => {
            setActiveSpecialFilter(filterId);
            setSelectedCategory('All Categories');
            if (routeState.page !== 'home') navigateTo('home');
          }}
          onOpenPage={slug => navigateTo('custom-page', { slug })}
          activeFilter={activeSpecialFilter}
        />

        {/* Search feedback row */}
        {searchQuery && routeState.page === 'home' && (
          <div className="max-w-[1440px] mx-auto px-4 lg:px-8 pt-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center justify-between">
              <p className="text-xs font-bold text-blue-900">
                Showing {filteredProducts.length} results for: "<span className="text-blue-600">{searchQuery}</span>"
              </p>
              <button
                onClick={() => setSearchQuery('')}
                className="text-xs font-bold text-blue-600 hover:underline"
              >
                Clear Search
              </button>
            </div>
          </div>
        )}

        {/* ============================================================= */}
        {/* DEDICATED ROUTED PAGES (ZERO POPUPS)                           */}
        {/* ============================================================= */}

        {/* A. PRODUCT DETAILS PAGE */}
        {routeState.page === 'product' && (
          <ProductDetailPage
            key={currentProduct?.id}
            product={currentProduct}
            products={products}
            isWishlisted={wishlist.includes(currentProduct?.id)}
            onToggleWishlist={handleToggleWishlist}
            onSelectCategory={(category) => {
              setSelectedCategory(category);
              setActiveSpecialFilter('');
              navigateTo('home');
            }}
            onAddToCart={handleAddToCart}
            onBuyNow={() => navigateTo('checkout')}
            onNavigate={navigateTo}
          />
        )}

        {/* B. SHOPPING CART PAGE */}
        {routeState.page === 'cart' && (
          <CartPage
            cartItems={cartItems}
            onUpdateQty={handleUpdateCartQty}
            onRemoveItem={handleRemoveCartItem}
            onClearCart={handleClearCart}
            onNavigate={navigateTo}
            showToast={showToast}
          />
        )}

        {/* C. CHECKOUT & PAYMENT PAGE */}
        {routeState.page === 'checkout' && (
          <CheckoutPage
            cartItems={cartItems}
            onNavigate={navigateTo}
            onOrderCompleted={(order) => {
              setLastPlacedOrder(order);
              setCartItems([]);
            }}
            showToast={showToast}
          />
        )}

        {routeState.page === 'track' && (
          <TrackOrderPage
            key={`${routeState.params?.reference || ''}:${routeState.params?.phone || ''}`}
            onNavigate={navigateTo}
            initialReference={routeState.params?.reference || ''}
            initialPhone={routeState.params?.phone || ''}
          />
        )}

        {routeState.page === 'account' && (
          <CustomerAccountPage onNavigate={navigateTo} showToast={showToast} />
        )}

        {/* D. ORDER CONFIRMATION / SUCCESS PAGE */}
        {routeState.page === 'order-success' && (
          <OrderSuccessPage
            key={routeState.params?.orderId || 'order-success'}
            order={lastPlacedOrder}
            orderId={routeState.params?.orderId}
            receiptToken={routeState.params?.receiptToken}
            paymentState={routeState.params?.paymentState}
            onNavigate={navigateTo}
          />
        )}

        {routeState.page === 'custom-page' && (() => {
          const page = (storeSettings?.storePages || []).find(item =>
            item.enabled !== false && item.slug === routeState.params?.slug
          );
          return page ? (
            <main className="mx-auto w-full max-w-5xl px-4 py-10">
              <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
                {page.image && <img src={page.image} alt="" className="mb-8 max-h-[420px] w-full rounded-2xl object-cover" />}
                <h1 className="mb-6 text-3xl font-black text-slate-900">{page.title}</h1>
                <div
                  className="prose prose-slate max-w-none break-words"
                  dangerouslySetInnerHTML={{ __html: page.content || '' }}
                />
              </article>
            </main>
          ) : (
            <main className="mx-auto w-full max-w-3xl px-4 py-16 text-center">
              <h1 className="text-2xl font-bold text-slate-900">Page not found</h1>
              <button type="button" onClick={() => navigateTo('home')} className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Back to store</button>
            </main>
          );
        })()}

        {/* E. STOREFRONT HOME PAGE */}
        {routeState.page === 'home' && (
          <>
            {/* 4. Hero Section: Left categories menu, Center Sliding Banner System, Right 3 Promo Cards */}
            <HeroSection />

            {/* 6. Featured Categories (8 items matching screenshot) */}
            <FeaturedCategoriesSection
              categories={categories}
              onSelectCategory={(catName) => {
                setSelectedCategory(catName);
                setActiveSpecialFilter('');
                showToast?.(`Filtered: ${catName}`);
              }}
              onViewAllCategories={() => {
                setSelectedCategory('All Categories');
                showToast?.('Showing all catalog categories');
              }}
            />

            {/* 7. Today's Deals (Clicking any product navigates to dedicated Product Detail Page, ZERO popups!) */}
            {filteredProducts.length ? (
              <TodaysDealsSection
                products={filteredProducts}
                wishlist={wishlist}
                onToggleWishlist={handleToggleWishlist}
                onAddToCart={handleAddToCart}
                onViewProduct={(prod) => navigateTo('product', { id: prod.id })}
              />
            ) : (
              <p className="max-w-[1440px] mx-auto px-4 lg:px-8 py-8 text-sm text-slate-500">
                {activeSpecialFilter === 'wishlist'
                  ? 'Your wishlist is empty. Save a product with the heart button to see it here.'
                  : 'No products match your search or category.'}
              </p>
            )}

          </>
        )}
      </div>

      {/* Global Footer */}
      <TiwiFooter />

      {/* Mobile Sticky Bottom Navigation */}
      <TiwiMobileNav
        cartCount={cartItems.reduce((acc, item) => acc + item.quantity, 0)}
        wishlistCount={wishlist.length}
        onOpenHome={() => {
          setActiveSpecialFilter('');
          setSelectedCategory('All Categories');
          navigateTo('home');
        }}
        onOpenCategories={() => {
          if (routeState.page !== 'home') navigateTo('home');
          window.setTimeout(() => {
            document.getElementById('store-categories')?.scrollIntoView({ behavior: 'smooth' });
          }, 0);
        }}
        onOpenDeals={() => {
          setActiveSpecialFilter('hot-deals');
          setSelectedCategory('All Categories');
          if (routeState.page !== 'home') navigateTo('home');
          window.setTimeout(() => {
            document.getElementById('store-products')?.scrollIntoView({ behavior: 'smooth' });
          }, 0);
        }}
        onOpenWishlist={() => {
          setActiveSpecialFilter('wishlist');
          setSelectedCategory('All Categories');
          if (routeState.page !== 'home') navigateTo('home');
        }}
        onOpenCart={() => navigateTo('cart')}
      />
    </div>
  );
}

export default function TiwiMart({ storeSettings, ...props }) {
  return (
    <StoreSettingsProvider initialSettings={storeSettings}>
      <TiwiMartContent {...props} />
    </StoreSettingsProvider>
  );
}
