import React, { Suspense, lazy } from 'react';
import { SocialProvider, useSocial } from './context/SocialContext';
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

function TwitterLayout({ onNavigateHome }) {
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

  const isWideMessages = activeTab === 'messages' || activeTab === 'call';

  return (
    <div className="min-h-screen bg-white dark:bg-black text-[#0F1419] dark:text-[#E7E9EA] font-sans antialiased flex justify-center selection:bg-[#1D9BF0]/20 selection:text-[#1D9BF0]">
      <div className="w-full max-w-[1265px] flex justify-between min-h-screen">
        {/* Left Column: Iconic Twitter Navigation Sidebar (Hidden on mobile, visible on sm+) */}
        <header className="hidden sm:flex flex-shrink-0 z-30">
          <SocialSidebar onNavigateHome={onNavigateHome} />
        </header>

        {/* Center Column: Iconic 600px Twitter Feed / Page Column */}
        <main
          className={`flex-1 min-h-screen border-r-0 sm:border-x border-[#EFF3F4] dark:border-[#2F3336] pb-16 sm:pb-0 ${
            isWideMessages
              ? 'max-w-[990px] w-full'
              : 'max-w-[600px] w-full min-w-0'
          }`}
        >
          <Suspense
            fallback={
              <div className="flex items-center justify-center min-h-[50vh]">
                <div className="w-7 h-7 rounded-full border-2 border-[#1D9BF0] border-t-transparent animate-spin" />
              </div>
            }
          >
            {renderActiveView()}
          </Suspense>
        </main>

        {/* Right Column: Twitter Right Sidebar (Search, Trends, Who to follow) */}
        {!isWideMessages && (
          <aside className="w-[290px] xl:w-[350px] flex-shrink-0 hidden lg:block pl-6 pr-4">
            <SocialRightPanel />
          </aside>
        )}
      </div>

      {/* Twitter Mobile Bottom Bar */}
      <BottomNav />
    </div>
  );
}

export default function TiwiSocialWeb({ currentUser = null, onNavigateHome = null }) {
  return (
    <SocialProvider initialUser={currentUser}>
      <TwitterLayout onNavigateHome={onNavigateHome} />
    </SocialProvider>
  );
}
