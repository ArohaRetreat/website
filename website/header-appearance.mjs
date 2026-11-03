// A short scroll establishes the masthead; only a full photographic header band
// can remove it again. Recomputed from geometry, so reverse/restored scroll agrees.
export function transparentHeader(scrollTop, storyRect = null, headerHeight = 96) {
  return scrollTop <= 24 || !!(
    storyRect && storyRect.top <= 0 && storyRect.bottom >= headerHeight
  );
}
