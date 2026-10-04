import { buildSchema, graphql } from 'graphql';
import { SocialDB } from './socialDb.js';
import { ChatDB } from './chatDb.js';

// Social GraphQL Schema definition
export const socialSchema = buildSchema(`
  type SocialAuthor {
    id: ID!
    name: String!
    handle: String!
    avatar: String
    isVerified: Boolean
  }

  type SocialComment {
    id: ID!
    author: String!
    avatar: String
    isVerified: Boolean
    text: String!
    timeAgo: String
    likesCount: Int
    createdAt: String
  }

  type SocialPost {
    id: ID!
    author: SocialAuthor!
    caption: String
    image: String
    images: [String]
    timeAgo: String
    likesCount: String!
    commentsCount: String!
    repostsCount: String!
    isLiked: Boolean
    isSaved: Boolean
    createdAt: String
    comments: [SocialComment]
  }

  type SocialReelAuthor {
    id: ID!
    name: String!
    handle: String!
    avatar: String
    isVerified: Boolean
    isFollowing: Boolean
  }

  type SocialReel {
    id: ID!
    author: SocialReelAuthor!
    caption: String
    videoUrl: String
    image: String!
    audioTitle: String
    likesCount: String!
    commentsCount: String!
    sharesCount: String!
    isLiked: Boolean
    isSaved: Boolean
    createdAt: String
  }

  type SocialStory {
    id: ID!
    userId: String!
    name: String!
    avatar: String!
    isSelf: Boolean
    hasUnseen: Boolean
    mediaUrl: String
    createdAt: String
  }

  type PrivacySettings {
    protectPosts: Boolean
    photoTagging: Boolean
    locationSharing: Boolean
    discoverability: Boolean
  }

  type AdvancedSettings {
    personalizedAds: Boolean
    dataCollection: Boolean
    reduceMotion: Boolean
    increaseContrast: Boolean
    language: String
    appIcon: String
  }

  type SocialUserProfile {
    id: ID!
    name: String!
    handle: String!
    email: String
    avatar: String
    coverPhoto: String
    bio: String
    location: String
    website: String
    joinedDate: String
    followersCount: Int
    followingCount: Int
    postsCount: Int
    isVerified: Boolean
    privacySettings: PrivacySettings
    advancedSettings: AdvancedSettings
  }

  type SocialCustomList {
    id: ID!
    userId: String
    name: String!
    description: String
    isPrivate: Boolean
    isPinned: Boolean
    membersCount: Int
    subscribersCount: Int
  }

  type SocialPollOption {
    text: String!
    votes: Int!
  }

  type SocialPoll {
    id: ID!
    author: String
    question: String!
    options: [SocialPollOption]!
    totalVotes: Int!
    isActive: Boolean
  }

  type SocialAudioSpace {
    id: ID!
    title: String!
    topic: String
    hostUsername: String
    listenersCount: Int
    isLive: Boolean
  }

  type SocialCircle {
    id: ID!
    name: String!
    description: String
    category: String
    memberCount: Int
  }

  type SocialCreatorTier {
    id: ID!
    name: String!
    price: Float!
    subscribersCount: Int
  }

  type SocialEvent {
    id: ID!
    title: String!
    date: String
    time: String
    location: String
    category: String
    rsvpCount: Int
  }

  type SocialBioLink {
    id: ID!
    title: String!
    url: String!
    icon: String
    clicks: Int
  }

  type SocialFreelanceGig {
    id: ID!
    title: String!
    category: String
    price: Float!
    deliveryDays: Int
    username: String
  }

  type AuthPayload {
    user: SocialUserProfile!
    token: String!
  }

  type ChatUserSummary {
    id: ID!
    name: String
    avatar: String
    is_online: Boolean
    last_active_at: String
  }

  type ChatMember {
    id: ID!
    user_id: ID!
    name: String
    tiwi_id: String
    avatar: String
    role: String!
    joined_at: String
    is_muted: Boolean
    is_online: Boolean
  }

  type ChatMessage {
    id: ID!
    conversation_id: ID!
    sender_id: ID!
    sender_name: String
    sender_avatar: String
    message_type: String!
    content: String
    media_url: String
    reply_to_id: String
    is_edited: Boolean
    is_unsent: Boolean
    status: String!
    created_at: String!
  }

  type ChatConversation {
    id: ID!
    type: String!
    title: String
    avatar: String
    created_by: String
    last_message_text: String
    last_message_at: String
    is_archived: Boolean
    is_pinned: Boolean
    unread_count: Int
    user_role: String
    otherUser: ChatUserSummary
  }

  type CallSession {
    id: ID!
    conversation_id: ID!
    caller_id: ID!
    receiver_id: String
    call_type: String!
    session_key: String!
    status: String!
    duration_seconds: Int
    created_at: String!
    caller_name: String
    caller_avatar: String
    receiver_name: String
    receiver_avatar: String
  }

  type Query {
    feedPosts(currentUserId: String): [SocialPost]!
    post(id: ID!, currentUserId: String): SocialPost
    userProfile(userIdOrHandle: String!): SocialUserProfile
    reels(currentUserId: String): [SocialReel]!
    stories(currentUserId: String): [SocialStory]!
    customLists(userId: String!): [SocialCustomList]!
    audioSpaces: [SocialAudioSpace]!
    circles: [SocialCircle]!
    polls: [SocialPoll]!
    creatorTiers(creatorId: String!): [SocialCreatorTier]!
    events: [SocialEvent]!
    bioLinks(userId: String!): [SocialBioLink]!
    freelanceGigs(category: String): [SocialFreelanceGig]!
    chatConversations(userId: String!, archived: Boolean): [ChatConversation]!
    chatMessages(conversationId: String!): [ChatMessage]!
    chatMembers(conversationId: String!): [ChatMember]!
    callHistory(userId: String!): [CallSession]!
  }

  type Mutation {
    login(emailOrPhone: String!, password: String): AuthPayload!
    register(name: String!, email: String!, handle: String!, password: String, accountType: String): AuthPayload!
    createPost(authorId: String, caption: String, images: [String]!): SocialPost!
    likePost(postId: ID!, userId: String): SocialPost!
    savePost(postId: ID!, userId: String): SocialPost!
    addComment(postId: ID!, authorId: String, text: String!): SocialComment!
    createReel(authorId: String, caption: String, videoUrl: String, image: String, audioTitle: String): SocialReel!
    likeReel(reelId: ID!, userId: String): SocialReel!
    updateProfile(userId: String!, name: String, handle: String, bio: String, website: String, avatar: String, coverPhoto: String): SocialUserProfile!
    updatePrivacy(userId: String!, protectPosts: Boolean, photoTagging: Boolean, locationSharing: Boolean, discoverability: Boolean): PrivacySettings!
    updateAdvanced(userId: String!, personalizedAds: Boolean, dataCollection: Boolean, reduceMotion: Boolean, increaseContrast: Boolean): AdvancedSettings!
    createCustomList(userId: String!, name: String!, description: String, isPrivate: Boolean): SocialCustomList!
    createPoll(userId: String!, authorName: String, question: String!, options: [String]!): SocialPoll!
    votePoll(pollId: ID!, optionIndex: Int!): SocialPoll!
    createAudioSpace(title: String!, topic: String, hostId: String, hostUsername: String): SocialAudioSpace!
    createCircle(name: String!, description: String, category: String, creatorId: String): SocialCircle!
    createBioLink(userId: String!, title: String!, url: String!, icon: String): SocialBioLink!
    createGroupChat(userId: String!, title: String!, memberIds: [String]!, avatar: String): ChatConversation!
    sendChatMessage(conversationId: String!, senderId: String!, content: String!, messageType: String, mediaUrl: String, replyToId: String): ChatMessage!
    unsendChatMessage(messageId: String!, userId: String!): Boolean!
    editChatMessage(messageId: String!, userId: String!, newContent: String!): ChatMessage!
    updateGroupMemberRole(conversationId: String!, targetUserId: String!, role: String!, requesterId: String!): Boolean!
    removeGroupMember(conversationId: String!, targetUserId: String!, requesterId: String!): Boolean!
    initiateCall(conversationId: String!, callerId: String!, receiverId: String, callType: String): CallSession!
    endCall(callId: String!, durationSeconds: Int): Boolean!
  }
`);

export const socialResolvers = {
  feedPosts: async ({ currentUserId }) => {
    return await SocialDB.getPosts(currentUserId || null);
  },
  post: async ({ id, currentUserId }) => {
    return await SocialDB.getPostById(id, currentUserId || null);
  },
  userProfile: async ({ userIdOrHandle }) => {
    return (
      (await SocialDB.findUserById(userIdOrHandle)) ||
      (await SocialDB.findUserByHandleOrEmail(userIdOrHandle))
    );
  },
  reels: async ({ currentUserId }) => {
    return await SocialDB.getReels(currentUserId || null);
  },
  stories: async ({ currentUserId }) => {
    return await SocialDB.getStories(currentUserId || null);
  },
  customLists: async ({ userId }) => {
    const data = SocialDB.getData();
    return (data.customLists || []).filter((l) => l.userId === userId);
  },
  audioSpaces: async () => {
    const data = SocialDB.getData();
    return data.audioSpaces || [];
  },
  circles: async () => {
    const data = SocialDB.getData();
    return data.circles || [];
  },
  polls: async () => {
    const data = SocialDB.getData();
    return data.polls || [];
  },
  creatorTiers: async ({ creatorId }) => {
    const data = SocialDB.getData();
    return (data.creatorTiers || []).filter((t) => t.creatorId === creatorId);
  },
  events: async () => {
    const data = SocialDB.getData();
    return data.events || [];
  },
  bioLinks: async ({ userId }) => {
    const data = SocialDB.getData();
    return (data.bioLinks || []).filter((b) => b.userId === userId);
  },
  freelanceGigs: async ({ category }) => {
    const data = SocialDB.getData();
    const gigs = data.freelanceGigs || [];
    if (!category || category === 'All') return gigs;
    return gigs.filter((g) => g.category?.toLowerCase() === category.toLowerCase());
  },
  login: async ({ emailOrPhone, password }) => {
    return await SocialDB.authenticateUser(emailOrPhone, password);
  },
  register: async ({ name, email, handle, password, accountType }) => {
    return await SocialDB.registerUser({ name, email, handle, password, accountType });
  },
  createPost: async ({ authorId, caption, images }) => {
    return await SocialDB.createPost({ authorId, caption, images });
  },
  likePost: async ({ postId, userId }) => {
    return await SocialDB.toggleLikePost(postId, userId || null);
  },
  savePost: async ({ postId, userId }) => {
    return await SocialDB.toggleSavePost(postId, userId || null);
  },
  addComment: async ({ postId, authorId, text }) => {
    return await SocialDB.addComment(postId, { authorId, text });
  },
  createReel: async ({ authorId, caption, videoUrl, image, audioTitle }) => {
    return await SocialDB.createReel({ authorId, caption, videoUrl, image, audioTitle });
  },
  likeReel: async ({ reelId, userId }) => {
    return await SocialDB.toggleLikeReel(reelId, userId || null);
  },
  updateProfile: async ({ userId, name, handle, bio, website, avatar, coverPhoto }) => {
    return await SocialDB.updateProfile(userId, { name, handle, bio, website, avatar, coverPhoto });
  },
  updatePrivacy: async ({ userId, ...settings }) => {
    return await SocialDB.updatePrivacySettings(userId, settings);
  },
  updateAdvanced: async ({ userId, ...settings }) => {
    return await SocialDB.updateAdvancedSettings(userId, settings);
  },
  createCustomList: async ({ userId, name, description, isPrivate }) => {
    const list = {
      id: `list_${Date.now()}`,
      userId,
      name,
      description: description || '',
      isPrivate: !!isPrivate,
      isPinned: false,
      membersCount: 0,
      subscribersCount: 0,
    };
    const data = SocialDB.getData();
    if (!data.customLists) data.customLists = [];
    data.customLists.unshift(list);
    SocialDB.saveData(data);
    return list;
  },
  createPoll: async ({ userId, authorName, question, options }) => {
    const poll = {
      id: `poll_${Date.now()}`,
      userId,
      author: authorName || 'Creator',
      question,
      options: options.map((opt) => ({ text: opt, votes: 0 })),
      totalVotes: 0,
      isActive: true,
    };
    const data = SocialDB.getData();
    if (!data.polls) data.polls = [];
    data.polls.unshift(poll);
    SocialDB.saveData(data);
    return poll;
  },
  votePoll: async ({ pollId, optionIndex }) => {
    const data = SocialDB.getData();
    const poll = (data.polls || []).find((p) => p.id === pollId);
    if (poll && poll.options[optionIndex]) {
      poll.options[optionIndex].votes += 1;
      poll.totalVotes += 1;
      SocialDB.saveData(data);
    }
    return poll;
  },
  createAudioSpace: async ({ title, topic, hostId, hostUsername }) => {
    const space = {
      id: `space_${Date.now()}`,
      title,
      topic: topic || 'Open Discussion',
      hostUsername: hostUsername || 'creator',
      listenersCount: 1,
      isLive: true,
    };
    const data = SocialDB.getData();
    if (!data.audioSpaces) data.audioSpaces = [];
    data.audioSpaces.unshift(space);
    SocialDB.saveData(data);
    return space;
  },
  createCircle: async ({ name, description, category, creatorId }) => {
    const circle = {
      id: `circle_${Date.now()}`,
      name,
      description: description || '',
      category: category || 'General',
      memberCount: 1,
    };
    const data = SocialDB.getData();
    if (!data.circles) data.circles = [];
    data.circles.unshift(circle);
    SocialDB.saveData(data);
    return circle;
  },
  createBioLink: async ({ userId, title, url, icon }) => {
    const link = {
      id: `l_${Date.now()}`,
      userId,
      title,
      url,
      icon: icon || 'link',
      clicks: 0,
    };
    const data = SocialDB.getData();
    if (!data.bioLinks) data.bioLinks = [];
    data.bioLinks.push(link);
    SocialDB.saveData(data);
    return link;
  },

  // =========================================================================
  // REAL-TIME MESSENGER RESOLVERS (REAL DATA VIA POSTGRESQL / CHATDB)
  // =========================================================================
  chatConversations: async ({ userId, archived }) => {
    return await ChatDB.getConversations(userId, { archived });
  },
  chatMessages: async ({ conversationId }) => {
    return await ChatDB.getMessages(conversationId);
  },
  chatMembers: async ({ conversationId }) => {
    return await ChatDB.getGroupMembers(conversationId);
  },
  callHistory: async ({ userId }) => {
    return await ChatDB.getCallHistory(userId);
  },
  createGroupChat: async ({ userId, title, memberIds, avatar }) => {
    return await ChatDB.createConversation({
      type: 'group',
      title,
      avatar,
      createdBy: userId,
      memberIds,
    });
  },
  sendChatMessage: async ({ conversationId, senderId, content, messageType, mediaUrl, replyToId }) => {
    return await ChatDB.sendMessage({
      conversationId,
      senderId,
      content,
      messageType,
      mediaUrl,
      replyToId,
    });
  },
  unsendChatMessage: async ({ messageId, userId }) => {
    const res = await ChatDB.unsendMessage(messageId, userId);
    return res.success;
  },
  editChatMessage: async ({ messageId, userId, newContent }) => {
    const res = await ChatDB.editMessage(messageId, userId, newContent);
    return res.message;
  },
  updateGroupMemberRole: async ({ conversationId, targetUserId, role, requesterId }) => {
    const res = await ChatDB.updateMemberRole(conversationId, targetUserId, role, requesterId);
    return res.success;
  },
  removeGroupMember: async ({ conversationId, targetUserId, requesterId }) => {
    const res = await ChatDB.removeGroupMember(conversationId, targetUserId, requesterId);
    return res.success;
  },
  initiateCall: async ({ conversationId, callerId, receiverId, callType }) => {
    return await ChatDB.initiateCall({
      conversationId,
      callerId,
      receiverId,
      callType,
    });
  },
  endCall: async ({ callId, durationSeconds }) => {
    const res = await ChatDB.endCall(callId, durationSeconds);
    return !!res;
  },
};

// Express GraphQL Middleware helper
export function executeSocialGraphQL(query, variables = {}) {
  return graphql({
    schema: socialSchema,
    source: query,
    rootValue: socialResolvers,
    variableValues: variables,
  });
}
