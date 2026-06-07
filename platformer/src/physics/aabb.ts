/** An axis-aligned bounding box in world pixels. */
export type Rect = { x: number; y: number; w: number; h: number };

/** True if two boxes overlap (touching edges alone do not count). */
export function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}
