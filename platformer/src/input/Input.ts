/**
 * Tracks currently-held keys so game logic can poll input as state
 * (`input.isDown('jump')`) instead of reacting to raw key events inline.
 *
 * Ready for milestone 2 — instantiate it in `main.ts`, call `attach()`, and read
 * it from the player's update step.
 */
export class Input {
  private readonly held = new Set<string>();
  private readonly bindings: Record<string, readonly string[]>;

  /** Maps action names to one or more `KeyboardEvent.code` values. */
  constructor(bindings: Record<string, readonly string[]>) {
    this.bindings = bindings;
  }

  attach(target: Window = window) {
    target.addEventListener('keydown', this.onKeyDown);
    target.addEventListener('keyup', this.onKeyUp);
  }

  detach(target: Window = window) {
    target.removeEventListener('keydown', this.onKeyDown);
    target.removeEventListener('keyup', this.onKeyUp);
  }

  isDown(action: string): boolean {
    const keys = this.bindings[action];
    return keys?.some((code) => this.held.has(code)) ?? false;
  }

  private onKeyDown = (e: KeyboardEvent) => {
    this.held.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.held.delete(e.code);
  };
}

/** Default control scheme. Arrows or WASD to move, Space/Up/W to jump. */
export const DEFAULT_BINDINGS: Record<string, readonly string[]> = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  jump: ['Space', 'ArrowUp', 'KeyW'],
};
