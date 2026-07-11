export const SWIPE_THRESHOLD = 100;

const MIN_FLY_OUT_DISTANCE = 540;
const FLY_OUT_PADDING = 48;

export function getFlyOutDistance(viewportWidth, cardWidth) {
  const viewport = Number.isFinite(viewportWidth) && viewportWidth > 0 ? viewportWidth : 0;
  const card = Number.isFinite(cardWidth) && cardWidth > 0 ? cardWidth : 430;

  return Math.max(MIN_FLY_OUT_DISTANCE, viewport / 2 + card + FLY_OUT_PADDING);
}

export function getSwipeDirection(offsetX) {
  if (!Number.isFinite(offsetX)) {
    return null;
  }

  if (offsetX >= SWIPE_THRESHOLD) {
    return "right";
  }

  if (offsetX <= -SWIPE_THRESHOLD) {
    return "left";
  }

  return null;
}
