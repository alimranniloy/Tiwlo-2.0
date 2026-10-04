import React, { useState, useEffect, useRef, Component } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, StatusBar, BackHandler, ActivityIndicator } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { BlurTargetView } from 'expo-blur';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import AuthScreen from './src/screens/AuthScreen';
import BottomNavBar from './src/components/BottomNavBar';
import { getActiveTopBarTheme } from './src/config/layout';
import TiwiNotificationBanner from './src/components/TiwiNotificationBanner';
import { requestInitialAppPermissions } from './src/utils/permissions';

class GlobalErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.warn('[GlobalErrorBoundary caught]:', error, errorInfo);
  }

  handleRestart = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#FCE8E6', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 32, color: '#B3261E', fontWeight: 'bold' }}>!</Text>
          </View>
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#1F1F1F', marginBottom: 8, textAlign: 'center' }}>
            Something went wrong
          </Text>
          <Text style={{ fontSize: 13.5, color: '#444746', marginBottom: 24, textAlign: 'center', lineHeight: 20 }}>
            {this.state.error?.message || 'An unexpected issue occurred. Tap below to reload.'}
          </Text>
          <TouchableOpacity
            onPress={this.handleRestart}
            style={{ backgroundColor: '#0B57D0', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 24 }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>Reload Tiwi</Text>
          </TouchableOpacity>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

// Lazy screen loader to ensure cold-start is instant and never crashes on unauthenticated launch
const screenLoaders = {
  feed: () => require('./src/screens/FeedScreen').default,
  search: () => require('./src/screens/SearchScreen').default,
  reels: () => require('./src/screens/ReelsScreen').default,
  notifications: () => require('./src/screens/NotificationsScreen').default,
  messages: () => require('./src/screens/MessagesScreen').default,
  profile: () => require('./src/screens/ProfileScreen').default,
  settings: () => require('./src/screens/ProfileSettingsScreen').default,
  'edit-profile': () => require('./src/screens/EditProfileScreen').default,
  more: () => require('./src/screens/MoreScreen').default,

  // 15 Dedicated Modular Screens (Page-NoPopup Rule)
  'followers-list': () => require('./src/screens/FollowersListScreen').default,
  'following-list': () => require('./src/screens/FollowingListScreen').default,
  bookmarks: () => require('./src/screens/BookmarksScreen').default,
  'post-detail': () => require('./src/screens/PostDetailScreen').default,
  'hashtag-explore': () => require('./src/screens/ExploreHashtagScreen').default,
  'liked-posts': () => require('./src/screens/LikedPostsScreen').default,
  'security-settings': () => require('./src/screens/SecuritySettingsScreen').default,
  'privacy-settings': () => require('./src/screens/PrivacySettingsScreen').default,
  'blocked-users': () => require('./src/screens/BlockedUsersScreen').default,
  'notification-preferences': () => require('./src/screens/NotificationPreferencesScreen').default,
  'creator-analytics': () => require('./src/screens/CreatorAnalyticsScreen').default,
  'profile-qr': () => require('./src/screens/ProfileQrScreen').default,
  'help-support': () => require('./src/screens/HelpSupportScreen').default,
  'about-tiwi': () => require('./src/screens/AboutTiwiScreen').default,
  'account-verification': () => require('./src/screens/AccountVerificationScreen').default,

  // 25 Advanced Ecosystem Screens (Google UI + Page-NoPopup Rule + No Dummy Data)
  'audio-spaces': () => require('./src/screens/LiveAudioSpaceScreen').default,
  'community-circles': () => require('./src/screens/CommunityCirclesScreen').default,
  'creator-tiers': () => require('./src/screens/CreatorTiersScreen').default,
  'drafts-scheduler': () => require('./src/screens/DraftsSchedulerScreen').default,
  'live-polls': () => require('./src/screens/LivePollsScreen').default,
  'ai-studio': () => require('./src/screens/AiStudioScreen').default,
  'social-wallet': () => require('./src/screens/SocialWalletScreen').default,
  'events-hub': () => require('./src/screens/EventsHubScreen').default,
  'creator-media-kit': () => require('./src/screens/CreatorMediaKitScreen').default,
  'co-author': () => require('./src/screens/CoAuthorScreen').default,
  'custom-lists': () => require('./src/screens/CustomListsScreen').default,
  'content-filters': () => require('./src/screens/ContentFiltersScreen').default,
  'voice-notes': () => require('./src/screens/VoiceNotesScreen').default,
  'bio-link-builder': () => require('./src/screens/BioLinkBuilderScreen').default,
  'device-sessions': () => require('./src/screens/DeviceSessionsScreen').default,
  'data-export': () => require('./src/screens/DataExportScreen').default,
  'account-appeals': () => require('./src/screens/AccountAppealsScreen').default,
  'brand-marketplace': () => require('./src/screens/BrandMarketplaceScreen').default,
  'referral-rewards': () => require('./src/screens/ReferralRewardsScreen').default,
  'parental-controls': () => require('./src/screens/ParentalControlsScreen').default,
  'freelance-gigs': () => require('./src/screens/FreelanceGigsScreen').default,
  'live-trivia': () => require('./src/screens/LiveTriviaScreen').default,
  memories: () => require('./src/screens/MemoriesScreen').default,
  'secret-chats': () => require('./src/screens/SecretChatsScreen').default,
  'accessibility-settings': () => require('./src/screens/AccessibilitySettingsScreen').default,

  // Real-Time Messenger & WebRTC Calling Screens (Modular No-Popup Architecture)
  'create-group': () => require('./src/screens/messages/CreateGroupScreen').default,
  'group-details': () => require('./src/screens/messages/GroupDetailsScreen').default,
  'group-members': () => require('./src/screens/messages/GroupMembersScreen').default,
  'chat-conversation': () => require('./src/screens/messages/ChatConversationScreen').default,
  'audio-video-call': () => require('./src/screens/messages/AudioVideoCallScreen').default,
  'call-history': () => require('./src/screens/messages/CallHistoryScreen').default,
  'chat-media-gallery': () => require('./src/screens/messages/ChatMediaGalleryScreen').default,
  'chat-search': () => require('./src/screens/messages/ChatSearchScreen').default,
  'chat-settings': () => require('./src/screens/messages/ChatSettingsScreen').default,
  'forward-message': () => require('./src/screens/messages/ForwardMessageScreen').default,
  'blocked-chats': () => require('./src/screens/messages/BlockedChatsScreen').default,
  'archived-chats': () => require('./src/screens/messages/ArchivedChatsScreen').default,
};

const loadedScreens = {};

function getScreenComponent(name) {
  if (!loadedScreens[name] && screenLoaders[name]) {
    try {
      loadedScreens[name] = screenLoaders[name]();
    } catch (e) {
      console.warn(`[getScreenComponent: ${name}]`, e);
      return null;
    }
  }
  return loadedScreens[name] || null;
}

let CreatePostModalComponent = null;
function getCreatePostModal() {
  if (!CreatePostModalComponent) {
    try {
      CreatePostModalComponent = require('./src/components/CreatePostModal').default;
    } catch (e) {
      console.warn('[getCreatePostModal]', e);
    }
  }
  return CreatePostModalComponent;
}

function MainApp() {
  const { theme, isDarkMode, currentUser, isAuthenticated, activeBanner, dismissBanner, accountDisabledData, clearAccountDisabled, isSessionRestoring } = useAuth();
  const [currentTab, setCurrentTab] = useState('feed');
  const [history, setHistory] = useState(['feed']);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const bottomNavBlurTarget = useRef(null);

  // Proactively request camera, storage/photos, microphone, and location permissions on launch
  useEffect(() => {
    requestInitialAppPermissions();
  }, []);

  // Navigate helper that maintains history and handles user profile navigation
  const navigateTo = (tab, params = null) => {
    if (tab === 'back') {
      if (history.length > 1) {
        const nextHistory = [...history];
        nextHistory.pop();
        const prevTab = nextHistory[nextHistory.length - 1] || 'feed';
        setHistory(nextHistory);
        setCurrentTab(prevTab);
        if (prevTab !== 'profile') setSelectedUser(null);
        return;
      }
      setCurrentTab('feed');
      setSelectedUser(null);
      return;
    }
    if (params) {
      setSelectedUser(params);
    } else if (tab === 'profile') {
      setSelectedUser(null); // Own profile
    }
    if (tab === currentTab && !params) return;
    setHistory((prev) => [...prev, tab]);
    setCurrentTab(tab);
  };

  // Android Hardware Back Button Handling
  useEffect(() => {
    const onBackPress = () => {
      // 1. If create post modal is open, close it
      if (createModalVisible) {
        setCreateModalVisible(false);
        return true;
      }

      // 2. If inside settings, go back to profile
      if (currentTab === 'settings') {
        setCurrentTab('profile');
        return true;
      }

      // 3. If in navigation history, go back to previous tab
      if (history.length > 1) {
        const nextHistory = [...history];
        nextHistory.pop(); // remove current
        const prevTab = nextHistory[nextHistory.length - 1] || 'feed';
        setHistory(nextHistory);
        setCurrentTab(prevTab);
        if (prevTab !== 'profile') setSelectedUser(null);
        return true;
      }

      // 4. If current tab is not feed, go to feed
      if (currentTab !== 'feed') {
        setCurrentTab('feed');
        setHistory(['feed']);
        setSelectedUser(null);
        return true;
      }

      // 5. If already on feed, allow OS to handle back (exit app)
      return false;
    };

    const backSubscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backSubscription.remove();
  }, [currentTab, history, createModalVisible]);

  // Avoid flashing the sign-in screen while a persisted session is being verified.
  if (isSessionRestoring) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FA' }}>
        <ActivityIndicator size="large" color="#0B57D0" />
      </View>
    );
  }

  // If unauthenticated, display Auth screen (in blocked mode if account disabled)
  if (!isAuthenticated) {
    return (
      <AuthScreen
        initialMode={accountDisabledData ? 'blocked' : 'signin'}
        initialBlockedData={accountDisabledData}
        onLoginSuccess={() => {
          if (clearAccountDisabled) clearAccountDisabled();
          setCurrentTab('feed');
          setHistory(['feed']);
          setSelectedUser(null);
        }}
      />
    );
  }

  const renderActiveScreen = () => {
    const Screen = getScreenComponent(currentTab);
    if (!Screen) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#0B57D0" />
        </View>
      );
    }
    if (currentTab === 'profile') {
      return <Screen user={selectedUser} onNavigate={navigateTo} />;
    }
    if (currentTab === 'post-detail') {
      return <Screen post={selectedUser?.post || selectedUser} onNavigate={navigateTo} />;
    }
    if (currentTab === 'hashtag-explore') {
      return <Screen tag={selectedUser?.tag || selectedUser} onNavigate={navigateTo} />;
    }
    if (['followers-list', 'following-list'].includes(currentTab)) {
      return <Screen user={selectedUser?.user || selectedUser} onNavigate={navigateTo} isDark={isDarkMode} />;
    }
    return (
      <Screen
        onNavigate={navigateTo}
        navigation={{
          navigate: (screen, params) => navigateTo(screen, params),
          goBack: () => navigateTo('back'),
        }}
        routeParams={selectedUser}
        user={currentUser || selectedUser}
        isDark={isDarkMode}
      />
    );
  };

  const showBottomNav = ['feed', 'search', 'reels', 'notifications', 'messages', 'more', 'profile'].includes(currentTab);
  const isReelsTab = currentTab === 'reels';
  const topTheme = getActiveTopBarTheme(isDarkMode, isReelsTab);
  const CreateModal = createModalVisible ? getCreatePostModal() : null;

  return (
    <SafeAreaView
      edges={isReelsTab ? [] : ['top']}
      style={[
        styles.rootContainer,
        { backgroundColor: isReelsTab ? '#000000' : topTheme.statusBarBg },
      ]}
    >
      <StatusBar
        barStyle={topTheme.barStyle}
        backgroundColor={topTheme.statusBarBg}
        translucent={isReelsTab}
      />

      <GlobalErrorBoundary>
        {/* Active Screen View */}
        <BlurTargetView ref={bottomNavBlurTarget} style={styles.screenContainer}>
          <View
            style={[
              styles.screenContainer,
              { backgroundColor: isReelsTab ? '#000000' : theme.background },
            ]}
          >
            {renderActiveScreen()}
          </View>
        </BlurTargetView>

        {/* Global Bottom Navigation Bar */}
        {showBottomNav && (
          <BottomNavBar
            activeTab={currentTab}
            onTabSelect={navigateTo}
            onAddPress={() => setCreateModalVisible(true)}
            blurTarget={bottomNavBlurTarget}
          />
        )}

        {/* Global Floating Create Post Modal */}
        {CreateModal && (
          <CreateModal
            visible={createModalVisible}
            onClose={() => setCreateModalVisible(false)}
            onNavigate={navigateTo}
            onPostCreated={() => {
              setCreateModalVisible(false);
              navigateTo('feed');
            }}
          />
        )}

        {/* Global In-App Tiwi Mobile Notification Banner with Official Logo */}
        <TiwiNotificationBanner
          visible={!!activeBanner}
          notification={activeBanner}
          onDismiss={dismissBanner}
          isDarkMode={isDarkMode}
        />
      </GlobalErrorBoundary>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <GlobalErrorBoundary>
        <AuthProvider>
          <MainApp />
        </AuthProvider>
      </GlobalErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
  },
  screenContainer: {
    flex: 1,
  },
});
