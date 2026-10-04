import React, { Suspense, lazy } from 'react';
import { SocialProvider, useSocial } from './context/SocialContext';
import SocialNavbar from './components/SocialNavbar';
import SocialSidebar from './components/SocialSidebar';
import SocialRightPanel from './components/SocialRightPanel';
import BottomNav from './components/BottomNav';

// Dedicated Views (Modular & Code-Split)
const FeedView = lazy(() => import('./views/FeedView'));
const ReelsView = lazy(() => import('./views/ReelsView'));
const SearchView = lazy(() => import('./views/SearchView'));
const NotificationsView = lazy(() => import('./views/NotificationsView'));
const MessagesView = lazy(() => import('./views/MessagesView'));
const AudioVideoCallView = lazy(() => import('./views/AudioVideoCallView'));
const ProfileView = lazy(() => import('./views/ProfileView'));
const EditProfileView = lazy(() => import('./views/EditProfileView'));
const CreatePostView = lazy(() => import('./views/CreatePostView'));
const CreateStoryView = lazy(() => import('./views/CreateStoryView'));
const PostDetailView = lazy(() => import('./views/PostDetailView'));
const BookmarksView = lazy(() => import('./views/BookmarksView'));
const LikedPostsView = lazy(() => import('./views/LikedPostsView'));
const FollowersListView = lazy(() => import('./views/FollowersListView'));
const FollowingListView = lazy(() => import('./views/FollowingListView'));
const AudioSpacesView = lazy(() => import('./views/AudioSpacesView'));
const CommunityCirclesView = lazy(() => import('./views/CommunityCirclesView'));
const CreatorHubView = lazy(() => import('./views/CreatorHubView'));
const SocialWalletView = lazy(() => import('./views/SocialWalletView'));
const AiStudioView = lazy(() => import('./views/AiStudioView'));
const LivePollsView = lazy(() => import('./views/LivePollsView'));
const EventsHubView = lazy(() => import('./views/EventsHubView'));
const LiveTriviaView = lazy(() => import('./views/LiveTriviaView'));
const MemoriesView = lazy(() => import('./views/MemoriesView'));
const SettingsView = lazy(() => import('./views/SettingsView'));

function SocialWebLayout({ onNavigateHome }) {
  const { activeTab } = useSocial();

  const renderActiveView = () => {
    switch (activeTab) {
      case 'reels':
        return <ReelsView />;
      case 'search':
      case 'explore':
        return <SearchView />;
      case 'notifications':
        return <NotificationsView />;
      case 'messages':
        return <MessagesView />;
      case 'call':
        return <AudioVideoCallView />;
      case 'profile':
        return <ProfileView />;
      case 'edit-profile':
        return <EditProfileView />;
      case 'create-post':
        return <CreatePostView />;
      case 'create-story':
        return <CreateStoryView />;
      case 'post-detail':
        return <PostDetailView />;
      case 'bookmarks':
        return <BookmarksView />;
      case 'liked-posts':
        return <LikedPostsView />;
      case 'followers':
        return <FollowersListView />;
      case 'following':
        return <FollowingListView />;
      case 'audio-spaces':
        return <AudioSpacesView />;
      case 'communities':
        return <CommunityCirclesView />;
      case 'creator':
        return <CreatorHubView />;
      case 'wallet':
        return <SocialWalletView />;
      case 'ai-studio':
        return <AiStudioView />;
      case 'polls':
        return <LivePollsView />;
      case 'events':
        return <EventsHubView />;
      case 'trivia':
        return <LiveTriviaView />;
      case 'memories':
        return <MemoriesView />;
      case 'settings':
        return <SettingsView />;
      case 'feed':
      default:
        return <FeedView />;
    }
  };

  const isFullWidthView = ['reels', 'call', 'messages'].includes(activeTab);

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0B0F17] text-[#1F1F1F] dark:text-[#E2E8F0] font-sans antialiased flex flex-col transition-colors selection:bg-[#0B57D0]/20 selection:text-[#0B57D0]">
      {/* Google-Inspired Top Navbar */}
      <SocialNavbar onBackToPortal={onNavigateHome} />

      {/* Main Container Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 flex justify-center gap-6">
        {/* Left Sidebar */}
        <SocialSidebar />

        {/* Center Dynamic Content Area */}
        <main className={`flex-1 min-w-0 py-6 ${isFullWidthView ? 'max-w-none' : 'max-w-3xl'}`}>
          <Suspense
            fallback={
              <div className="flex items-center justify-center min-h-[50vh]">
                <div className="w-8 h-8 rounded-full border-3 border-[#0B57D0] border-t-transparent animate-spin" />
              </div>
            }
          >
            {renderActiveView()}
          </Suspense>
        </main>

        {/* Right Panel (Hidden on narrow screens and full-width views) */}
        {!isFullWidthView && <SocialRightPanel />}
      </div>

      {/* Mobile Sticky Bottom Navigation */}
      <BottomNav />
    </div>
  );
}

export default function TiwiSocialWeb({ currentUser = null, onNavigateHome = null }) {
  return (
    <SocialProvider initialUser={currentUser}>
      <SocialWebLayout onNavigateHome={onNavigateHome} />
    </SocialProvider>
  );
}
