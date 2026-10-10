import { readState, saveState, isPersistedState } from '../db/stateDocuments.js';
import { MasterDB, TenantDB } from '../db/multiTenant.js';
import { PasswordSecurity } from '../security/cryptoSecurity.js';
import { isPgActive, queryPg } from '../db/postgres.js';
import {
  generateSecureOtp,
  verifySecureOtp,
  deleteOtpSession,
  getOtpSession,
  sendTwoFactorOtpEmail,
  sendLoginActivityAlertEmail
} from '../db/emailService.js';

const SOCIAL_DEFAULT_DATA = {
  profiles: {},
  posts: [],
  reels: [],
  stories: [],
  notifications: [],
  conversations: [],
  messages: [],
  likes: [],
  postViews: [],
  saves: [],
  follows: [],
  followRequests: [],
  reelPreferences: [],
  reelReports: []
};

export const SocialDB = {
  init() { /* Schema initialization is awaited by server startup. */ },

  async hydrateFromPg() {
    const socialRuntimeData = await this.getData();
    if (isPersistedState(socialRuntimeData)) return;
    try {
      // 1. Hydrate follows
      const followsRes = await queryPg(`
        SELECT id, follower_id as "followerId", following_id as "followingId", created_at as "createdAt"
        FROM social_follows
      `);
      if (Array.isArray(followsRes?.rows)) {
        socialRuntimeData.follows = followsRes.rows;
      }

      const followRequestsRes = await queryPg(`
        SELECT id, requester_id AS "requesterId", recipient_id AS "recipientId",
               status, created_at AS "createdAt"
        FROM social_follow_requests
      `);
      if (Array.isArray(followRequestsRes?.rows)) {
        socialRuntimeData.followRequests = followRequestsRes.rows;
      }

      const profilesRes = await queryPg(`
        SELECT id, tiwi_id, name, handle, bio, avatar, cover_photo, account_type,
               website, location, phone, gender, birthday, privacy_settings, is_verified
        FROM social_profiles
      `);
      for (const row of profilesRes.rows || []) {
        socialRuntimeData.profiles[row.id] = {
          ...socialRuntimeData.profiles[row.id],
          tiwiId: row.tiwi_id,
          name: row.name,
          handle: row.handle,
          bio: row.bio,
          avatar: row.avatar,
          coverPhoto: row.cover_photo,
          accountType: row.account_type,
          website: row.website,
          location: row.location,
          phone: row.phone,
          gender: row.gender,
          birthday: row.birthday,
          privacySettings: row.privacy_settings || socialRuntimeData.profiles[row.id]?.privacySettings,
          isVerified: row.is_verified,
        };
      }

      // 2. Hydrate posts
      const postsRes = await queryPg(`
        SELECT p.id, p.author_id, p.caption, p.media_urls, p.likes_count, p.comments_count, p.shares_count, p.views_count, p.is_pinned, p.created_at,
               u.name, u.email, u.avatar, u.role
        FROM social_posts p
        LEFT JOIN system_users u ON p.author_id = u.id
        ORDER BY p.created_at DESC
        LIMIT 200
      `);
      if (Array.isArray(postsRes?.rows) && postsRes.rows.length > 0) {
        const pgPosts = postsRes.rows.map((row) => {
          let media = [];
          try {
            media = typeof row.media_urls === 'string' ? JSON.parse(row.media_urls) : (row.media_urls || []);
          } catch (e) {
            media = [];
          }
          return {
            id: row.id,
            author: {
              id: row.author_id,
              name: row.name || 'User',
              handle: `@${(row.name || 'user').toLowerCase().replace(/\\s+/g, '')}`,
              avatar: row.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(row.name || 'User')}&background=0B57D0&color=fff&size=200`,
              isVerified: row.role === 'admin' || row.role === 'superadmin',
            },
            timeAgo: 'Recently',
            caption: row.caption || '',
            images: Array.isArray(media) ? media : [],
            image: Array.isArray(media) && media.length > 0 ? media[0] : null,
            likesCount: String(row.likes_count || 0),
            commentsCount: String(row.comments_count || 0),
            repostsCount: String(row.shares_count || 0),
            viewsCount: String(row.views_count || 0),
            isPinned: Boolean(row.is_pinned),
            createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
            comments: [],
          };
        });
        const existingIds = new Set((socialRuntimeData.posts || []).map(p => p.id));
        for (const p of pgPosts) {
          if (!existingIds.has(p.id)) {
            socialRuntimeData.posts.push(p);
            existingIds.add(p.id);
          }
        }
      }

      // 3. Hydrate likes
      const likesRes = await queryPg(`
        SELECT id, user_id as "userId", target_type as "targetType", target_id as "targetId", created_at as "createdAt"
        FROM social_likes
      `);
      if (Array.isArray(likesRes?.rows)) {
        socialRuntimeData.likes = likesRes.rows;
      }

      // 4. Hydrate reels
      const reelsRes = await queryPg(`
        SELECT r.id, r.author_id, r.video_url, r.caption, r.sound_title, r.likes_count, r.views_count, r.comments_count, r.created_at,
               u.name, u.avatar
        FROM social_reels r
        LEFT JOIN system_users u ON r.author_id = u.id
        ORDER BY r.created_at DESC
        LIMIT 100
      `);
      if (Array.isArray(reelsRes?.rows) && reelsRes.rows.length > 0) {
        const pgReels = reelsRes.rows.map((row) => ({
          id: row.id,
          author: {
            id: row.author_id,
            name: row.name || 'Creator',
            handle: `@${(row.name || 'creator').toLowerCase().replace(/\\s+/g, '')}`,
            avatar: row.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(row.name || 'Creator')}&background=0B57D0&color=fff&size=200`,
          },
          videoUrl: row.video_url,
          image: row.video_url,
          caption: row.caption || '',
          audioTitle: row.sound_title || 'Original audio',
          likesCount: String(row.likes_count || 0),
          viewsCount: String(row.views_count || 0),
          commentsCount: String(row.comments_count || 0),
          createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
        }));
        const existingReelIds = new Set((socialRuntimeData.reels || []).map(r => r.id));
        for (const r of pgReels) {
          if (!existingReelIds.has(r.id)) {
            socialRuntimeData.reels.push(r);
            existingReelIds.add(r.id);
          }
        }
      }

      await this.saveData(socialRuntimeData);
      console.log(`🐘 SocialDB hydrated from PostgreSQL: ${socialRuntimeData.follows.length} follows, ${socialRuntimeData.posts.length} posts, ${socialRuntimeData.reels.length} reels, ${socialRuntimeData.likes.length} likes.`);
    } catch (err) {
      throw err;
    }
  },

  async getData() {
    return readState('social', 'community', SOCIAL_DEFAULT_DATA);
  },

  async saveData(data) {
    await saveState('social', 'community', data);
  },

  // Helper to map a MasterDB user into a full Social User Profile
  // Helper to map a MasterDB user into a full Social User Profile
  _toSocialUser(masterUser, profileData = {}, data = null, currentUserId = null) {
    if (!masterUser) return null;
    const tiwiId = masterUser.tiwiId || masterUser.storeId || null;
    const accountType = profileData.accountType || masterUser.accountType || 'personal';
    const isBusiness = accountType === 'business';
    const cleanName = profileData.name || masterUser.name || (isBusiness ? masterUser.storeName : null) || 'User';
    const storeSlug = cleanName.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const defaultHandle = `@${storeSlug || 'user'}`;

    const follows = data?.follows || [];
    const posts = data?.posts || [];

    const followersCount = follows.filter((f) => f.followingId === masterUser.id || (masterUser.tiwiId && f.followingId === masterUser.tiwiId)).length;
    const followingCount = follows.filter((f) => f.followerId === masterUser.id || (masterUser.tiwiId && f.followerId === masterUser.tiwiId)).length;
    const postsCount = posts.filter((p) => p.author?.id === masterUser.id).length;

    const cleanCurrentUserId = currentUserId ? String(currentUserId).trim().toLowerCase() : null;
    const isFollowing = !!(
      cleanCurrentUserId &&
      cleanCurrentUserId !== String(masterUser.id).toLowerCase() &&
      follows.some((f) => {
        const fFollower = String(f.followerId || '').toLowerCase();
        const fFollowing = String(f.followingId || '').toLowerCase();
        const mId = String(masterUser.id).toLowerCase();
        const mTiwiId = masterUser.tiwiId ? String(masterUser.tiwiId).toLowerCase() : '';
        return (fFollower === cleanCurrentUserId) && (fFollowing === mId || (mTiwiId && fFollowing === mTiwiId));
      })
    );
    const followRequestPending = !!(
      cleanCurrentUserId &&
      (data?.followRequests || []).some(
        (request) =>
          String(request.requesterId).toLowerCase() === cleanCurrentUserId &&
          String(request.recipientId).toLowerCase() === String(masterUser.id).toLowerCase() &&
          request.status === 'pending'
      )
    );

    const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanName)}&background=0B57D0&color=fff&size=256&bold=true`;

    return {
      id: masterUser.id,
      tiwiId,
      name: cleanName,
      handle: profileData.handle || defaultHandle,
      email: masterUser.email,
      password: masterUser.password,
      role: masterUser.role || 'user',
      accountType, // 'personal' | 'business'
      isBusiness,
      avatar: profileData.avatar || masterUser.avatar || defaultAvatar,
      coverPhoto: profileData.coverPhoto || masterUser.coverPhoto || null,
      bio: profileData.bio || (isBusiness ? 'Official Business Account • Tiwlo' : 'Tiwlo Member'),
      location: profileData.location || (masterUser.billingDetails?.city ? `${masterUser.billingDetails.city}, ${masterUser.billingDetails.country || 'Bangladesh'}` : ''),
      website: profileData.website || (isBusiness && masterUser.subdomain ? `https://${masterUser.subdomain}` : ''),
      gender: profileData.gender || masterUser.gender || 'Rather not say',
      birthday: profileData.birthday || masterUser.dateOfBirth || masterUser.birthday || '',
      phone: profileData.phone || masterUser.billingDetails?.phone || masterUser.phone || '',
      backupPhones: profileData.backupPhones || [],
      recoveryEmail: profileData.recoveryEmail || '',
      billingAddress: profileData.billingAddress || (masterUser.billingDetails ? {
        country: masterUser.billingDetails.country || 'Bangladesh',
        city: masterUser.billingDetails.city || '',
        address: masterUser.billingDetails.address || '',
        phone: masterUser.billingDetails.phone || profileData.phone || masterUser.phone || '',
        postalCode: masterUser.billingDetails.postalCode || ''
      } : {
        country: 'Bangladesh',
        city: '',
        address: '',
        phone: '',
        postalCode: ''
      }),
      workAddress: profileData.workAddress || masterUser.storeName || '',
      joinedDate: masterUser.createdAt
        ? `Joined ${new Date(masterUser.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
        : 'Joined recently',
      followersCount,
      followingCount,
      postsCount,
      isFollowing,
      followRequestPending,
      isVerified: profileData.isVerified !== undefined ? profileData.isVerified : isBusiness,
      createdAt: masterUser.createdAt || new Date().toISOString(),
      twoFactorEnabled: !!masterUser.twoFactorEnabled,
      isBanned: !!masterUser.isBanned,
      banReason: masterUser.banReason || null,
      privacySettings: profileData.privacySettings || {
        protectPosts: false,
        photoTagging: true,
        locationSharing: false,
        discoverability: true,
      },
      advancedSettings: profileData.advancedSettings || {
        personalizedAds: true,
        dataCollection: true,
        reduceMotion: false,
        increaseContrast: false,
        language: 'English (United States)',
        appIcon: 'Default',
      },
    };
  },

  // ====================================================================
  // AUTH & USERS (100% UNIFIED WITH MASTERDB)
  // ====================================================================
  async findUserById(userId, currentUserId = null) {
    if (!userId) return null;
    const cleanId = String(userId).trim().toLowerCase();
    const masterUsers = await MasterDB.getUsers();
    const masterUser = masterUsers.find((u) =>
      String(u.id).toLowerCase() === cleanId ||
      u.tiwiId?.toLowerCase() === cleanId ||
      u.storeId?.toLowerCase() === cleanId ||
      u.email?.toLowerCase() === cleanId
    );
    if (!masterUser) return null;
    const data = (await this.getData());
    const profile = (data.profiles && data.profiles[masterUser.id]) || {};
    return this._toSocialUser(masterUser, profile, data, currentUserId);
  },

  async findUserByHandleOrEmail(identifier, currentUserId = null) {
    if (!identifier) return null;
    const clean = identifier.trim().toLowerCase();
    const cleanHandle = clean.startsWith('@') ? clean : `@${clean}`;

    const masterUsers = await MasterDB.getUsers();
    const data = (await this.getData());
    const profiles = data.profiles || {};

    const masterUser = masterUsers.find((u) => {
      const p = profiles[u.id] || {};
      const handle = (p.handle || `@${(u.storeName || '').toLowerCase().replace(/[^a-z0-9_]/g, '')}`).toLowerCase();
      return (
        u.email?.toLowerCase() === clean ||
        u.tiwiId?.toLowerCase() === clean ||
        u.storeId?.toLowerCase() === clean ||
        handle === clean ||
        handle === cleanHandle
      );
    });

    if (!masterUser) return null;
    const profile = profiles[masterUser.id] || {};
    return this._toSocialUser(masterUser, profile, data, currentUserId);
  },

  async authenticateUser(emailOrId, password) {
    if (!emailOrId || !emailOrId.trim()) {
      throw new Error('Email or Tiwi ID is required.');
    }
    if (!password || !password.trim()) {
      throw new Error('Password is required.');
    }

    const clean = emailOrId.trim().toLowerCase();
    const cleanHandle = clean.startsWith('@') ? clean : `@${clean}`;

    // Look up directly in MasterDB (single source of truth for platform users)
    const masterUsers = await MasterDB.getUsers();
    const data = (await this.getData());
    const profiles = data.profiles || {};

    const masterUser = masterUsers.find((u) => {
      const p = profiles[u.id] || {};
      const handle = (p.handle || `@${(u.name || u.storeName || '').toLowerCase().replace(/[^a-z0-9_]/g, '')}`).toLowerCase();
      return (
        u.email?.toLowerCase() === clean ||
        u.tiwiId?.toLowerCase() === clean ||
        u.storeId?.toLowerCase() === clean ||
        handle === clean ||
        handle === cleanHandle
      );
    });

    // STRICT: Only users registered in MasterDB can log in
    if (!masterUser) {
      throw new Error('Account not found. Only registered users from the Tiwlo platform can sign in.');
    }

    // 1. Account Suspension / Blocking check
    if (masterUser.isBanned) {
      return {
        isBanned: true,
        banReason: masterUser.banReason || 'Your account has been suspended by administrator for security or policy review.',
        email: masterUser.email,
        name: masterUser.name || masterUser.storeName,
        tiwiId: masterUser.tiwiId,
        error: masterUser.banReason || 'Your account has been suspended by administrator.'
      };
    }

    // 2. Cryptographic Password Verification
    let passwordMatches = false;
    if (masterUser.password) {
      if (masterUser.password.startsWith('scrypt$')) {
        passwordMatches = PasswordSecurity.verify(password, masterUser.password);
      } else {
        passwordMatches = masterUser.password === password;
      }
    }

    if (!passwordMatches) {
      throw new Error('Incorrect password. Please enter the correct password.');
    }

    // 3. Two-Step Verification (2FA) Check
    if (masterUser.twoFactorEnabled === true) {
      const otpResult = await generateSecureOtp(masterUser.email, 'login_2fa', 10);
      const [u, d] = masterUser.email.split('@');
      const masked = `${u[0]}***@${d}`;

      await sendTwoFactorOtpEmail({
        to: masterUser.email,
        name: masterUser.name || masterUser.storeName,
        code: otpResult.code
      }).catch(e => console.error('[Social 2FA Email Error]', e));

      return {
        requires2FA: true,
        tempToken: otpResult.token,
        email: masterUser.email,
        emailMasked: masked,
        message: `Two-Step verification code sent to ${masked}`
      };
    }

    // 4. Session Token Issue (If 2FA is not enabled)
    const profile = profiles[masterUser.id] || {};
    const socialUser = this._toSocialUser(masterUser, profile, data);
    const token = `tiwi_token_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    const { password: _, ...safeUser } = socialUser;
    return { user: safeUser, token };
  },

  async verify2FA(tempToken, otpCode) {
    if (!tempToken || !otpCode) {
      throw new Error('Verification token and 6-digit code are required.');
    }
    const cleanCode = String(otpCode).trim();
    const verification = await verifySecureOtp(tempToken, cleanCode, 'login_2fa');
    if (!verification.valid) {
      throw new Error(verification.error || 'Invalid or expired 2FA code.');
    }

    const masterUser = await MasterDB.findUserByIdentifier(verification.email);
    if (!masterUser) {
      throw new Error('User account not found.');
    }

    if (masterUser.isBanned) {
      return {
        isBanned: true,
        banReason: masterUser.banReason || 'Your account has been suspended by administrator.',
        error: 'Your account has been suspended.'
      };
    }

    const data = (await this.getData());
    const profiles = data.profiles || {};
    const profile = profiles[masterUser.id] || {};
    const socialUser = this._toSocialUser(masterUser, profile, data);
    const token = `tiwi_token_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

    sendLoginActivityAlertEmail({
      to: masterUser.email,
      name: masterUser.name || masterUser.storeName,
      ip: 'Mobile Device',
      userAgent: 'Tiwi Mobile App (iOS / Android)',
      location: 'Dhaka, Bangladesh',
      timestamp: new Date().toUTCString()
    }).catch(e => console.error('[Login Alert Email Error]', e));

    const { password: _, ...safeUser } = socialUser;
    return { user: safeUser, token, message: `Welcome back, ${socialUser.name}!` };
  },

  async resend2FA(tempToken) {
    if (!tempToken) {
      throw new Error('Temporary verification token is required.');
    }
    const session = await getOtpSession(tempToken);
    if (!session) {
      throw new Error('Verification session expired. Please sign in again.');
    }
    const user = await MasterDB.findUserByIdentifier(session.email);
    if (!user) {
      throw new Error('User not found.');
    }

    await deleteOtpSession(tempToken);
    const newOtp = await generateSecureOtp(user.email, 'login_2fa', 10);
    const [u, d] = user.email.split('@');
    const masked = `${u[0]}***@${d}`;

    await sendTwoFactorOtpEmail({
      to: user.email,
      name: user.name || user.storeName,
      code: newOtp.code
    }).catch(e => console.error('[Resend 2FA Email Error]', e));

    return {
      success: true,
      newTempToken: newOtp.token,
      emailMasked: masked,
      message: `A fresh 6-digit code has been sent to ${masked}`
    };
  },

  async submitAccountAppeal(identifier, appealReason) {
    if (!identifier || !appealReason) {
      throw new Error('Account identifier and reason for appeal are required.');
    }
    const data = (await this.getData());
    if (!data.appeals) data.appeals = [];
    const appealRecord = {
      id: `appeal_${Date.now()}`,
      identifier,
      appealReason,
      status: 'pending',
      submittedAt: new Date().toISOString(),
    };
    data.appeals.push(appealRecord);
    (await this.saveData(data));
    return {
      success: true,
      message: 'Your appeal has been submitted to Tiwi Trust & Safety. Our team will review your account status.',
    };
  },

  async isEmailTaken(email, excludeUserId = null) {
    return MasterDB.isSignupEmailTaken(email, excludeUserId);
  },

  async isHandleTaken(handle, excludeUserId = null) {
    if (!handle || !handle.trim()) return false;
    let clean = handle.trim().toLowerCase();
    if (clean.startsWith('@')) clean = clean.substring(1);
    if (!clean) return false;

    const data = (await this.getData());
    const profiles = data.profiles || {};

    // 1. Check in SocialDB profiles
    for (const [uid, prof] of Object.entries(profiles)) {
      if (excludeUserId && uid === excludeUserId) continue;
      let h = (prof.handle || '').trim().toLowerCase();
      if (h.startsWith('@')) h = h.substring(1);
      if (h === clean) return true;
    }

    // 2. Check in MasterDB users
    try {
      const masterUsers = await MasterDB.getUsers();
      for (const u of masterUsers) {
        if (excludeUserId && (u.id === excludeUserId || u.tiwiId === excludeUserId)) continue;
        const prof = profiles[u.id] || {};
        let h = (prof.handle || '').trim().toLowerCase();
        if (h.startsWith('@')) h = h.substring(1);
        if (h === clean) return true;

        const fallback = (u.storeName || u.name || '').toLowerCase().replace(/[^a-z0-9_]/g, '');
        if (fallback && fallback === clean) return true;
      }
    } catch (e) {}

    return false;
  },

  async checkAvailability({ email = '', handle = '', userId = null }) {
    let emailAvailable = true;
    let emailError = null;
    let handleAvailable = true;
    let handleError = null;

    if (email && email.trim()) {
      const cleanEmail = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        emailAvailable = false;
        emailError = 'Enter a valid email address';
      } else {
        const taken = await this.isEmailTaken(cleanEmail, userId);
        if (taken) {
          emailAvailable = false;
          emailError = 'That email is taken. Try another.';
        }
      }
    }

    if (handle && handle.trim()) {
      let cleanHandle = handle.trim().toLowerCase();
      if (cleanHandle.startsWith('@')) cleanHandle = cleanHandle.substring(1);

      if (!/^[a-zA-Z0-9_]{3,30}$/.test(cleanHandle)) {
        handleAvailable = false;
        handleError = 'Username must be 3-30 characters (letters, numbers, underscores)';
      } else {
        const taken = await this.isHandleTaken(cleanHandle, userId);
        if (taken) {
          handleAvailable = false;
          handleError = 'That username is taken. Try another.';
        }
      }
    }

    return {
      available: emailAvailable && handleAvailable,
      emailAvailable,
      emailError,
      handleAvailable,
      handleError,
    };
  },

  async registerUser({ name, email, handle, password, accountType = 'personal', birthday = '', gender = '', phone = '', billingAddress = null, signupBrowserKey = null }) {
    if (!name || !name.trim()) throw new Error('Name is required.');
    if (!email || !email.trim()) throw new Error('Email is required.');
    if (!password || password.length < 6) throw new Error('Password must be at least 6 characters.');

    const cleanEmail = email.trim().toLowerCase();
    let rawHandle = (handle && handle.trim())
      ? handle.trim()
      : `@${name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')}`;
    if (!rawHandle.startsWith('@')) rawHandle = `@${rawHandle}`;
    const cleanHandle = rawHandle;
    const cleanHandleName = cleanHandle.substring(1);

    // 1. Strict Email Uniqueness Check
    const emailTaken = await this.isEmailTaken(cleanEmail);
    if (emailTaken) {
      throw new Error('That email is taken. Try another.');
    }

    // 2. Strict Handle Format & Uniqueness Check
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(cleanHandleName)) {
      throw new Error('Username must be 3-30 characters and can only contain letters, numbers, and underscores.');
    }

    const handleTaken = await this.isHandleTaken(cleanHandleName);
    if (handleTaken) {
      throw new Error('That username is taken. Try another.');
    }

    // Generate unique Tiwi ID (TIWI ID: e.g. TIW-58291)
    const masterUsers = await MasterDB.getUsers();
    let tiwiId;
    let isUnique = false;
    while (!isUnique) {
      const randomNum = Math.floor(10000 + Math.random() * 90000);
      tiwiId = `TIW-${randomNum}`;
      if (!masterUsers.some(u => u.tiwiId === tiwiId || u.storeId === tiwiId)) {
        isUnique = true;
      }
    }

    const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name.trim())}&background=0B57D0&color=fff&size=256&bold=true`;
    const cleanAccountType = accountType === 'business' ? 'business' : 'personal';

    const normalizedBilling = billingAddress || {
      country: 'Bangladesh',
      city: 'Dhaka',
      address: '',
      phone: phone || '',
      postalCode: ''
    };

    // Create user in MasterDB (Unified ecosystem: Dashboard + Platform + Social)
    const newMasterUser = await MasterDB.createUser({
      signupBrowserKey,
      tiwiId,
      name: name.trim(),
      storeName: name.trim(),
      email: cleanEmail,
      password,
      role: 'owner',
      accountType: cleanAccountType,
      planId: 'free',
      planName: 'Free Starter',
      avatar: defaultAvatar,
      twoFactorEnabled: false,
      emailVerified: false,
      dateOfBirth: birthday || '',
      gender: gender || 'Rather not say',
      phone: phone || '',
      billingDetails: normalizedBilling
    });

    // Save profile metadata in social database
    const data = (await this.getData());
    if (!data.profiles) data.profiles = {};
    data.profiles[newMasterUser.id] = {
      name: name.trim(),
      handle: cleanHandle,
      avatar: defaultAvatar,
      coverPhoto: null,
      accountType: cleanAccountType,
      bio: cleanAccountType === 'business' ? 'Official Business Account • Tiwlo' : 'Tiwlo Member',
      location: normalizedBilling.city ? `${normalizedBilling.city}, ${normalizedBilling.country || 'Bangladesh'}` : '',
      website: '',
      isVerified: cleanAccountType === 'business',
      birthday: birthday || '',
      gender: gender || 'Rather not say',
      phone: phone || '',
      backupPhones: [],
      recoveryEmail: '',
      billingAddress: normalizedBilling,
      workAddress: '',
      privacySettings: {
        protectPosts: false,
        photoTagging: true,
        locationSharing: false,
        discoverability: true,
      },
      advancedSettings: {
        personalizedAds: true,
        dataCollection: true,
        reduceMotion: false,
        increaseContrast: false,
        language: 'English (United States)',
        appIcon: 'Default',
      },
    };
    (await this.saveData(data));

    const socialUser = this._toSocialUser(newMasterUser, data.profiles[newMasterUser.id], data);
    const token = `tiwi_token_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    const { password: _, ...safeUser } = socialUser;
    return { success: true, user: safeUser, token };
  },

  async updateProfile(userId, updates = {}) {
    const data = (await this.getData());
    if (!data.profiles) data.profiles = {};

    const cleanId = String(userId).trim().toLowerCase();
    const masterUsers = await MasterDB.getUsers();
    const masterUser = masterUsers.find((u) =>
      String(u.id).toLowerCase() === cleanId ||
      u.tiwiId?.toLowerCase() === cleanId ||
      u.storeId?.toLowerCase() === cleanId ||
      u.email?.toLowerCase() === cleanId
    );

    if (!masterUser) return null;
    const targetKey = masterUser.id;

    if (!data.profiles[targetKey]) {
      data.profiles[targetKey] = {
        name: masterUser.name || 'User',
        handle: `@${(masterUser.storeName || '').toLowerCase().replace(/[^a-z0-9_]/g, '')}`,
        avatar: masterUser.avatar,
      };
    }

    // Merge allowed updates into profile
    const allowed = ['name', 'handle', 'avatar', 'coverPhoto', 'bio', 'location', 'website', 'birthday', 'gender', 'phone', 'billingAddress', 'workAddress'];
    allowed.forEach((key) => {
      if (updates[key] !== undefined) {
        data.profiles[targetKey][key] = updates[key];
      }
    });

    (await this.saveData(data));

    // Sync avatar & user details directly to MasterDB (propagates to PostgreSQL system_users)
    const masterUpdates = {};
    if (updates.name) masterUpdates.name = updates.name;
    if (updates.avatar) masterUpdates.avatar = updates.avatar;
    if (updates.coverPhoto) masterUpdates.coverPhoto = updates.coverPhoto;
    if (updates.phone) masterUpdates.phone = updates.phone;
    if (updates.birthday) {
      masterUpdates.dateOfBirth = updates.birthday;
      masterUpdates.birthday = updates.birthday;
    }
    if (updates.gender) masterUpdates.gender = updates.gender;
    if (updates.billingAddress) masterUpdates.billingDetails = updates.billingAddress;

    if (Object.keys(masterUpdates).length > 0) {
      try {
        await MasterDB.updateUser(targetKey, masterUpdates);
      } catch (err) {
        console.warn('[SocialDB.updateProfile] MasterDB sync warning:', err.message);
      }
    }

    // Also update any recent feed posts and reels authored by this user so avatar refreshes immediately
    if (updates.avatar || updates.name) {
      try {
        (data.posts || []).forEach((p) => {
          if (p.author?.id === targetKey || p.author?.id === masterUser.tiwiId) {
            if (updates.avatar) p.author.avatar = updates.avatar;
            if (updates.name) p.author.name = updates.name;
          }
        });
        (data.reels || []).forEach((r) => {
          if (r.author?.id === targetKey || r.author?.id === masterUser.tiwiId) {
            if (updates.avatar) r.author.avatar = updates.avatar;
            if (updates.name) r.author.name = updates.name;
          }
        });
        (await this.saveData(data));
      } catch (postSyncErr) {}
    }

    return this._toSocialUser(masterUser, data.profiles[targetKey], data);
  },

  async updatePrivacySettings(userId, settings = {}) {
    const data = (await this.getData());
    if (!data.profiles) data.profiles = {};
    if (!data.profiles[userId]) {
      const user = await this.findUserById(userId);
      data.profiles[userId] = {
        name: user?.name || 'User',
        handle: user?.handle || '@user',
        avatar: user?.avatar,
      };
    }
    data.profiles[userId].privacySettings = {
      ...(data.profiles[userId].privacySettings || {}),
      ...settings,
    };
    (await this.saveData(data));
    return data.profiles[userId].privacySettings;
  },

  async updateAdvancedSettings(userId, settings = {}) {
    const data = (await this.getData());
    if (!data.profiles) data.profiles = {};
    if (!data.profiles[userId]) {
      const user = await this.findUserById(userId);
      data.profiles[userId] = {
        name: user?.name || 'User',
        handle: user?.handle || '@user',
        avatar: user?.avatar,
      };
    }
    data.profiles[userId].advancedSettings = {
      ...(data.profiles[userId].advancedSettings || {}),
      ...settings,
    };
    (await this.saveData(data));
    return data.profiles[userId].advancedSettings;
  },

  async changePassword(userId, oldPassword, newPassword, currentSessionToken = null) {
    if (!newPassword || newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters long.');
    }
    const user = await MasterDB.findUserById(userId);
    if (!user) {
      throw new Error('User account not found.');
    }
    const isMatch = await PasswordSecurity.verify(oldPassword, user.password);
    if (!isMatch) {
      throw new Error('Current password is incorrect.');
    }
    const newHashed = await PasswordSecurity.hash(newPassword);
    await MasterDB.updatePasswordAndRevokeSessions(userId, newHashed, currentSessionToken);
    return { success: true, message: 'Password updated successfully.' };
  },

  // ====================================================================
  // FEED POSTS
  // ====================================================================
  async getPosts(currentUserId = null, filter = 'for_you') {
    const data = (await this.getData());
    let posts = [...(data.posts || [])];

    // MasterDB Single Source of Truth: Get Banned Users
    const masterUsers = await MasterDB.getUsers();
    const bannedUserIds = new Set(masterUsers.filter((u) => u.isBanned).map((u) => u.id));

    // 1. Exclude posts from banned users
    posts = posts.filter((p) => !bannedUserIds.has(p.author?.id));

    // 2. Violated posts (Community Standards removals) NEVER appear in public feeds
    posts = posts.filter((p) => !p.isPolicyViolated);

    if (filter === 'following') {
      const myFollows = (data.follows || [])
        .filter((f) => f.followerId === currentUserId)
        .map((f) => f.followingId);
      const filtered = posts.filter(
        (p) => myFollows.includes(p.author?.id) || p.author?.id === currentUserId
      );
      if (filtered.length > 0) {
        posts = filtered;
      }
    } else if (filter === 'trending') {
      posts.sort((a, b) => {
        const parseCount = (val) => {
          if (!val) return 0;
          const str = String(val).toUpperCase();
          if (str.includes('K')) return parseFloat(str) * 1000;
          if (str.includes('M')) return parseFloat(str) * 1000000;
          return parseInt(str, 10) || 0;
        };
        const scoreA = parseCount(a.likesCount) + parseCount(a.repostsCount) * 2 + parseCount(a.commentsCount);
        const scoreB = parseCount(b.likesCount) + parseCount(b.repostsCount) * 2 + parseCount(b.commentsCount);
        return scoreB - scoreA;
      });
    }

    return posts.map((post) => {
      const isLiked = (data.likes || []).some(
        (l) => l.userId === currentUserId && l.targetId === post.id
      );
      const isSaved = (data.saves || []).some(
        (s) => s.userId === currentUserId && s.targetId === post.id
      );
      const authorProfile = data.profiles ? (data.profiles[post.author?.id] || Object.values(data.profiles).find((pr) => pr.handle === post.author?.handle)) : null;
      const resolvedAvatar = authorProfile?.avatar || post.author?.avatar;
      return {
        ...post,
        author: {
          ...post.author,
          avatar: resolvedAvatar,
        },
        isLiked,
        isSaved,
      };
    });
  },

  async getUserPosts(targetUserId, currentUserId = null) {
    const data = (await this.getData());
    const effectiveViewer = currentUserId || null;

    const targetUser =
      (await this.findUserById(targetUserId)) ||
      (await this.findUserByHandleOrEmail(targetUserId));
    const targetId = targetUser?.id || targetUserId;
    const targetHandle = targetUser?.handle?.toLowerCase();

    // If target account is banned/disabled and viewer is NOT the user themselves, return empty list
    if (targetUser?.isBanned && effectiveViewer !== targetId) {
      return [];
    }

    let userPosts = (data.posts || []).filter((p) => {
      if (p.author?.id === targetId) return true;
      if (targetHandle && p.author?.handle?.toLowerCase() === targetHandle) return true;
      return false;
    });

    // If viewer is NOT the author of these posts, DO NOT show violated posts
    if (effectiveViewer !== targetId) {
      userPosts = userPosts.filter((p) => !p.isPolicyViolated);
    }

    return userPosts.map((post) => {
      const isLiked = (data.likes || []).some(
        (l) => l.userId === effectiveViewer && l.targetId === post.id
      );
      const isSaved = (data.saves || []).some(
        (s) => s.userId === effectiveViewer && s.targetId === post.id
      );
      const authorProfile = data.profiles ? (data.profiles[post.author?.id] || Object.values(data.profiles).find((pr) => pr.handle === post.author?.handle)) : null;
      const resolvedAvatar = authorProfile?.avatar || post.author?.avatar;
      return {
        ...post,
        author: {
          ...post.author,
          avatar: resolvedAvatar,
        },
        isLiked,
        isSaved,
      };
    });
  },

  async getPostById(postId, currentUserId = null) {
    const data = (await this.getData());
    const post = (data.posts || []).find((p) => p.id === postId);
    if (!post) return null;
    const isLiked = (data.likes || []).some(
      (l) => l.userId === currentUserId && l.targetId === post.id
    );
    const isSaved = (data.saves || []).some(
      (s) => s.userId === currentUserId && s.targetId === post.id
    );
    return { ...post, isLiked, isSaved };
  },

  async recordPostView(postId, viewerId) {
    const data = (await this.getData());
    const post = (data.posts || []).find((item) => item.id === postId);
    if (!post) return null;

    if (isPgActive()) {
      const result = await queryPg(`
        WITH inserted_view AS (
          INSERT INTO social_post_views (post_id, viewer_id)
          VALUES ($1, $2)
          ON CONFLICT (post_id, viewer_id) DO NOTHING
          RETURNING post_id
        )
        UPDATE social_posts
        SET views_count = views_count + 1
        WHERE id = $1 AND EXISTS (SELECT 1 FROM inserted_view)
        RETURNING views_count
      `, [postId, viewerId]);
      const countResult = result?.rows?.length
        ? result
        : await queryPg('SELECT views_count FROM social_posts WHERE id = $1', [postId]);
      post.viewsCount = String(countResult.rows[0]?.views_count || 0);
      return { viewsCount: post.viewsCount };
    }

    if (!Array.isArray(data.postViews)) data.postViews = [];
    const alreadyViewed = data.postViews.some(
      (view) => view.postId === postId && view.viewerId === viewerId
    );
    if (!alreadyViewed) {
      data.postViews.push({ postId, viewerId });
      post.viewsCount = String(Number(post.viewsCount || 0) + 1);
      (await this.saveData(data));
    }
    return { viewsCount: String(post.viewsCount || 0) };
  },

  async createPost({ authorId = null, caption, images = [] }) {
    const data = (await this.getData());
    const user = (await this.findUserById(authorId)) || {
      id: authorId,
      name: 'User',
      handle: '@user',
      avatar: 'https://ui-avatars.com/api/?name=User&background=0284c7&color=fff&size=200',
      isVerified: false,
    };

    // Deduplication shield: prevent duplicate submissions within 8 seconds
    const now = Date.now();
    const existingRecent = (data.posts || []).find(p =>
      p.author?.id === user.id &&
      (p.caption || '') === (caption || '') &&
      (now - new Date(p.createdAt).getTime() < 8000)
    );
    if (existingRecent) {
      return existingRecent;
    }

    const newPost = {
      id: `post_${Date.now()}`,
      author: {
        id: user.id,
        name: user.name,
        handle: user.handle,
        avatar: user.avatar,
        isVerified: user.isVerified || false,
      },
      timeAgo: 'Just now',
      caption: caption || '',
      images: images.length > 0 ? images : [],
      image: images.length > 0 ? images[0] : null,
      likesCount: '0',
      commentsCount: '0',
      repostsCount: '0',
      viewsCount: '0',
      isLiked: false,
      isSaved: false,
      createdAt: new Date().toISOString(),
      comments: [],
    };

    data.posts.unshift(newPost);
    (await this.saveData(data));

    if (isPgActive()) {
      try {
        await queryPg(`
          INSERT INTO social_posts (id, author_id, caption, media_urls, likes_count, comments_count, shares_count, created_at, updated_at)
          VALUES ($1, $2, $3, $4, 0, 0, 0, NOW(), NOW())
          ON CONFLICT (id) DO NOTHING
        `, [newPost.id, user.id, newPost.caption, JSON.stringify(newPost.images)]);
      } catch (pgErr) {
        console.warn('[SocialDB.createPost] PostgreSQL insert notice:', pgErr.message);
      }
    }

    // Auto-Route Video Posts into Reels (with crossPostToFeed = FALSE to eliminate duplicate posts)
    const videoMedia = (images || []).find(url => typeof url === 'string' && /\.(mp4|mov|webm|mkv|m4v)(\?|$)/i.test(url));
    if (videoMedia) {
      try {
        await this.createReel({
          authorId: user.id,
          caption: caption || '',
          videoUrl: videoMedia,
          image: videoMedia,
          audioTitle: `Original sound - ${user.name || 'Creator'}`,
          crossPostToFeed: false
        });
      } catch (reelErr) {
        console.warn('[AutoReel] Failed to auto-create reel for video post:', reelErr.message);
      }
    }

    return newPost;
  },

  async isAuthorOrAdmin(post, userOrId) {
    if (!post || !userOrId) return false;
    let user = typeof userOrId === 'object' && userOrId !== null ? userOrId : await this.findUserById(userOrId);
    if (!user && typeof userOrId === 'string') {
      user = await this.findUserByHandleOrEmail(userOrId);
    }
    const userId = user?.id || (typeof userOrId === 'string' ? userOrId : null);
    const userTiwiId = user?.tiwiId || user?.storeId;
    const userEmail = user?.email?.toLowerCase();
    const userHandle = user?.handle?.toLowerCase()?.replace(/^@/, '');
    const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

    if (isAdmin) return true;

    const authorId = post.author?.id;
    const authorHandle = post.author?.handle?.toLowerCase()?.replace(/^@/, '');
    const authorEmail = post.author?.email?.toLowerCase();

    return Boolean(
      (authorId && (authorId === userId || authorId === userTiwiId || authorId === userEmail)) ||
      (authorHandle && userHandle && authorHandle === userHandle) ||
      (authorEmail && userEmail && authorEmail === userEmail) ||
      (userId && authorId && String(userId).toLowerCase() === String(authorId).toLowerCase())
    );
  },

  async deletePost(postId, userOrId) {
    const data = (await this.getData());
    const index = (data.posts || []).findIndex(p => p.id === postId);
    if (index === -1) {
      throw new Error('Post not found');
    }
    const post = data.posts[index];
    const canDelete = await this.isAuthorOrAdmin(post, userOrId);
    if (!canDelete) {
      throw new Error('Unauthorized to delete this post');
    }
    data.posts.splice(index, 1);

    // Also remove any linked reel if applicable
    if (Array.isArray(data.reels)) {
      data.reels = data.reels.filter(r => r.id !== postId);
    }

    (await this.saveData(data));
    return { success: true, deletedPostId: postId };
  },

  async editPost(postId, userOrId, { caption }) {
    const data = (await this.getData());
    const post = (data.posts || []).find(p => p.id === postId);
    if (!post) throw new Error('Post not found');
    const canEdit = await this.isAuthorOrAdmin(post, userOrId);
    if (!canEdit) throw new Error('Unauthorized to edit this post');
    post.caption = (caption || '').trim();
    post.editedAt = new Date().toISOString();
    (await this.saveData(data));
    return post;
  },

  async pinPost(postId, userOrId) {
    const data = (await this.getData());
    const post = (data.posts || []).find(p => p.id === postId);
    if (!post) throw new Error('Post not found');
    const canPin = await this.isAuthorOrAdmin(post, userOrId);
    if (!canPin) throw new Error('Unauthorized to pin this post');
    post.isPinned = !post.isPinned;
    (await this.saveData(data));
    return { success: true, isPinned: post.isPinned };
  },

  async markPostViolated(postId, violationDetails = {}) {
    const data = (await this.getData());
    const postIndex = (data.posts || []).findIndex((p) => p.id === postId);
    if (postIndex === -1) return null;

    data.posts[postIndex].isPolicyViolated = true;
    data.posts[postIndex].violationDetails = {
      reason: violationDetails.reason || 'Adult & Sexually Explicit Content',
      policyName: violationDetails.policyName || 'Adult & Sexually Explicit Content Policy',
      removedAt: violationDetails.removedAt || new Date().toISOString(),
    };
    // Purge media pointers so client renders the policy violation card
    data.posts[postIndex].image = null;
    data.posts[postIndex].images = [];

    (await this.saveData(data));
    return data.posts[postIndex];
  },

  async toggleLikePost(postId, userId = null) {
    const data = (await this.getData());
    const postIndex = data.posts.findIndex((p) => p.id === postId);
    if (postIndex === -1) return null;

    const likeIndex = (data.likes || []).findIndex(
      (l) => l.userId === userId && l.targetId === postId
    );

    let isLiked = false;
    let currentLikes = parseInt(data.posts[postIndex].likesCount, 10) || 0;

    if (likeIndex > -1) {
      data.likes.splice(likeIndex, 1);
      isLiked = false;
      currentLikes = Math.max(0, currentLikes - 1);
    } else {
      data.likes.push({ userId, targetId: postId, createdAt: new Date().toISOString() });
      isLiked = true;
      currentLikes += 1;
    }

    data.posts[postIndex].isLiked = isLiked;
    data.posts[postIndex].likesCount = currentLikes.toString();
    (await this.saveData(data));

    return data.posts[postIndex];
  },

  async toggleSavePost(postId, userId = null) {
    const data = (await this.getData());
    const postIndex = data.posts.findIndex((p) => p.id === postId);
    if (postIndex === -1) return null;

    const saveIndex = (data.saves || []).findIndex(
      (s) => s.userId === userId && s.targetId === postId
    );

    let isSaved = false;
    if (saveIndex > -1) {
      data.saves.splice(saveIndex, 1);
      isSaved = false;
    } else {
      data.saves.push({ userId, targetId: postId, createdAt: new Date().toISOString() });
      isSaved = true;
    }

    data.posts[postIndex].isSaved = isSaved;
    (await this.saveData(data));
    return data.posts[postIndex];
  },

  async addComment(postId, { authorId = null, text }) {
    const data = (await this.getData());
    const postIndex = data.posts.findIndex((p) => p.id === postId);
    if (postIndex === -1) return null;

    const user = (await this.findUserById(authorId)) || {
      id: authorId,
      name: 'User',
      avatar: 'https://ui-avatars.com/api/?name=User&background=0284c7&color=fff&size=200',
      isVerified: false,
    };

    const newComment = {
      id: `c_${Date.now()}`,
      author: user.name,
      avatar: user.avatar,
      isVerified: user.isVerified || false,
      text: text.trim(),
      timeAgo: 'Just now',
      likesCount: 0,
      createdAt: new Date().toISOString(),
    };

    if (!data.posts[postIndex].comments) {
      data.posts[postIndex].comments = [];
    }
    data.posts[postIndex].comments.push(newComment);
    data.posts[postIndex].commentsCount = (data.posts[postIndex].comments.length).toString();

    (await this.saveData(data));
    return newComment;
  },

  // ====================================================================
  // REELS
  // ====================================================================
  async getReels(currentUserId = null) {
    const data = (await this.getData());
    const hiddenReelIds = new Set(
      (data.reelPreferences || [])
        .filter((preference) => preference.userId === currentUserId && preference.notInterested)
        .map((preference) => preference.reelId)
    );
    return (data.reels || []).filter((reel) => !hiddenReelIds.has(reel.id)).map((reel) => {
      const isLiked = (data.likes || []).some(
        (l) => l.userId === currentUserId && l.targetId === reel.id
      );
      const isSaved = (data.saves || []).some(
        (s) => s.userId === currentUserId && s.targetId === reel.id
      );
      const authorProfile = data.profiles ? (data.profiles[reel.author?.id] || Object.values(data.profiles).find((pr) => pr.handle === reel.author?.handle)) : null;
      const resolvedAvatar = authorProfile?.avatar || reel.author?.avatar;
      return {
        ...reel,
        author: {
          ...reel.author,
          avatar: resolvedAvatar,
        },
        isLiked,
        isSaved,
      };
    });
  },

  async createReel({ authorId = null, caption, videoUrl, image, audioTitle, crossPostToFeed = true }) {
    const data = (await this.getData());
    const user = (await this.findUserById(authorId)) || {
      id: authorId,
      name: 'User',
      handle: '@user',
      avatar: 'https://ui-avatars.com/api/?name=User&background=0284c7&color=fff&size=200',
      isVerified: false,
    };

    // Deduplication shield: prevent identical duplicate reels within 8 seconds
    const now = Date.now();
    const existingReel = (data.reels || []).find(r =>
      r.author?.id === user.id &&
      r.videoUrl === (videoUrl || '') &&
      (now - new Date(r.createdAt).getTime() < 8000)
    );
    if (existingReel) return existingReel;

    const newReel = {
      id: `reel_${Date.now()}`,
      author: {
        id: user.id,
        name: user.name,
        handle: user.handle,
        avatar: user.avatar,
        isVerified: user.isVerified || false,
      },
      caption: caption || '',
      videoUrl: videoUrl || '',
      image: image || videoUrl || '/apple-touch-icon.png',
      audioTitle: audioTitle || 'Original Audio',
      likesCount: '0',
      commentsCount: '0',
      repostsCount: '0',
      isLiked: false,
      isSaved: false,
      createdAt: new Date().toISOString(),
    };

    data.reels.unshift(newReel);

    // Cross-post Reel into Main Feed as a Video Post so it appears in both Feed and Reels
    if (crossPostToFeed && videoUrl) {
      // Check if this reel media was ALREADY posted to feed in the last 15 seconds to prevent duplicates
      const alreadyInPosts = (data.posts || []).some(p =>
        p.author?.id === user.id &&
        (p.images?.includes(videoUrl) || p.image === videoUrl) &&
        (now - new Date(p.createdAt).getTime() < 15000)
      );

      if (!alreadyInPosts) {
        const feedPost = {
          id: `post_from_reel_${Date.now()}`,
          author: {
            id: user.id,
            name: user.name,
            handle: user.handle,
            avatar: user.avatar,
            isVerified: user.isVerified || false,
          },
          timeAgo: 'Just now',
          caption: caption || '',
          images: [videoUrl],
          image: videoUrl,
          likesCount: '0',
          commentsCount: '0',
          repostsCount: '0',
          isLiked: false,
          isSaved: false,
          createdAt: new Date().toISOString(),
          comments: [],
        };
        data.posts.unshift(feedPost);
        if (isPgActive()) {
          try {
            await queryPg(`
              INSERT INTO social_posts (id, author_id, caption, media_urls, likes_count, comments_count, shares_count, created_at, updated_at)
              VALUES ($1, $2, $3, $4, 0, 0, 0, NOW(), NOW())
              ON CONFLICT (id) DO NOTHING
            `, [feedPost.id, user.id, feedPost.caption, JSON.stringify(feedPost.images)]);
          } catch (e) {}
        }
      }
    }

    if (isPgActive()) {
      try {
        await queryPg(`
          INSERT INTO social_reels (id, author_id, video_url, caption, sound_title, likes_count, views_count, comments_count, created_at)
          VALUES ($1, $2, $3, $4, $5, 0, 0, 0, NOW())
          ON CONFLICT (id) DO NOTHING
        `, [newReel.id, user.id, newReel.videoUrl, newReel.caption, newReel.audioTitle]);
      } catch (pgErr) {
        console.warn('[SocialDB.createReel] PostgreSQL insert notice:', pgErr.message);
      }
    }

    (await this.saveData(data));
    return newReel;
  },

  async toggleLikeReel(reelId, userId = null) {
    const data = (await this.getData());
    const reelIndex = data.reels.findIndex((r) => r.id === reelId);
    if (reelIndex === -1) return null;

    const likeIndex = (data.likes || []).findIndex(
      (l) => l.userId === userId && l.targetId === reelId
    );

    let isLiked = false;
    let currentLikes = parseInt(data.reels[reelIndex].likesCount, 10) || 0;

    if (likeIndex > -1) {
      data.likes.splice(likeIndex, 1);
      isLiked = false;
      currentLikes = Math.max(0, currentLikes - 1);
    } else {
      data.likes.push({ userId, targetId: reelId, createdAt: new Date().toISOString() });
      isLiked = true;
      currentLikes += 1;
    }

    data.reels[reelIndex].isLiked = isLiked;
    data.reels[reelIndex].likesCount = currentLikes.toString();
    (await this.saveData(data));

    return data.reels[reelIndex];
  },

  async deleteReel(reelId, userId) {
    const data = (await this.getData());
    const reelIndex = (data.reels || []).findIndex((reel) => reel.id === reelId);
    if (reelIndex === -1) return { success: false, status: 404, error: 'Reel not found' };
    const reel = data.reels[reelIndex];
    const canDelete = await this.isAuthorOrAdmin(reel, userId);
    if (!canDelete) return { success: false, status: 403, error: 'You can only delete your own Short' };

    data.reels.splice(reelIndex, 1);
    data.likes = (data.likes || []).filter((like) => like.targetId !== reelId);
    data.saves = (data.saves || []).filter((save) => save.targetId !== reelId);
    data.reelPreferences = (data.reelPreferences || []).filter((preference) => preference.reelId !== reelId);
    (await this.saveData(data));
    return { success: true };
  },

  async markReelNotInterested(reelId, userId) {
    const data = (await this.getData());
    if (!(data.reels || []).some((reel) => reel.id === reelId)) return null;
    data.reelPreferences = data.reelPreferences || [];
    const index = data.reelPreferences.findIndex((preference) => preference.reelId === reelId && preference.userId === userId);
    const preference = { reelId, userId, notInterested: true, updatedAt: new Date().toISOString() };
    if (index >= 0) data.reelPreferences[index] = preference;
    else data.reelPreferences.push(preference);
    (await this.saveData(data));
    return preference;
  },

  async reportReel(reelId, reporterId, reason = 'inappropriate') {
    const data = (await this.getData());
    const reel = (data.reels || []).find((item) => item.id === reelId);
    if (!reel) return null;
    data.reelReports = data.reelReports || [];
    const existing = data.reelReports.find((report) => report.reelId === reelId && report.reporterId === reporterId);
    if (existing) return existing;
    const report = { id: `reel_report_${Date.now()}`, reelId, reporterId, reason: String(reason).slice(0, 120), createdAt: new Date().toISOString() };
    data.reelReports.push(report);
    (await this.saveData(data));
    return report;
  },

  // ====================================================================
  // STORIES
  // ====================================================================
  async getStories(currentUserId = null) {
    const data = (await this.getData());
    return data.stories || [];
  },

  async createStory({ userId = null, mediaUrl }) {
    const data = (await this.getData());
    const user = (await this.findUserById(userId)) || {
      id: userId,
      name: 'User',
      avatar: 'https://ui-avatars.com/api/?name=User&background=0284c7&color=fff&size=200',
    };

    const newStory = {
      id: `story_${Date.now()}`,
      userId: user.id,
      name: user.name,
      avatar: user.avatar,
      isSelf: user.id === userId,
      hasUnseen: true,
      mediaUrl: mediaUrl || user.avatar,
      createdAt: new Date().toISOString(),
    };

    data.stories.unshift(newStory);
    (await this.saveData(data));
    return newStory;
  },

  // ====================================================================
  // PROFILE UPDATE & SETTINGS
  // ====================================================================
  async updateProfile(userId = null, fields = {}) {
    const masterUsers = await MasterDB.getUsers();
    const masterUser = masterUsers.find((u) => u.id === userId || u.tiwiId === userId);
    if (!masterUser) return null;

    const data = (await this.getData());
    if (!data.profiles) data.profiles = {};
    const existing = data.profiles[masterUser.id] || {};
    const cleanName = fields.name !== undefined ? String(fields.name).trim() : (existing.name || masterUser.name || '');
    let cleanHandle = fields.handle !== undefined ? String(fields.handle).trim().toLowerCase() : (existing.handle || masterUser.handle || '');
    if (cleanHandle && !cleanHandle.startsWith('@')) cleanHandle = `@${cleanHandle}`;
    if (cleanHandle && cleanHandle !== (existing.handle || masterUser.handle)) {
      const isTaken = await this.isHandleTaken(cleanHandle.slice(1), masterUser.id);
      if (isTaken) throw new Error('That username is already taken. Please choose another.');
    }
    data.profiles[masterUser.id] = {
      ...existing,
      ...fields,
      name: cleanName || existing.name || masterUser.name,
      handle: cleanHandle || existing.handle || masterUser.handle,
      updatedAt: new Date().toISOString(),
    };

    // Update author info on their posts, reels, and comments
    if (fields.name || fields.handle || fields.avatar) {
      (data.posts || []).forEach((p) => {
        if (p.author?.id === masterUser.id || p.author?.id === masterUser.tiwiId || (masterUser.handle && p.author?.handle === masterUser.handle)) {
          if (fields.name) p.author.name = fields.name;
          if (fields.handle) p.author.handle = fields.handle;
          if (fields.avatar) p.author.avatar = fields.avatar;
        }
        (p.comments || []).forEach((c) => {
          if (c.authorId === masterUser.id || c.author === masterUser.name) {
            if (fields.avatar) c.avatar = fields.avatar;
          }
        });
      });
      (data.reels || []).forEach((r) => {
        if (r.author?.id === masterUser.id || r.author?.id === masterUser.tiwiId || (masterUser.handle && r.author?.handle === masterUser.handle)) {
          if (fields.name) r.author.name = fields.name;
          if (fields.handle) r.author.handle = fields.handle;
          if (fields.avatar) r.author.avatar = fields.avatar;
        }
      });
    }

    // 2-Way Sync directly back into MasterDB (Platform / Dashboard user)
    const masterUpdates = {};
    if (fields.name !== undefined) {
      masterUpdates.name = cleanName;
      masterUpdates.storeName = cleanName;
    }
    if (fields.avatar) masterUpdates.avatar = fields.avatar;
    if (fields.coverPhoto) masterUpdates.coverPhoto = fields.coverPhoto;
    if (fields.phone !== undefined) masterUpdates.phone = fields.phone;
    if (fields.birthday !== undefined) {
      masterUpdates.dateOfBirth = fields.birthday;
      masterUpdates.birthday = fields.birthday;
    }
    if (fields.gender !== undefined) masterUpdates.gender = fields.gender;
    if (Object.keys(masterUpdates).length > 0) {
      await MasterDB.updateUser(masterUser.id, masterUpdates);
    }

    (await this.saveData(data));
    const socialUser = this._toSocialUser(masterUser, data.profiles[masterUser.id], data);
    const { password: _, ...safeUser } = socialUser;
    return safeUser;
  },

  async updatePrivacySettings(userId = null, settings = {}) {
    const masterUsers = await MasterDB.getUsers();
    const masterUser = masterUsers.find((u) => u.id === userId || u.tiwiId === userId);
    const targetId = masterUser ? masterUser.id : userId;

    const data = (await this.getData());
    if (!data.profiles) data.profiles = {};
    if (!data.profiles[targetId]) data.profiles[targetId] = {};

    data.profiles[targetId].privacySettings = {
      ...(data.profiles[targetId].privacySettings || {}),
      ...settings,
    };
    (await this.saveData(data));

    if (isPgActive()) {
      await queryPg(`
        INSERT INTO social_profiles (id, privacy_settings, updated_at)
        VALUES ($1, $2::jsonb, NOW())
        ON CONFLICT (id) DO UPDATE
        SET privacy_settings = EXCLUDED.privacy_settings, updated_at = NOW()
      `, [targetId, JSON.stringify(data.profiles[targetId].privacySettings)]);
    }

    return data.profiles[targetId].privacySettings;
  },

  async updateAdvancedSettings(userId = null, settings = {}) {
    const masterUsers = await MasterDB.getUsers();
    const masterUser = masterUsers.find((u) => u.id === userId || u.tiwiId === userId);
    const targetId = masterUser ? masterUser.id : userId;

    const data = (await this.getData());
    if (!data.profiles) data.profiles = {};
    if (!data.profiles[targetId]) data.profiles[targetId] = {};

    data.profiles[targetId].advancedSettings = {
      ...(data.profiles[targetId].advancedSettings || {}),
      ...settings,
    };

    (await this.saveData(data));
    return data.profiles[targetId].advancedSettings;
  },

  async changePassword(userId = null, oldPassword, newPassword) {
    if (!newPassword || newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters long.');
    }
    const masterUsers = await MasterDB.getUsers();
    const masterUser = masterUsers.find((u) => u.id === userId || u.tiwiId === userId);
    if (!masterUser) {
      throw new Error('User not found.');
    }
    if (masterUser.password && oldPassword) {
      const match = PasswordSecurity.verify(oldPassword, masterUser.password);
      if (!match) {
        throw new Error('Incorrect current password.');
      }
    }
    const newHash = PasswordSecurity.hash(newPassword);
    await MasterDB.updateUser(masterUser.id, { password: newHash });
    return { success: true, message: 'Password updated successfully.' };
  },

  // ====================================================================
  // NOTIFICATIONS & MESSAGES
  // ====================================================================
  async addNotification({ recipientId, userId = null, senderId = null, type = 'system', title = '', message = '', snippet = '', thumbnail = null, meta = {} }) {
    const targetId = recipientId || userId;
    if (!targetId) throw new Error('Notification recipient is required.');

    const notif = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      recipientId: targetId,
      userId: targetId,
      senderId,
      type,
      title,
      message,
      content: message,
      snippet,
      thumbnail,
      read: false,
      createdAt: new Date().toISOString(),
      timestamp: new Date().toISOString(),
      meta,
    };

    if (isPgActive()) {
      await queryPg(`
        INSERT INTO social_notifications
          (id, recipient_id, sender_id, type, content, title, snippet, thumbnail, meta, is_read, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, FALSE, NOW())
      `, [
        notif.id,
        targetId,
        senderId,
        type,
        message,
        title,
        snippet,
        thumbnail,
        JSON.stringify(meta),
      ]);
    }

    const data = (await this.getData());
    if (!data.notifications) data.notifications = [];
    data.notifications.unshift(notif);
    if (data.notifications.length > 500) {
      data.notifications = data.notifications.slice(0, 500);
    }
    (await this.saveData(data));
    return notif;
  },

  async getNotifications(userId) {
    if (!userId) return [];
    if (isPgActive()) {
      const result = await queryPg(`
        SELECT n.id, n.recipient_id AS "recipientId", n.sender_id AS "senderId",
               n.type, n.content AS message, n.title, n.snippet, n.thumbnail,
               n.meta, n.is_read AS read, n.created_at AS "createdAt",
               u.id AS "senderUserId", u.name AS "senderName", u.avatar AS "senderAvatar",
               p.handle AS "senderHandle"
        FROM social_notifications n
        LEFT JOIN system_users u ON u.id = n.sender_id
        LEFT JOIN social_profiles p ON p.id = n.sender_id
        WHERE n.recipient_id = $1
        ORDER BY n.created_at DESC
        LIMIT 500
      `, [userId]);
      return result.rows.map((row) => ({
        ...row,
        userId: row.recipientId,
        content: row.message,
        timestamp: row.createdAt,
        user: row.senderId ? {
          id: row.senderUserId,
          name: row.senderName || 'Someone',
          avatar: row.senderAvatar || null,
          handle: row.senderHandle || null,
        } : null,
      }));
    }
    const data = (await this.getData());
    return (data.notifications || []).filter(n => n.recipientId === userId || n.userId === userId);
  },

  async markNotificationRead(notifId, userId = null) {
    if (isPgActive()) {
      const result = await queryPg(`
        UPDATE social_notifications
        SET is_read = TRUE
        WHERE id = $1 AND recipient_id = $2
        RETURNING id
      `, [notifId, userId]);
      return result.rowCount > 0 ? { id: notifId, read: true } : null;
    }
    const data = (await this.getData());
    const notif = (data.notifications || []).find(n => n.id === notifId);
    if (notif) {
      notif.read = true;
      (await this.saveData(data));
    }
    return notif || null;
  },

  async markAllNotificationsRead(userId) {
    if (isPgActive()) {
      await queryPg('UPDATE social_notifications SET is_read = TRUE WHERE recipient_id = $1', [userId]);
      return true;
    }
    const data = (await this.getData());
    if (!userId) return true;
    (data.notifications || []).forEach(n => {
      if (n.recipientId === userId || n.userId === userId) {
        n.read = true;
      }
    });
    (await this.saveData(data));
    return true;
  },

  async getConversations(userId) {
    const data = (await this.getData());
    if (!userId) return [];
    return (data.conversations || []).filter(c => 
      c.participants?.includes(userId) || c.userId === userId || c.recipientId === userId
    );
  },

  async getMessages(conversationId) {
    const data = (await this.getData());
    if (!data.messages) data.messages = {};
    return data.messages[conversationId] || [];
  },

  async sendMessage({ conversationId, senderId = null, text }) {
    const data = (await this.getData());
    if (!data.messages) data.messages = {};
    if (!data.messages[conversationId]) data.messages[conversationId] = [];

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newMsg = {
      id: `msg_${Date.now()}`,
      sender: 'me',
      text: text.trim(),
      time: timeStr,
      createdAt: now.toISOString()
    };
    data.messages[conversationId].push(newMsg);

    const conv = (data.conversations || []).find(c => c.id === conversationId);
    if (conv) {
      conv.lastMessage = text.trim();
      conv.timeAgo = 'Just now';
      conv.unread = false;
    }

    (await this.saveData(data));
    return newMsg;
  },

  async toggleRepostPost(postId, userId = null) {
    const data = (await this.getData());
    const post = (data.posts || []).find(p => p.id === postId);
    if (!post) return null;

    if (!data.reposts) data.reposts = [];
    const idx = data.reposts.findIndex(r => r.userId === userId && r.targetId === postId);
    let current = parseInt(post.repostsCount, 10) || 0;
    let isReposted = false;

    if (idx > -1) {
      data.reposts.splice(idx, 1);
      current = Math.max(0, current - 1);
      isReposted = false;
    } else {
      data.reposts.push({ userId, targetId: postId, createdAt: new Date().toISOString() });
      current += 1;
      isReposted = true;
    }

    post.repostsCount = current.toString();
    post.isReposted = isReposted;
    (await this.saveData(data));
    return post;
  },

  async toggleFollowUser(followerId = null, targetUserId) {
    if (!followerId || !targetUserId) {
      return { error: 'Both followerId and targetUserId are required' };
    }

    const followerUser = await this.findUserById(followerId);
    const targetUser = (await this.findUserById(targetUserId)) || (await this.findUserByHandleOrEmail(targetUserId));

    if (!followerUser || !targetUser) {
      return { error: 'User not found' };
    }

    if (followerUser.id === targetUser.id) {
      return { error: 'You cannot follow yourself' };
    }
    if (followerUser.isBanned || targetUser.isBanned) {
      return { error: 'Disabled accounts cannot follow or be followed.' };
    }

    const data = (await this.getData());
    if (!data.follows) data.follows = [];
    if (!data.followRequests) data.followRequests = [];

    const fId = followerUser.id;
    const tId = targetUser.id;
    const tTiwiId = targetUser.tiwiId || null;

    const idx = data.follows.findIndex(
      (f) =>
        f.followerId === fId &&
        (f.followingId === tId || (tTiwiId && f.followingId === tTiwiId))
    );

    if (idx === -1 && targetUser.privacySettings?.protectPosts) {
      let pendingRequest = data.followRequests.find(
        (request) => request.requesterId === fId && request.recipientId === tId && request.status === 'pending'
      );
      if (isPgActive()) {
        const existingRequest = await queryPg(`
          SELECT id, requester_id AS "requesterId", recipient_id AS "recipientId",
                 status, created_at AS "createdAt"
          FROM social_follow_requests
          WHERE requester_id = $1 AND recipient_id = $2 AND status = 'pending'
        `, [fId, tId]);
        if (existingRequest.rows[0]) {
          return { success: true, isFollowing: false, requestPending: true };
        }
        const result = await queryPg(`
          INSERT INTO social_follow_requests (id, requester_id, recipient_id, status, created_at, updated_at)
          VALUES ($1, $2, $3, 'pending', NOW(), NOW())
          ON CONFLICT (requester_id, recipient_id) DO UPDATE
          SET status = 'pending', created_at = NOW(), updated_at = NOW()
          RETURNING id, requester_id AS "requesterId", recipient_id AS "recipientId",
                    status, created_at AS "createdAt"
        `, [
          pendingRequest?.id || `follow_req_${crypto.randomBytes(8).toString('hex')}`,
          fId,
          tId,
        ]);
        pendingRequest = result.rows[0];
        data.followRequests.push(pendingRequest);
      } else if (pendingRequest) {
        return { success: true, isFollowing: false, requestPending: true };
      } else {
        pendingRequest = {
          id: `follow_req_${crypto.randomBytes(8).toString('hex')}`,
          requesterId: fId,
          recipientId: tId,
          status: 'pending',
          createdAt: new Date().toISOString(),
        };
        data.followRequests.push(pendingRequest);
      }

      await this.addNotification({
        recipientId: tId,
        senderId: fId,
        type: 'follow_request',
        title: 'Follow request',
        message: `${followerUser.name || 'Someone'} requested to follow you.`,
        meta: { requestId: pendingRequest.id, followerId: fId },
      });
      (await this.saveData(data));
      return { success: true, isFollowing: false, requestPending: true };
    }

    let isFollowing = false;
    if (idx > -1) {
      data.follows.splice(idx, 1);
      isFollowing = false;
      if (isPgActive()) {
        await queryPg(`
          DELETE FROM social_follows
          WHERE follower_id = $1 AND (following_id = $2 OR following_id = $3)
        `, [fId, tId, tTiwiId || tId]);
      }
    } else {
      const followId = `f_${fId}_${tId}`;
      data.follows.push({
        id: followId,
        followerId: fId,
        followingId: tId,
        createdAt: new Date().toISOString(),
      });
      isFollowing = true;
      if (isPgActive()) {
        await queryPg(`
          INSERT INTO social_follows (id, follower_id, following_id, created_at)
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT (follower_id, following_id) DO NOTHING
        `, [followId, fId, tId]);
      }

      await this.addNotification({
        recipientId: tId,
        senderId: fId,
        type: 'follow',
        title: 'New Follower',
        message: `${followerUser.name || 'Someone'} started following you.`,
        meta: {
          followerId: fId,
          followerHandle: followerUser.handle,
          followerAvatar: followerUser.avatar,
        },
      });
    }

    (await this.saveData(data));

    const followersCount = data.follows.filter((f) => f.followingId === tId || (tTiwiId && f.followingId === tTiwiId)).length;
    const followingCount = data.follows.filter((f) => f.followerId === fId).length;

    return { success: true, isFollowing, followersCount, followingCount };
  },

  async canDirectMessage(firstUserId, secondUserId) {
    if (!firstUserId || !secondUserId || firstUserId === secondUserId) return false;
    const [firstUser, secondUser] = await Promise.all([
      this.findUserById(firstUserId),
      this.findUserById(secondUserId),
    ]);
    if (!firstUser || !secondUser || firstUser.isBanned || secondUser.isBanned) return false;

    if (isPgActive()) {
      const result = await queryPg(`
        SELECT
          (
            EXISTS (
              SELECT 1 FROM social_follows f1
              JOIN social_follows f2
                ON f2.follower_id = f1.following_id
               AND f2.following_id = f1.follower_id
              WHERE f1.follower_id = $1 AND f1.following_id = $2
            )
            OR EXISTS (
              SELECT 1 FROM social_follow_requests r
              WHERE r.status = 'accepted'
                AND (
                  (r.requester_id = $1 AND r.recipient_id = $2)
                  OR (r.requester_id = $2 AND r.recipient_id = $1)
                )
            )
          ) AS allowed
      `, [firstUser.id, secondUser.id]);
      return result.rows[0]?.allowed === true;
    }

    const follows = (await this.getData()).follows || [];
    const firstFollowsSecond = follows.some(
      (follow) => follow.followerId === firstUser.id && follow.followingId === secondUser.id
    );
    const secondFollowsFirst = follows.some(
      (follow) => follow.followerId === secondUser.id && follow.followingId === firstUser.id
    );
    const acceptedRequest = ((await this.getData()).followRequests || []).some(
      (request) =>
        request.status === 'accepted' &&
        ((request.requesterId === firstUser.id && request.recipientId === secondUser.id) ||
          (request.requesterId === secondUser.id && request.recipientId === firstUser.id))
    );
    return (firstFollowsSecond && secondFollowsFirst) || acceptedRequest;
  },

  async getFollowRequests(recipientId) {
    if (!recipientId) return [];
    if (isPgActive()) {
      const result = await queryPg(`
        SELECT r.id, r.requester_id AS "requesterId", r.recipient_id AS "recipientId",
               r.status, r.created_at AS "createdAt",
               u.name AS "requesterName", u.avatar AS "requesterAvatar", p.handle AS "requesterHandle"
        FROM social_follow_requests r
        JOIN system_users u ON u.id = r.requester_id
        LEFT JOIN social_profiles p ON p.id = r.requester_id
        WHERE r.recipient_id = $1 AND r.status = 'pending'
        ORDER BY r.created_at DESC
      `, [recipientId]);
      return result.rows;
    }
    return ((await this.getData()).followRequests || []).filter(
      (request) => request.recipientId === recipientId && request.status === 'pending'
    );
  },

  async respondToFollowRequest(requestId, recipientId, decision) {
    if (!['accepted', 'rejected'].includes(decision)) {
      throw new Error('Follow request decision must be accepted or rejected.');
    }
    const data = (await this.getData());
    let request;
    if (isPgActive()) {
      const result = await queryPg(`
        UPDATE social_follow_requests
        SET status = $1, updated_at = NOW()
        WHERE id = $2 AND recipient_id = $3 AND status = 'pending'
        RETURNING id, requester_id AS "requesterId", recipient_id AS "recipientId", status
      `, [decision, requestId, recipientId]);
      request = result.rows[0];
      if (request) {
        const localRequest = (data.followRequests || []).find((item) => item.id === request.id);
        if (localRequest) localRequest.status = decision;
      }
    } else {
      request = (data.followRequests || []).find(
        (item) => item.id === requestId && item.recipientId === recipientId && item.status === 'pending'
      );
      if (request) request.status = decision;
    }

    if (!request) return null;
    if (decision === 'accepted') {
      if (isPgActive()) {
        await queryPg(`
          INSERT INTO social_follows (id, follower_id, following_id, created_at)
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT (follower_id, following_id) DO NOTHING
        `, [`f_${request.requesterId}_${request.recipientId}`, request.requesterId, request.recipientId]);
      }
      data.follows.push({
        id: `f_${request.requesterId}_${request.recipientId}`,
        followerId: request.requesterId,
        followingId: request.recipientId,
        createdAt: new Date().toISOString(),
      });
    }

    const actor = await this.findUserById(recipientId);
    await this.addNotification({
      recipientId: request.requesterId,
      senderId: recipientId,
      type: decision === 'accepted' ? 'follow_request_accepted' : 'follow_request_rejected',
      title: decision === 'accepted' ? 'Follow request accepted' : 'Follow request declined',
      message: `${actor?.name || 'The user'} ${decision === 'accepted' ? 'accepted' : 'declined'} your follow request.`,
      meta: { requestId: request.id, recipientId },
    });
    (await this.saveData(data));
    return request;
  },

  async getUserFollowers(targetUserId, currentUserId = null) {
    if (!targetUserId) return [];
    const targetUser = (await this.findUserById(targetUserId)) || (await this.findUserByHandleOrEmail(targetUserId));
    if (!targetUser) return [];

    const data = (await this.getData());
    const follows = data.follows || [];
    const tId = targetUser.id;
    const tTiwiId = targetUser.tiwiId || null;

    const matchedFollows = follows.filter(
      (f) => f.followingId === tId || (tTiwiId && f.followingId === tTiwiId)
    );

    const followers = [];
    for (const f of matchedFollows) {
      const u = await this.findUserById(f.followerId, currentUserId);
      if (u && !u.isBanned) {
        const { password: _, ...safeUser } = u;
        followers.push(safeUser);
      }
    }
    return followers;
  },

  async getUserFollowing(targetUserId, currentUserId = null) {
    if (!targetUserId) return [];
    const targetUser = (await this.findUserById(targetUserId)) || (await this.findUserByHandleOrEmail(targetUserId));
    if (!targetUser) return [];

    const data = (await this.getData());
    const follows = data.follows || [];
    const tId = targetUser.id;
    const tTiwiId = targetUser.tiwiId || null;

    const matchedFollows = follows.filter(
      (f) => f.followerId === tId || (tTiwiId && f.followerId === tTiwiId)
    );

    const followingList = [];
    for (const f of matchedFollows) {
      const u = await this.findUserById(f.followingId, currentUserId);
      if (u && !u.isBanned) {
        const { password: _, ...safeUser } = u;
        followingList.push(safeUser);
      }
    }
    return followingList;
  },

  // ====================================================================
  // SEARCH & EXPLORE (DIRECTLY REFLECTS MASTERDB USERS)
  // ====================================================================
  async getAllUsers(currentUserId = null) {
    const masterUsers = await MasterDB.getUsers();
    const data = (await this.getData());
    const profiles = data.profiles || {};

    return masterUsers
      .filter((u) => !u.isBanned && (!currentUserId || (u.id !== currentUserId && u.tiwiId !== currentUserId)))
      .map((u) => {
        const socialUser = this._toSocialUser(u, profiles[u.id] || {}, data, currentUserId);
        const { password: _, ...safeUser } = socialUser;
        return safeUser;
      });
  },

  async search(query = '', currentUserId = null) {
    const allUsers = await this.getAllUsers(currentUserId);
    const data = (await this.getData());
    const q = query.trim().toLowerCase();

    // Single source of truth: Get banned user IDs
    const masterUsers = await MasterDB.getUsers();
    const bannedUserIds = new Set(masterUsers.filter((u) => u.isBanned).map((u) => u.id));

    // Exclude banned users' posts and policy violated posts from search results
    const eligiblePosts = (data.posts || []).filter(
      (p) => !p.isPolicyViolated && !bannedUserIds.has(p.author?.id)
    );

    if (!q) {
      return {
        users: allUsers.slice(0, 10),
        posts: eligiblePosts.slice(0, 10),
      };
    }

    const matchedUsers = allUsers.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.handle?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.tiwiId?.toLowerCase().includes(q)
    );

    const matchedPosts = eligiblePosts.filter(
      (p) =>
        (p.caption && p.caption.toLowerCase().includes(q)) ||
        (p.author?.name && p.author.name.toLowerCase().includes(q)) ||
        (p.author?.handle && p.author.handle.toLowerCase().includes(q))
    );

    return { users: matchedUsers, posts: matchedPosts };
  },

  async getRealTrendingHashtags() {
    const data = (await this.getData());
    const tagCounts = {};
    (data.posts || []).forEach((p) => {
      if (p.caption && !p.isPolicyViolated) {
        const matches = p.caption.match(/#[a-zA-Z0-9_]+/g);
        if (matches) {
          matches.forEach((t) => {
            const clean = t.trim();
            tagCounts[clean] = (tagCounts[clean] || 0) + 1;
          });
        }
      }
    });

    const sorted = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count], idx) => ({
        rank: String(idx + 1),
        tag,
        category: 'Trending on Tiwi',
        count: `${count} post${count > 1 ? 's' : ''}`,
      }));

    return sorted;
  },
};
