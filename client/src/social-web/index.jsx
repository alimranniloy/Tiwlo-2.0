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

function GoogleSocialLayout({ onNavigateHome }) {
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
    <div className="min-h-screen bg-[#F8FAFD] dark:bg-[#131314] text-[#1F1F1F] dark:text-[#E3E3E3] font-sans antialiased flex justify-center selection:bg-[#0B57D0]/15 selection:text-[#0B57D0]">
      <div className="w-full max-w-[1320px] flex justify-between min-h-screen px-2 sm:px-4 lg:px-6">
        {/* Left Column: Google Workspace Navigation Rail / Drawer */}
        <header className="hidden sm:flex flex-shrink-0 z-30">
          <SocialSidebar onNavigateHome={onNavigateHome} />
        </header>

        {/* Center Column: Breatheable Google Material Feed Column */}
        <main
          className={`flex-1 min-h-screen px-0 sm:px-4 md:px-6 py-3 pb-20 sm:pb-6 ${
            isWideMessages
              ? 'max-w-[1020px] w-full'
              : 'max-w-[680px] w-full min-w-0'
          }`}
        >
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

        {/* Right Column: Google Discover / Trends Panel */}
        {!isWideMessages && (
          <aside className="w-[300px] xl:w-[340px] flex-shrink-0 hidden lg:block py-3 pl-3">
            <SocialRightPanel />
          </aside>
        )}
      </div>

      {/* Google Material Mobile Bottom Navigation Bar */}
      <BottomNav />
    </div>
  );
}

export default function TiwiSocialWeb({ currentUser = null, onNavigateHome = null }) {
  return (
    <SocialProvider initialUser={currentUser}>
      <GoogleSocialLayout onNavigateHome={onNavigateHome} />
    </SocialProvider>
  );
}
