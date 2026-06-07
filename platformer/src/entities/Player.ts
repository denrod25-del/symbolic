import {
  AIR_ACCEL,
  AIR_FRICTION,
  COLORS,
  COYOTE_TIME,
  GRAVITY,
  GROUND_ACCEL,
  GROUND_FRICTION,
  JUMP_BUFFER_TIME,
  JUMP_CUT_MULTIPLIER,
  JUMP_SPEED,
  MAX_FALL_SPEED,
  MAX_RUN_SPEED,
  PLAYER_H,
  PLAYER_W,
} from '../core/constants';
import type { Input } from '../input/Input';

/** Moves `current` toward `target` by at most `maxDelta`. */
function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(current + maxDelta, target);
  if (current > target) return Math.max(current - maxDelta, target);
  return current;
}

/**
 * The player character.
 *
 * Milestone 5 stages B & C: horizontal acceleration & friction (ramp up, slide
 * to a stop, weaker air control), a variable-height jump (release early to cut
 * the hop short), plus coyote time and jump buffering for forgiving controls.
 *
 * `update` only sets velocity. Position is integrated by `moveAndCollide`, which
 * also sets `onGround` — so `onGround` reflects the previous frame's collision,
 * which is what the jump check wants.
 */
export class Player {
  x: number;
  y: number;
  readonly w = PLAYER_W;
  readonly h = PLAYER_H;
  vx = 0;
  vy = 0;
  onGround = false;
  /** Last horizontal facing, for drawing. 1 = right, -1 = left. */
  facing: 1 | -1 = 1;
  /** Set true on the frame a jump fires, for the Game to play a sound. */
  justJumped = false;

  /** Previous-frame jump key state, for edge detection. */
  private jumpHeld = false;
  /** Seconds of remaining grace to jump after leaving the ground. */
  private coyoteTimer = 0;
  /** Seconds remaining on a remembered jump press. */
  private jumpBufferTimer = 0;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  update(dt: number, input: Input) {
    this.justJumped = false;
    this.updateHorizontal(dt, input);
    this.updateJump(dt, input);

    // Gravity, capped at terminal velocity.
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
    // Coyote time: refilled while grounded, counts down once airborne.
    this.coyoteTimer = this.onGround ? COYOTE_TIME : Math.max(0, this.coyoteTimer - dt);

    // Jump buffer: a press is remembered for a short window.
    const jump = input.isDown('jump');
    if (jump && !this.jumpHeld) {
      this.jumpBufferTimer = JUMP_BUFFER_TIME;
    } else {
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
    }

    // Fire when a buffered press meets an available (real or coyote) ground.
    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
      this.vy = -JUMP_SPEED;
      this.jumpBufferTimer = 0;
      this.coyoteTimer = 0; // consume so we can't jump twice off one window
      this.justJumped = true;
    }

    // Variable height: releasing the key mid-rise cuts the upward velocity.
    if (!jump && this.jumpHeld && this.vy < 0) {
      this.vy *= JUMP_CUT_MULTIPLIER;
    }

    this.jumpHeld = jump;
  }

  draw(ctx: CanvasRenderingContext2D) {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    const { w } = this;

    // Cap + hair band.
    ctx.fillStyle = COLORS.player;
    ctx.fillRect(x, y, w, 5);
    ctx.fillRect(x + (this.facing === 1 ? w - 4 : 0), y + 3, 4, 2); // brim

    // Face.
    ctx.fillStyle = COLORS.playerSkin;
    ctx.fillRect(x + 2, y + 5, w - 4, 6);

    // Eye, on the facing side.
    ctx.fillStyle = COLORS.pupil;
    ctx.fillRect(x + (this.facing === 1 ? w - 5 : 3), y + 7, 2, 3);

    // Shirt.
    ctx.fillStyle = COLORS.player;
    ctx.fillRect(x, y + 11, w, 4);

    // Overalls + legs.
    ctx.fillStyle = COLORS.playerOveralls;
    ctx.fillRect(x + 1, y + 15, w - 2, this.h - 15);
    ctx.fillStyle = COLORS.pupil;
    ctx.fillRect(x + 2, y + this.h - 2, 4, 2);
    ctx.fillRect(x + w - 6, y + this.h - 2, 4, 2);
  }
}
