import {
  COLORS,
  GRAVITY,
  JUMP_SPEED,
  MAX_FALL_SPEED,
  MOVE_SPEED,
  PLAYER_H,
  PLAYER_W,
} from '../core/constants';
import type { Input } from '../input/Input';

/**
 * The player character.
 *
 * Milestone 2–3 scope: instant horizontal velocity, gravity, and a basic
 * press-to-jump. Deliberately *not* implemented yet (milestone 5): acceleration/
 * friction, variable jump height, coyote time, jump buffering.
 *
 * `update` only sets velocity. Position is integrated by `moveAndCollide`, which
 * also sets `onGround` — so `onGround` here reflects the previous frame's
 * collision result, which is exactly what the jump check wants.
 */
export class Player {
  x: number;
  y: number;
  readonly w = PLAYER_W;
  readonly h = PLAYER_H;
  vx = 0;
  vy = 0;
  onGround = false;

  /** Edge-detects the jump key so holding it doesn't auto-bounce on landing. */
  private jumpHeld = false;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  update(dt: number, input: Input) {
    // Horizontal: instant velocity (momentum & friction arrive in milestone 5).
    const dir = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
    this.vx = dir * MOVE_SPEED;

    // Jump: fixed impulse on the rising edge of the key, only when grounded.
    const jump = input.isDown('jump');
    if (jump && !this.jumpHeld && this.onGround) {
      this.vy = -JUMP_SPEED;
    }
    this.jumpHeld = jump;

    // Gravity, capped at terminal velocity.
    this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL_SPEED);
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = COLORS.player;
    ctx.fillRect(Math.round(this.x), Math.round(this.y), this.w, this.h);
  }
}
