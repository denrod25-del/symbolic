import {
  AIR_ACCEL,
  AIR_FRICTION,
  COLORS,
  COYOTE_TIME,
  GRAVITY,
  GROUND_ACCEL,
  GROUND_FRICTION,
  HURT_INVULN,
  JUMP_BUFFER_TIME,
  JUMP_CUT_MULTIPLIER,
  JUMP_SPEED,
  MAX_FALL_SPEED,
  MAX_RUN_SPEED,
  PLAYER_H,
  PLAYER_H_BIG,
  PLAYER_W,
} from '../core/constants';
import type { Input } from '../input/Input';

/** Moves `current` toward `target` by at most `maxDelta`. */
function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(current + maxDelta, target);
  if (current > target) return Math.max(current - maxDelta, target);
  return current;
}

/** Outcome of taking a hit from an enemy. */
export type HitResult = 'died' | 'shrank' | 'invincible';

/**
 * The player character: acceleration/friction, weaker air control, a
 * variable-height jump, coyote time, jump buffering — and a mushroom power-up
 * that makes the player big and grants a one-hit buffer.
 *
 * `update` only sets velocity; position is integrated by the collision step,
 * which sets `onGround`. Height changes with the power state (`h` getter), so
 * the collision system sees the right hitbox automatically.
 */
export class Player {
  x: number;
  y: number;
  readonly w = PLAYER_W;
  vx = 0;
  vy = 0;
  onGround = false;
  facing: 1 | -1 = 1;
  justJumped = false;

  private big = false;
  private hurtTimer = 0; // > 0 means temporarily invincible after a hit
  private jumpHeld = false;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  get h() {
    return this.big ? PLAYER_H_BIG : PLAYER_H;
  }

  get powered() {
    return this.big;
  }

  /** Grows the player (mushroom pickup), keeping their feet planted. */
  grow() {
    if (this.big) return;
    this.big = true;
    this.y -= PLAYER_H_BIG - PLAYER_H;
  }

  /** Resets to the small, non-invincible state (used when starting a fresh run). */
  depower() {
    this.big = false;
    this.hurtTimer = 0;
  }

  /** Applies an enemy hit: shrink if big, die if small, no-op while invincible. */
  hit(): HitResult {
    if (this.hurtTimer > 0) return 'invincible';
    if (this.big) {
      this.big = false;
      this.y += PLAYER_H_BIG - PLAYER_H;
      this.hurtTimer = HURT_INVULN;
      return 'shrank';
    }
    return 'died';
  }

  update(dt: number, input: Input) {
    this.justJumped = false;
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    this.updateHorizontal(dt, input);
    this.updateJump(dt, input);

    this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL_SPEED);

    if (this.vx > 5) this.facing = 1;
    else if (this.vx < -5) this.facing = -1;
  }

  private updateHorizontal(dt: number, input: Input) {
    const dir = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
    const accel = this.onGround ? GROUND_ACCEL : AIR_ACCEL;
    const friction = this.onGround ? GROUND_FRICTION : AIR_FRICTION;

    if (dir !== 0) {
      this.vx = approach(this.vx, dir * MAX_RUN_SPEED, accel * dt);
    } else {
      this.vx = approach(this.vx, 0, friction * dt);
    }
  }

  private updateJump(dt: number, input: Input) {
    this.coyoteTimer = this.onGround ? COYOTE_TIME : Math.max(0, this.coyoteTimer - dt);

    const jump = input.isDown('jump');
    if (jump && !this.jumpHeld) {
      this.jumpBufferTimer = JUMP_BUFFER_TIME;
    } else {
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
    }

    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
      this.vy = -JUMP_SPEED;
      this.jumpBufferTimer = 0;
      this.coyoteTimer = 0;
      this.justJumped = true;
    }

    if (!jump && this.jumpHeld && this.vy < 0) {
      this.vy *= JUMP_CUT_MULTIPLIER;
    }

    this.jumpHeld = jump;
  }

  draw(ctx: CanvasRenderingContext2D) {
    // Blink while invincible after a hit.
    if (this.hurtTimer > 0 && Math.floor(this.hurtTimer * 20) % 2 === 0) return;

    const x = Math.round(this.x);
    const y = Math.round(this.y);
    const { w, h } = this;
    const s = h / PLAYER_H; // vertical scale: 1 when small, taller when big
    const at = (v: number) => y + Math.round(v * s);
    const sz = (v: number) => Math.round(v * s);

    // Cap + brim.
    ctx.fillStyle = COLORS.player;
    ctx.fillRect(x, y, w, sz(5));
    ctx.fillRect(x + (this.facing === 1 ? w - 4 : 0), at(3), 4, sz(2));

    // Face + eye on the facing side.
    ctx.fillStyle = COLORS.playerSkin;
    ctx.fillRect(x + 2, at(5), w - 4, sz(6));
    ctx.fillStyle = COLORS.pupil;
    ctx.fillRect(x + (this.facing === 1 ? w - 5 : 3), at(7), 2, sz(3));

    // Shirt.
    ctx.fillStyle = COLORS.player;
    ctx.fillRect(x, at(11), w, sz(4));

    // Overalls + feet.
    ctx.fillStyle = COLORS.playerOveralls;
    ctx.fillRect(x + 1, at(15), w - 2, y + h - at(15));
    ctx.fillStyle = COLORS.pupil;
    ctx.fillRect(x + 2, y + h - 2, 4, 2);
    ctx.fillRect(x + w - 6, y + h - 2, 4, 2);
  }
}
