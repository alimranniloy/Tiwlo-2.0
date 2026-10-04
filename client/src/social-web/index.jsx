import React, { Suspense, lazy, useState } from 'react';
import { SocialProvider, useSocial } from './context/SocialContext';
import GoogleTopBar from './components/GoogleTopBar';
import SocialSidebar from './components/SocialSidebar';
import SocialRightPanel from './components/SocialRightPanel';
import SocialFarRightRail from './components/SocialFarRightRail';
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

function SquareSocialLayout({ onNavigateHome }) {
  const { activeTab } = useSocial();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const renderActiveView = () => {
    switch (activeTab) {
      case 'reels': return <ReelsView />;
      case 'search':
      case 'explore': return <SearchView />;
      case 'notifications': return <NotificationsView />;
      case 'messages': return <MessagesView />;
      case 'call': return <AudioVideoCallView />;
      case 'profile': return <ProfileView />;
      case 'edit-profile': return <EditProfileView />;
      case 'create-post': return <CreatePostView />;
      case 'create-story': return <CreateStoryView />;
      case 'post-detail': return <PostDetailView />;
      case 'bookmarks': return <BookmarksView />;
      case 'liked-posts': return <LikedPostsView />;
      case 'followers': return <FollowersListView />;
      case 'following': return <FollowingListView />;
      case 'audio-spaces': return <AudioSpacesView />;
      case 'communities': return <CommunityCirclesView />;
      case 'creator': return <CreatorHubView />;
      case 'wallet': return <SocialWalletView />;
      case 'ai-studio': return <AiStudioView />;
      case 'polls': return <LivePollsView />;
      case 'events': return <EventsHubView />;
      case 'trivia': return <LiveTriviaView />;
      case 'memories': return <MemoriesView />;
      case 'settings': return <SettingsView />;
      case 'feed':
      default: return <FeedView />;
    }
  };

  const isWideMessages = activeTab === 'messages' || activeTab === 'call';

  return (
    <div className="min-h-screen bg-[#F5F7FB] dark:bg-[#0E1017] text-[#111827] dark:text-[#E2E8F0] font-sans antialiased flex flex-col selection:bg-[#1E75FF]/20 selection:text-[#1E75FF]">
      {/* 1. Top Navigation Bar matching screenshot */}
      <GoogleTopBar
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        onNavigateHome={onNavigateHome}
      />

      {/* 2. Main 4-Column Layout */}
      <div className="flex-1 flex justify-center w-full">
        <div className="w-full max-w-[1440px] flex justify-between min-h-[calc(100vh-64px)] px-3 sm:px-5">
          {/* Column 1: Left Navigation Sidebar */}
          {sidebarOpen && (
            <div className="hidden md:flex flex-shrink-0 z-30">
              <SocialSidebar />
            </div>
          )}

          {/* Column 2: Center Main Feed */}
          <main
            className={`flex-1 min-h-[calc(100vh-64px)] px-1 sm:px-4 md:px-5 py-5 pb-24 sm:pb-8 ${
              isWideMessages
                ? 'max-w-[1040px] w-full'
                : 'max-w-[590px] xl:max-w-[620px] w-full min-w-0'
            }`}
          >
            <Suspense
              fallback={
                <div className="flex items-center justify-center min-h-[50vh]">
                  <div className="w-8 h-8 rounded-full border-2 border-[#1E75FF] border-t-transparent animate-spin" />
                </div>
              }
            >
              {renderActiveView()}
            </Suspense>
          </main>

          {/* Column 3: Sosmed Stories, Events & Suggested Pages */}
          {!isWideMessages && (
            <aside className="w-[280px] xl:w-[290px] flex-shrink-0 hidden lg:block py-5 pl-2">
              <SocialRightPanel />
            </aside>
          )}

          {/* Column 4: Far Right Contacts / Friends Rail */}
          {!isWideMessages && (
            <div className="hidden xl:block flex-shrink-0 py-5 pl-3 border-l border-[#EAECF0] dark:border-[#1E232F]">
              <SocialFarRightRail />
            </div>
          )}
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav />
    </div>
  );
}

export default function TiwiSocialWeb({ currentUser = null, onNavigateHome = null }) {
  return (
    <SocialProvider initialUser={currentUser}>
      <SquareSocialLayout onNavigateHome={onNavigateHome} />
    </SocialProvider>
  );
}
