/**
 * Media URL resolution helper for Tiwlo Web Client.
 * Ensures uploaded photos from mobile devices (LAN URLs) load seamlessly
 * through Vite's secure HTTPS proxy without Mixed Content browser blocks.
 */
export const resolveAvatarUrl = (url) => {
  if (!url) {
    return '/default-avatar.svg';
  }
  const uploadIndex = url.indexOf('/upload/');
  if (uploadIndex !== -1) {
    return url.substring(uploadIndex);
  }
  const uploadsIndex = url.indexOf('/uploads/');
  if (uploadsIndex !== -1) {
    return url.substring(uploadsIndex);
  }
  return url;
};

export const getOptimalMediaUrl = resolveAvatarUrl;
