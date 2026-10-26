// Keys look like "avatars/<userId>/<uuid>.webp" or "branches/<id>/<uuid>.webp".
// Each upload gets a new random key, so served images can be cached forever.
export const IMAGE_KEY_PATTERN = /^(avatars\/[A-Za-z0-9_-]+|branches\/\d+)\/[0-9a-f-]{36}\.webp$/;

export const imageUrl = (key: string | null | undefined) => (key ? `/api/images/${key}` : null);

/** The R2 key behind one of our image URLs, if it is one. */
export const keyFromUrl = (url: string | null | undefined) => {
  const key = url?.startsWith("/api/images/") ? url.slice("/api/images/".length) : null;
  return key && IMAGE_KEY_PATTERN.test(key) ? key : null;
};
