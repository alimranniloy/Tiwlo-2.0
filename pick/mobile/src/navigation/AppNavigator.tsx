import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, BackHandler, AppState, Linking } from 'react-native';
import { useNetworkState } from 'expo-network';
import { SplashScreen } from '../screens/1_SplashScreen';
import { AuthScreen } from '../screens/2_AuthScreen';
import { AddressVerificationScreen } from '../screens/AddressVerificationScreen';
import { AccountDisabledScreen } from '../screens/AccountDisabledScreen';
import { LocationPermissionScreen } from '../screens/3_LocationPermissionScreen';
import { CoverageAvailableScreen } from '../screens/CoverageAvailableScreen';
import { CoverageUnavailableScreen } from '../screens/CoverageUnavailableScreen';
import { NoNetworkScreen } from '../screens/NoNetworkScreen';
import { ParcelLandingScreen } from '../screens/ParcelLandingScreen';
import { RainDelayScreen } from '../screens/RainDelayScreen';
import { HomeScreen } from '../screens/5_HomeScreen';
import { SendParcelScreen, VehicleOption } from '../screens/6_SendParcelScreen';
import { ParcelPackageDetailsScreen, PackageDetailsData } from '../screens/parcel/ParcelPackageDetailsScreen';
import { ParcelRecipientScreen, RecipientData } from '../screens/parcel/ParcelRecipientScreen';
import { ParcelLocationPickerScreen, ParcelLocationKind } from '../screens/parcel/ParcelLocationPickerScreen';
import { ParcelReviewScreen } from '../screens/parcel/ParcelReviewScreen';
import { FoodRestaurantsScreen } from '../screens/7_FoodRestaurantsScreen';
import { ProductDetailScreen } from '../screens/8_ProductDetailScreen';
import { CheckoutScreen } from '../screens/9_CheckoutScreen';
import { OrderTrackingScreen } from '../screens/10_OrderTrackingScreen';
import { OrdersScreen } from '../screens/11_OrdersScreen';
import { WalletScreen } from '../screens/12_WalletScreen';
import { ProfileScreen } from '../screens/13_ProfileScreen';
import {
  clearStoredPickSession,
  getPendingAuthChallenge,
  getStoredPickSession,
  PickAccountDisabledError,
  PickAccountRestoredError,
  PickUser
} from '../services/auth';
import { CatalogData, getCatalog } from '../services/catalog';
import {
  CartEntry,
  PaymentMethod,
  PaymentProvider,
  PickOrder,
  createGroceryOrder,
  getGroceryDeliveryFee,
  getOrders,
  getPaymentProviders
} from '../services/orders';
import { createParcelOrder, getParcelVehicles, ParcelVehicle } from '../services/parcels';
import {
  DeliveryCoverage,
  getSavedDeliveryCoverage,
  joinCoverageWaitlist,
  setCurrentDeliveryLocation
} from '../services/location';
import { openPickPaymentCheckout } from '../services/payments';
import { WarningSheet } from '../components/common/WarningSheet';

export type ScreenKey =
  | 'splash'
  | 'auth'
  | 'account_disabled'
  | 'address_verification'
  | 'location_permission'
  | 'location_success'
  | 'coverage_unavailable'
  | 'rain_delay'
  | 'home'
  | 'parcel_intro'
  | 'send_parcel'
  | 'parcel_package_details'
  | 'parcel_recipient'
  | 'parcel_location_picker'
  | 'parcel_review'
  | 'food_restaurants'
  | 'product_detail'
  | 'checkout'
  | 'order_tracking'
  | 'orders'
  | 'wallet'
  | 'profile';

export const AppNavigator: React.FC = () => {
  const networkState = useNetworkState();
  const isOffline =
    networkState.isConnected === false ||
    networkState.isInternetReachable === false;
  const [history, setHistory] = useState<ScreenKey[]>(['splash']);
  const [warning, setWarning] = useState<{ title: string; message: string } | null>(null);
  const [user, setUser] = useState<PickUser | null>(null);
  const [appIsActive, setAppIsActive] = useState(AppState.currentState === 'active');
  const [deliveryCoverage, setDeliveryCoverage] = useState<DeliveryCoverage | null>(null);
  const [waitlistJoined, setWaitlistJoined] = useState(false);
  const [waitlistJoining, setWaitlistJoining] = useState(false);
  const [waitlistError, setWaitlistError] = useState('');
  const [catalog, setCatalog] = useState<CatalogData>({
    categories: [{ id: 'all', titleEn: 'All', titleBn: 'সব' }],
    products: []
  });
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [deliveryFee, setDeliveryFee] = useState<number | null>(null);
  const [paymentProviders, setPaymentProviders] = useState<PaymentProvider[]>([]);
  const [paymentProvidersLoading, setPaymentProvidersLoading] = useState(false);
  const [orders, setOrders] = useState<PickOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [parcelVehicles, setParcelVehicles] = useState<ParcelVehicle[]>([]);
  const [parcelVehiclesLoading, setParcelVehiclesLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);

  const [packageData, setPackageData] = useState<PackageDetailsData>({
    categoryId: 'docs',
    categoryName: 'কাগজপত্র ও ফাইল',
    weight: 0.5,
    value: 0,
    handleWithCare: true,
    keepUpright: false,
    directHandover: true,
    notes: '',
  });

  const [recipientData, setRecipientData] = useState<RecipientData>({
    senderName: '',
    senderPhone: '',
    senderAddress: '',
    senderLatitude: null,
    senderLongitude: null,
    senderFloor: '',
    recipientName: '',
    recipientPhone: '',
    recipientAddress: '',
    recipientLatitude: null,
    recipientLongitude: null,
    recipientFloor: '',
    requirePin: true,
    whoPays: 'sender',
    photoProof: true,
  });

  const [selectedVehicle, setSelectedVehicle] = useState<VehicleOption | null>(null);
  const [editingParcelLocation, setEditingParcelLocation] = useState<ParcelLocationKind>('pickup');

  const currentScreen = history[history.length - 1] ?? 'home';
  const currentUserId = user?.id;
  const showNotice = useCallback((title: string, message: string) => {
    setWarning({ title, message });
  }, []);

  const handleContactSupport = useCallback(() => {
    void Linking.openURL('mailto:support@tiwlo.com?subject=Help%20with%20PICK')
      .catch(() => showNotice(
        'Email app unavailable',
        'Please email support@tiwlo.com from your preferred email app.'
      ));
  }, [showNotice]);

  const replaceScreen = useCallback((screen: ScreenKey) => {
    setHistory([screen]);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setAppIsActive(state === 'active');
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let active = true;
    getPendingAuthChallenge()
      .then((challenge) => {
        if (active && challenge) replaceScreen('auth');
      })
      .catch((error: unknown) => {
        console.error('Could not restore pending PICK sign-in verification:', error);
      });
    return () => {
      active = false;
    };
  }, [replaceScreen]);

  const updateCart = (item: CartEntry) => {
    setCart((current) => {
      const remaining = current.filter((entry) => entry.productId !== item.productId);
      return item.quantity > 0 ? [...remaining, item] : remaining;
    });
  };

  useEffect(() => {
    if (isOffline || currentScreen !== 'checkout' || !user) return;
    let active = true;
    getGroceryDeliveryFee()
      .then((fee) => {
        if (active) setDeliveryFee(fee);
      })
      .catch((error) => {
        if (active) {
          showNotice(
            'Checkout unavailable',
            error instanceof Error ? error.message : 'Delivery pricing could not be loaded.'
          );
        }
      });
    return () => {
      active = false;
    };
  }, [currentScreen, isOffline, showNotice, user]);

  useEffect(() => {
    if (isOffline ||
        !['orders', 'order_tracking', 'parcel_intro'].includes(currentScreen) ||
        !user) return;
    let active = true;
    getOrders()
      .then((result) => {
        if (active) setOrders(result);
      })
      .catch((error) => {
        if (active) {
          showNotice(
            'Orders unavailable',
            error instanceof Error ? error.message : 'Could not load your orders.'
          );
        }
      })
      .finally(() => {
        if (active) setOrdersLoading(false);
      });
    return () => {
      active = false;
    };
  }, [currentScreen, isOffline, showNotice, user]);

  useEffect(() => {
    if (isOffline || !user ||
        !['checkout', 'parcel_review', 'wallet'].includes(currentScreen)) return;
    let active = true;
    getPaymentProviders()
      .then((providers) => {
        if (active) setPaymentProviders(providers);
      })
      .catch((error) => {
        if (active) {
          showNotice(
            'Payment methods unavailable',
            error instanceof Error ? error.message : 'Could not load Tiwlo payment methods.'
          );
        }
      })
      .finally(() => {
        if (active) setPaymentProvidersLoading(false);
      });
    return () => {
      active = false;
    };
  }, [currentScreen, isOffline, showNotice, user]);

  useEffect(() => {
    if (isOffline || currentScreen !== 'send_parcel' || !user) return;
    let active = true;
    getParcelVehicles()
      .then((result) => {
        if (active) setParcelVehicles(result);
      })
      .catch((error) => {
        if (active) {
          showNotice(
            'Parcel options unavailable',
            error instanceof Error ? error.message : 'Could not load parcel delivery options.'
          );
        }
      })
      .finally(() => {
        if (active) setParcelVehiclesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [currentScreen, isOffline, showNotice, user]);

  useEffect(() => {
    if (isOffline) return;
    let active = true;
    getCatalog()
      .then((result) => {
        if (active) setCatalog(result);
      })
      .catch((error) => {
        if (active) {
          showNotice(
            'Catalog unavailable',
            error instanceof Error ? error.message : 'Could not load products from PICK.'
          );
        }
      })
      .finally(() => {
        if (active) setCatalogLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isOffline, showNotice]);

  const navigate = useCallback((screen: ScreenKey) => {
    if (currentScreen === screen) return;
    if (screen === 'checkout') setDeliveryFee(null);
    if (screen === 'orders' || screen === 'order_tracking' || screen === 'parcel_intro') {
      setOrdersLoading(true);
    }
    if (['checkout', 'parcel_review', 'wallet'].includes(screen)) {
      setPaymentProvidersLoading(true);
      setPaymentProviders([]);
    }
    if (screen === 'send_parcel') setParcelVehiclesLoading(true);

    if (['home', 'orders', 'wallet', 'profile'].includes(screen)) {
      // Switching primary tabs: keep home as anchor
      setHistory((prev) => {
        const withoutTarget = prev.filter((s) => s !== screen);
        return [...withoutTarget, screen];
      });
    } else {
      setHistory((prev) => [...prev, screen]);
    }
  }, [currentScreen]);

  const goBack = () => {
    if (history.length > 1) {
      setHistory((prev) => prev.slice(0, prev.length - 1));
      return true;
    }
    return false;
  };

  // Hardware Back Button Handler for Android
  useEffect(() => {
    const onBackPress = () => {
      if (history.length > 1) {
        setHistory((prev) => prev.slice(0, prev.length - 1));
        return true; // Successfully intercepted: does NOT exit app!
      }
      return false; // Exit only when on initial screen
    };

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      onBackPress
    );

    return () => subscription.remove();
  }, [history]);

  const handleTabPress = (tab: string) => {
    switch (tab) {
      case 'home':
        navigate('home');
        break;
      case 'orders':
        navigate('orders');
        break;
      case 'wallet':
        navigate('wallet');
        break;
      case 'profile':
        navigate('profile');
        break;
      case 'parcel':
        navigate('parcel_intro');
        break;
      default:
        navigate('home');
    }
  };

  const routeSignedInUser = useCallback(async (signedInUser: PickUser) => {
    setUser(signedInUser);
    setRecipientData((current) => ({
      ...current,
      senderName: signedInUser.name,
      senderPhone: signedInUser.phone,
      senderAddress: signedInUser.deliveryAddress,
      senderLatitude: signedInUser.deliveryLatitude,
      senderLongitude: signedInUser.deliveryLongitude
    }));
    if (signedInUser.isBanned) {
      replaceScreen('account_disabled');
      return;
    }
    if (!signedInUser.deliveryAddressVerified) {
      replaceScreen('address_verification');
      return;
    }
    try {
      const savedCoverage = await getSavedDeliveryCoverage();
      if (!savedCoverage.hasLocation || !savedCoverage.coverage) {
        replaceScreen('location_permission');
        return;
      }
      setDeliveryCoverage(savedCoverage.coverage);
      replaceScreen(savedCoverage.coverage.available ? 'rain_delay' : 'coverage_unavailable');
    } catch (error) {
      showNotice(
        'Coverage unavailable',
        error instanceof Error ? error.message : 'Could not refresh your delivery coverage.'
      );
      replaceScreen('location_permission');
    }
  }, [replaceScreen, showNotice]);

  const handlePickAuthentication = (signedInUser: PickUser) => {
    void routeSignedInUser(signedInUser);
  };

  const handleAccountRestored = useCallback(async (
    restoredUser: PickUser,
    requiresSignIn = false
  ) => {
    if (requiresSignIn) {
      setUser(null);
      setHistory(['auth']);
      showNotice(
        'Account restored',
        'Your Tiwlo account is active again. Please sign in to continue.'
      );
      return;
    }
    await routeSignedInUser(restoredUser);
  }, [routeSignedInUser, showNotice]);

  const handleAddressVerificationComplete = (result: {
    user: PickUser;
    coverage: DeliveryCoverage;
  }) => {
    setUser(result.user);
    setDeliveryCoverage(result.coverage);
    setWaitlistJoined(false);
    setWaitlistError('');
    setRecipientData((current) => ({
      ...current,
      senderAddress: result.user.deliveryAddress,
      senderLatitude: result.user.deliveryLatitude,
      senderLongitude: result.user.deliveryLongitude
    }));
    replaceScreen(result.coverage.available ? 'location_success' : 'coverage_unavailable');
  };

  const handleSplashNext = async () => {
    try {
      const session = await getStoredPickSession();
      if (session) {
        setUser(session.user);
        setRecipientData((current) => ({
          ...current,
          senderName: session.user.name,
          senderPhone: session.user.phone,
          senderAddress: session.user.deliveryAddress,
          senderLatitude: session.user.deliveryLatitude,
          senderLongitude: session.user.deliveryLongitude
        }));
        await routeSignedInUser(session.user);
      } else {
        replaceScreen('auth');
      }
    } catch (error) {
      if (error instanceof PickAccountDisabledError) {
        setUser(error.user);
        setHistory(['account_disabled']);
        return;
      }
      if (error instanceof PickAccountRestoredError) {
        setUser(null);
        setHistory(['auth']);
        showNotice(
          'Account restored',
          'Your Tiwlo account is active again. Please sign in to continue.'
        );
        return;
      }
      showNotice(
        'Connection error',
        error instanceof Error ? error.message : 'Could not load your Tiwlo account.'
      );
    }
  };

  useEffect(() => {
    if (
      isOffline ||
      !appIsActive ||
      !currentUserId ||
      ['splash', 'auth', 'account_disabled'].includes(currentScreen)
    ) return;
    let active = true;
    let checking = false;
    const refreshAccountAndCoverage = async () => {
      if (!active || checking) return;
      checking = true;
      try {
        const session = await getStoredPickSession();
        if (!active) return;
        if (!session) {
          setUser(null);
          setHistory(['auth']);
          return;
        }
        if (!session.user.deliveryAddressVerified) {
          setHistory(['address_verification']);
          return;
        }
        const savedCoverage = await getSavedDeliveryCoverage();
        if (!active) return;
        if (!savedCoverage.hasLocation || !savedCoverage.coverage) {
          if (currentScreen === 'home') setHistory(['location_permission']);
          return;
        }
        setDeliveryCoverage(savedCoverage.coverage);
        if (!savedCoverage.coverage.available && currentScreen !== 'coverage_unavailable') {
          setHistory(['coverage_unavailable']);
        } else if (savedCoverage.coverage.available && currentScreen === 'coverage_unavailable') {
          setHistory(['rain_delay']);
        }
      } catch (error) {
        if (error instanceof PickAccountDisabledError) {
          setUser(error.user);
          setHistory(['account_disabled']);
        } else if (active) {
          console.error('Could not refresh PICK account and coverage status:', error);
        }
      } finally {
        checking = false;
      }
    };
    const timer = setInterval(() => void refreshAccountAndCoverage(), 15000);
    void refreshAccountAndCoverage();
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [appIsActive, currentScreen, currentUserId, isOffline]);

  const handleUseLocation = async () => {
    if (locationLoading) return;
    setLocationLoading(true);
    try {
      const location = await setCurrentDeliveryLocation();
      const { coverage, ...address } = location;
      setDeliveryCoverage(coverage);
      setWaitlistJoined(false);
      setWaitlistError('');
      setUser((current) => current ? { ...current, ...address } : current);
      setRecipientData((current) => ({
        ...current,
        senderAddress: address.deliveryAddress,
        senderLatitude: address.deliveryLatitude,
        senderLongitude: address.deliveryLongitude
      }));
      replaceScreen(coverage.available ? 'location_success' : 'coverage_unavailable');
    } catch (error) {
      showNotice(
        'Location unavailable',
        error instanceof Error ? error.message : 'Could not determine your location.'
      );
    } finally {
      setLocationLoading(false);
    }
  };

  const handleJoinCoverageWaitlist = async () => {
    setWaitlistJoining(true);
    setWaitlistError('');
    try {
      await joinCoverageWaitlist();
      setWaitlistJoined(true);
    } catch (error) {
      setWaitlistError(
        error instanceof Error ? error.message : 'Could not join the coverage waitlist.'
      );
    } finally {
      setWaitlistJoining(false);
    }
  };

  const finishOrderSubmission = async (
    order: PickOrder & { checkoutUrl?: string },
    isGrocery: boolean
  ) => {
    let checkoutError: unknown = null;
    if (order.checkoutUrl && order.paymentProvider) {
      const provider = paymentProviders.find((item) => item.id === order.paymentProvider);
      if (!provider) {
        checkoutError = new Error('This payment method is no longer available.');
      } else {
        try {
          await openPickPaymentCheckout(order.checkoutUrl, provider.id);
        } catch (error) {
          checkoutError = error;
        }
      }
    }
    if (isGrocery) setCart([]);
    setSelectedOrderId(order.id);
    setOrders((current) => [order, ...current.filter((item) => item.id !== order.id)]);
    navigate('order_tracking');
    try {
      setOrders(await getOrders());
    } catch (error) {
      showNotice(
        'Order placed',
        error instanceof Error
          ? `The order was placed, but its latest status could not be loaded: ${error.message}`
          : 'The order was placed, but its latest status could not be loaded.'
      );
      return;
    }
    if (checkoutError) {
      showNotice(
        'Payment pending',
        checkoutError instanceof Error
          ? `The order is saved as pending payment. ${checkoutError.message}`
          : 'The order is saved as pending payment. Reopen PICK to check its status.'
      );
    }
  };

  const handlePlaceGroceryOrder = async (paymentMethod: PaymentMethod) => {
    try {
      const order = await createGroceryOrder(cart, paymentMethod);
      await finishOrderSubmission(order, true);
    } catch (error) {
      showNotice(
        'Order not placed',
        error instanceof Error ? error.message : 'Could not place your order.'
      );
    }
  };

  const handlePlaceParcelOrder = async (paymentMethod: PaymentMethod) => {
    if (!selectedVehicle) {
      showNotice('Parcel unavailable', 'Select a configured parcel vehicle first.');
      return;
    }
    try {
      const order = await createParcelOrder({
        vehicleId: selectedVehicle.id,
        paymentMethod,
        package: packageData,
        recipient: {
          senderName: recipientData.senderName,
          senderPhone: recipientData.senderPhone,
          name: recipientData.recipientName,
          phone: recipientData.recipientPhone,
          address: recipientData.recipientAddress,
          latitude: recipientData.recipientLatitude,
          longitude: recipientData.recipientLongitude,
          floor: recipientData.recipientFloor,
          senderAddress: recipientData.senderAddress,
          senderLatitude: recipientData.senderLatitude,
          senderLongitude: recipientData.senderLongitude,
          senderFloor: recipientData.senderFloor,
          requirePin: recipientData.requirePin,
          whoPays: recipientData.whoPays,
          photoProof: recipientData.photoProof
        }
      });
      await finishOrderSubmission(order, false);
    } catch (error) {
      showNotice(
        'Parcel order not placed',
        error instanceof Error ? error.message : 'Could not place your parcel order.'
      );
    }
  };

  const renderActiveScreen = () => {
    switch (currentScreen) {
      case 'splash':
        return <SplashScreen onNext={handleSplashNext} />;

      case 'auth':
        return <AuthScreen onAuthenticated={handlePickAuthentication} offline={isOffline} />;

      case 'account_disabled':
        return (
          <AccountDisabledScreen
            user={user}
            onAccountRestored={handleAccountRestored}
            onSignOut={async () => {
              try {
                await clearStoredPickSession();
              } catch (error) {
                showNotice(
                  'Sign-out warning',
                  error instanceof Error ? error.message : 'Could not end the Tiwlo session.'
                );
              } finally {
                setUser(null);
                setHistory(['auth']);
              }
            }}
          />
        );

      case 'address_verification':
        return <AddressVerificationScreen onComplete={handleAddressVerificationComplete} />;

      case 'location_permission':
        return (
          <LocationPermissionScreen
            onAllow={handleUseLocation}
            loading={locationLoading}
          />
        );

      case 'location_success':
        return (
          <CoverageAvailableScreen
            onContinue={() => replaceScreen('rain_delay')}
            onEditLocation={() => navigate('location_permission')}
            address={user?.deliveryAddress || ''}
            areaNameEn={deliveryCoverage?.zone?.nameEn || ''}
            areaNameBn={deliveryCoverage?.zone?.nameBn || ''}
          />
        );

      case 'rain_delay':
        return <RainDelayScreen onContinue={() => replaceScreen('home')} />;

      case 'coverage_unavailable':
        return (
          <CoverageUnavailableScreen
            address={user?.deliveryAddress || ''}
            onJoinWaitlist={handleJoinCoverageWaitlist}
            onChangeLocation={handleUseLocation}
            changingLocation={locationLoading}
            joining={waitlistJoining}
            joined={waitlistJoined}
            error={waitlistError}
          />
        );

      case 'home':
        return (
          <HomeScreen
            deliveryAddress={user?.deliveryAddress || ''}
            categories={catalog.categories}
            products={catalog.products}
            catalogLoading={catalogLoading}
            cart={cart}
            onCartChange={updateCart}
            onSelectCategory={(categoryId) => {
              if (categoryId === 'parcel' || categoryId === 'pickup') {
                navigate('parcel_intro');
              } else {
                setSelectedCategoryId(categoryId);
                navigate('food_restaurants');
              }
            }}
            onOpenRestaurant={(productId) => {
              setSelectedProductId(productId);
              navigate('product_detail');
            }}
            onOpenNotifications={() => navigate('orders')}
            onOpenProfile={() => navigate('profile')}
            onOpenCheckout={() => navigate('checkout')}
            onContactSupport={handleContactSupport}
            onTabPress={handleTabPress}
          />
        );

      case 'parcel_intro': {
        const latestParcel = orders
          .filter((order) => order.orderType === 'parcel')
          .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0] ?? null;
        return (
          <ParcelLandingScreen
            area={user?.deliveryArea || deliveryCoverage?.zone?.nameEn || ''}
            coverageAvailable={deliveryCoverage?.available === true}
            latestParcel={latestParcel}
            loading={ordersLoading}
            onBack={goBack}
            onSendParcel={() => navigate('send_parcel')}
          />
        );
      }

      case 'send_parcel':
        return (
          <SendParcelScreen
            onBack={goBack}
            onOpenLocation={(kind) => {
              setEditingParcelLocation(kind);
              navigate('parcel_location_picker');
            }}
            onOpenRecipient={() => navigate('parcel_recipient')}
            onPackageDataChange={setPackageData}
            onWhoPaysChange={(whoPays) => setRecipientData((current) => ({ ...current, whoPays }))}
            onOpenReview={(vehicle) => {
              setSelectedVehicle(vehicle);
              navigate('parcel_review');
            }}
            vehicles={parcelVehicles}
            vehiclesLoading={parcelVehiclesLoading}
            packageData={packageData}
            recipientData={recipientData}
          />
        );

      case 'parcel_location_picker':
        return (
          <ParcelLocationPickerScreen
            kind={editingParcelLocation}
            initialPin={editingParcelLocation === 'pickup'
              ? {
                  address: recipientData.senderAddress,
                  latitude: recipientData.senderLatitude,
                  longitude: recipientData.senderLongitude,
                }
              : {
                  address: recipientData.recipientAddress,
                  latitude: recipientData.recipientLatitude,
                  longitude: recipientData.recipientLongitude,
                }}
            onBack={goBack}
            onSave={(pin) => {
              if (editingParcelLocation === 'pickup') {
                setRecipientData((current) => ({
                  ...current,
                  senderAddress: pin.address,
                  senderLatitude: pin.latitude,
                  senderLongitude: pin.longitude,
                }));
              } else {
                setRecipientData((current) => ({
                  ...current,
                  recipientAddress: pin.address,
                  recipientLatitude: pin.latitude,
                  recipientLongitude: pin.longitude,
                }));
              }
              goBack();
            }}
          />
        );

      case 'parcel_package_details':
        return (
          <ParcelPackageDetailsScreen
            onBack={goBack}
            initialData={packageData}
            onSave={(updated) => setPackageData(updated)}
          />
        );

      case 'parcel_recipient':
        return (
          <ParcelRecipientScreen
            onBack={goBack}
            initialData={recipientData}
            onSave={(updated) => setRecipientData(updated)}
          />
        );

      case 'parcel_review':
        if (!selectedVehicle) {
          return (
            <SendParcelScreen
              onBack={goBack}
              onOpenLocation={(kind) => {
                setEditingParcelLocation(kind);
                navigate('parcel_location_picker');
              }}
              onOpenRecipient={() => navigate('parcel_recipient')}
              onPackageDataChange={setPackageData}
              onWhoPaysChange={(whoPays) => setRecipientData((current) => ({ ...current, whoPays }))}
              onOpenReview={setSelectedVehicle}
              vehicles={parcelVehicles}
              vehiclesLoading={parcelVehiclesLoading}
              packageData={packageData}
              recipientData={recipientData}
            />
          );
        }
        return (
          <ParcelReviewScreen
            onBack={goBack}
            onConfirmOrder={handlePlaceParcelOrder}
            paymentProviders={paymentProviders}
            packageData={packageData}
            recipientData={recipientData}
            vehicle={selectedVehicle}
          />
        );

      case 'food_restaurants':
        return (
          <FoodRestaurantsScreen
            onBack={goBack}
            categories={catalog.categories}
            products={catalog.products}
            selectedCategoryId={selectedCategoryId}
            cart={cart}
            onCartChange={updateCart}
            onSelectRestaurant={(product) => {
              setSelectedProductId(product.id);
              navigate('product_detail');
            }}
          />
        );

      case 'product_detail':
        return (
          <ProductDetailScreen
            onBack={goBack}
            product={catalog.products.find((product) => product.id === selectedProductId)}
            onAddToCart={(item) => {
              const existingQuantity = cart.find((entry) => entry.productId === item.productId)?.quantity ?? 0;
              updateCart({ ...item, quantity: existingQuantity + item.quantity });
              navigate('checkout');
            }}
          />
        );

      case 'checkout':
        return (
          <CheckoutScreen
            onBack={goBack}
            onPlaceOrder={handlePlaceGroceryOrder}
            onChangeAddress={() => navigate('location_permission')}
            onChangePayment={() => navigate('wallet')}
            address={user?.deliveryAddress || ''}
            products={catalog.products}
            cart={cart}
            deliveryFee={deliveryFee}
            paymentProviders={paymentProviders}
            onCartChange={updateCart}
          />
        );

      case 'order_tracking':
        return (
          <OrderTrackingScreen
            onBack={goBack}
            order={orders.find((order) => order.id === selectedOrderId) ?? null}
          />
        );

      case 'orders':
        return (
          <OrdersScreen
            onBack={goBack}
            orders={orders}
            loading={ordersLoading}
            onTrackOrder={(orderId) => {
              setSelectedOrderId(orderId);
              navigate('order_tracking');
            }}
            onReorder={(order) => {
              const restoredItems = order.items.flatMap((item) => {
                if (!item.productId) return [];
                const product = catalog.products.find((candidate) => candidate.id === item.productId);
                if (!product) return [];
                const unitIndex = product.unitsEn.indexOf(item.unitEn);
                if (unitIndex < 0) return [];
                return [{ productId: product.id, unitIndex, quantity: Number(item.quantity) }];
              });
              if (!restoredItems.length) {
                showNotice('Reorder unavailable', 'Those products are no longer in the PICK catalog.');
                return;
              }
              setCart(restoredItems);
              navigate('checkout');
            }}
            onTabPress={handleTabPress}
          />
        );

      case 'wallet':
        return (
          <WalletScreen
            onBack={goBack}
            onTabPress={handleTabPress}
            paymentProviders={paymentProviders}
            paymentProvidersLoading={paymentProvidersLoading}
          />
        );

      case 'profile':
        return (
          <ProfileScreen
            onBack={goBack}
            onNavigateToWallet={() => navigate('wallet')}
            onNavigateToOrders={() => navigate('orders')}
            user={user}
            onSignOut={async () => {
              try {
                await clearStoredPickSession();
              } catch (error) {
                showNotice(
                  'Sign-out warning',
                  error instanceof Error ? error.message : 'Could not end the Tiwlo session.'
                );
              } finally {
                setUser(null);
                setCart([]);
                setOrders([]);
                setSelectedOrderId(null);
                setSelectedVehicle(null);
                setRecipientData({
                  senderName: '',
                  senderPhone: '',
                  senderAddress: '',
                  senderLatitude: null,
                  senderLongitude: null,
                  senderFloor: '',
                  recipientName: '',
                  recipientPhone: '',
                  recipientAddress: '',
                  recipientLatitude: null,
                  recipientLongitude: null,
                  recipientFloor: '',
                  requirePin: true,
                  whoPays: 'sender',
                  photoProof: true
                });
                setHistory(['auth']);
              }
            }}
            onTabPress={handleTabPress}
          />
        );

      default:
        return (
          <HomeScreen
            deliveryAddress={user?.deliveryAddress || ''}
            categories={catalog.categories}
            products={catalog.products}
            catalogLoading={catalogLoading}
            cart={cart}
            onCartChange={updateCart}
            onSelectCategory={() => navigate('food_restaurants')}
            onOpenRestaurant={(productId) => {
              setSelectedProductId(productId);
              navigate('product_detail');
            }}
            onContactSupport={handleContactSupport}
          />
        );
    }
  };

  return (
    <View style={styles.root}>
      {isOffline && currentScreen !== 'auth' ? (
        <NoNetworkScreen />
      ) : (
        <View style={styles.screenWrapper}>{renderActiveScreen()}</View>
      )}
      <WarningSheet
        visible={warning !== null}
        title={warning?.title || ''}
        message={warning?.message || ''}
        onDismiss={() => setWarning(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  screenWrapper: {
    flex: 1,
  },
});
