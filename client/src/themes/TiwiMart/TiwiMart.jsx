import React, { useState, useEffect, useMemo } from 'react';
import { StoreSettingsProvider } from '../../context/StoreSettingsContext';
import TopUtilityBar from './components/TopUtilityBar';
import MainHeader from './components/MainHeader';
import NavigationBar from './components/NavigationBar';
import HeroSection from './components/HeroSection';
import TrustBadgesBar from './components/TrustBadgesBar';
import FeaturedCategoriesSection from './components/FeaturedCategoriesSection';
import TodaysDealsSection from './components/TodaysDealsSection';
import TopRatedSellersSection from './components/TopRatedSellersSection';
import TiwiFooter from './components/TiwiFooter';
import TiwiMobileNav from './components/TiwiMobileNav';

// Dedicated Standalone Pages (ZERO POPUPS)
import ProductDetailPage from './pages/ProductDetailPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import OrderSuccessPage from './pages/OrderSuccessPage';

function TiwiMartContent({
  products = [],
  categories = [],
  suppliers = [],
  onOpenAdmin,
  showToast
}) {
  // -------------------------------------------------------------
  // FLASH / HASH ROUTING ENGINE FOR DEDICATED PAGES (ZERO POPUPS)
  // -------------------------------------------------------------
  const parseCurrentRoute = () => {
    const hash = window.location.hash || '';
    const search = new URLSearchParams(window.location.search);

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
    if (hash.startsWith('#/store/order-success/')) {
      const orderId = hash.replace('#/store/order-success/', '').trim();
      return { page: 'order-success', params: { orderId } };
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
    } else if (page === 'order-success') {
      newHash = `#/store/order-success/${params.orderId || 'success'}`;
      if (params.order) setLastPlacedOrder(params.order);
    }

    window.location.hash = newHash;
    setRouteState({ page, params });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // -------------------------------------------------------------
  // CART STATE - 100% FRESH & EMPTY BY DEFAULT (ZERO PRE-ADDED ITEMS)
  // -------------------------------------------------------------
  const [cartItems, setCartItems] = useState([]);

  // Wishlist state
  const [wishlist, setWishlist] = useState([]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [activeSpecialFilter, setActiveSpecialFilter] = useState('');
  const [heroSearch, setHeroSearch] = useState('');

  // Cart Handlers
  const handleAddToCart = (product, qty = 1) => {
    setCartItems(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.id === product.id ? { ...item, quantity: item.quantity + qty } : item
        );
      }
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          sku: product.sku,
          price: product.price,
          quantity: qty,
          image: product.image || product.images?.[0]
        }
      ];
    });
    showToast?.(`Added ${qty}x "${product.name}" to cart!`, 'success');
  };

  const handleUpdateCartQty = (id, newQty) => {
    if (newQty <= 0) {
      handleRemoveCartItem(id);
      return;
    }
    setCartItems(prev => prev.map(item => item.id === id ? { ...item, quantity: newQty } : item));
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

    return list;
  }, [products, selectedCategory, searchQuery]);

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
          onOpenAdmin={onOpenAdmin}
          onTrackOrder={() => navigateTo('cart')}
          onOpenAuth={(mode) => alert(`${mode === 'register' ? 'Registering' : 'Sign in'} customer account...`)}
        />

        {/* 2. Main Header (Logo, Search, Wishlist, Cart Count 0 Fresh, Account) */}
        <MainHeader
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          categories={categories}
          cartCount={cartItems.reduce((acc, item) => acc + item.quantity, 0)}
          wishlistCount={wishlist.length}
          onOpenCart={() => navigateTo('cart')}
          onOpenWishlist={() => showToast?.(`Saved Items: ${wishlist.length}`)}
          onOpenAccount={() => alert('Logged in as Verified Customer / Storefront Shopper')}
        />

        {/* 3. Sub-Navigation Menu */}
        <NavigationBar
          onSelectCategory={(cat) => {
            setSelectedCategory(cat);
            if (routeState.page !== 'home') navigateTo('home');
          }}
          onFilterSpecial={(filterId) => {
            setActiveSpecialFilter(filterId);
            if (routeState.page !== 'home') navigateTo('home');
            if (filterId === 'hot-deals') {
              setSelectedCategory('All Categories');
              showToast?.('Displaying all active Hot Deals!');
            }
          }}
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
            product={currentProduct}
            products={products}
            onAddToCart={handleAddToCart}
            onBuyNow={() => navigateTo('checkout')}
            onNavigate={navigateTo}
            showToast={showToast}
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

        {/* D. ORDER CONFIRMATION / SUCCESS PAGE */}
        {routeState.page === 'order-success' && (
          <OrderSuccessPage
            order={lastPlacedOrder}
            onNavigate={navigateTo}
            onOpenAdmin={onOpenAdmin}
          />
        )}

        {/* E. STOREFRONT HOME PAGE */}
        {routeState.page === 'home' && (
          <>
            {/* 4. Hero Section: Left categories menu, Center Sliding Banner System, Right 3 Promo Cards */}
            <HeroSection
              categories={categories}
              selectedCategory={selectedCategory}
              onSelectCategory={(cat) => {
                setSelectedCategory(cat);
                showToast?.(`Filtered by category: ${cat}`);
              }}
              heroSearch={heroSearch}
              setHeroSearch={setHeroSearch}
              onHeroSearchSubmit={() => {
                if (heroSearch) setSearchQuery(heroSearch);
              }}
              onShopFlashSale={() => {
                setSelectedCategory('Electronics');
                showToast?.('Viewing Flash Sale Tech & Gadgets');
              }}
              onExploreNewArrivals={() => {
                setSelectedCategory('Electronics');
                showToast?.('Viewing New Arrivals in Titanium Smartphones');
              }}
              onBecomeSeller={() => {
                alert('Seller Central: Join thousands of merchants on TiwloMart!');
              }}
            />

            {/* 5. Trust Badges (5 pillars matching screenshot) */}
            <TrustBadgesBar />

            {/* 6. Featured Categories (8 items matching screenshot) */}
            <FeaturedCategoriesSection
              onSelectCategory={(catName) => {
                setSelectedCategory(catName);
                showToast?.(`Filtered: ${catName}`);
              }}
              onViewAllCategories={() => {
                setSelectedCategory('All Categories');
                showToast?.('Showing all catalog categories');
              }}
            />

            {/* 7. Today's Deals (Clicking any product navigates to dedicated Product Detail Page, ZERO popups!) */}
            <TodaysDealsSection
              products={filteredProducts.length > 0 ? filteredProducts : products}
              wishlist={wishlist}
              onToggleWishlist={handleToggleWishlist}
              onAddToCart={handleAddToCart}
              onViewProduct={(prod) => navigateTo('product', { id: prod.id })}
              onViewAllDeals={() => {
                setSelectedCategory('All Categories');
                showToast?.('Showing all special deals');
              }}
            />

            {/* 8. Top Rated Sellers matching screenshot */}
            <TopRatedSellersSection
              sellers={suppliers}
              onSelectSeller={(seller) => {
                showToast?.(`Viewing verified store: ${seller.name} (${seller.shipsFrom})`);
              }}
              onViewAllSellers={() => {
                showToast?.('Viewing all verified global multi-vendor sellers');
              }}
            />
          </>
        )}
      </div>

      {/* Global Footer */}
      <TiwiFooter />

      {/* Mobile Sticky Bottom Navigation */}
      <TiwiMobileNav
        cartCount={cartItems.reduce((acc, item) => acc + item.quantity, 0)}
        wishlistCount={wishlist.length}
        onOpenHome={() => navigateTo('home')}
        onOpenCategories={() => {
          if (routeState.page !== 'home') navigateTo('home');
          const el = document.querySelector('section');
          el?.scrollIntoView({ behavior: 'smooth' });
        }}
        onOpenDeals={() => {
          if (routeState.page !== 'home') navigateTo('home');
          const el = document.querySelectorAll('section')?.[3];
          el?.scrollIntoView({ behavior: 'smooth' });
        }}
        onOpenWishlist={() => showToast?.(`Saved Items: ${wishlist.length}`)}
        onOpenCart={() => navigateTo('cart')}
        onOpenAdmin={onOpenAdmin}
      />
    </div>
  );
}

export default function TiwiMart(props) {
  return (
    <StoreSettingsProvider>
      <TiwiMartContent {...props} />
    </StoreSettingsProvider>
  );
}

