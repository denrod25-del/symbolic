import {
  COLORS,
  GRAVITY,
  JUMP_SPEED,
  MAX_FALL_SPEED,
  MOVE_SPEED,
} from '../core/constants';
import type { Input } from '../input/Input';

/**
 * The player character.
 *
 * Milestone 2 scope: instant horizontal velocity, gravity, and a basic
 * press-to-jump. Deliberately *not* implemented yet (milestone 5): acceleration/
 * friction, variable jump height, coyote time, jump buffering.
 *
 * `update` only computes and integrates velocity. Collision resolution (snapping
 * the player out of solid tiles, setting `onGround`) is the caller's job — a
 * temporary floor today, real tile collision in milestone 3.
 */
export class Player {
  x: number;
  y: number;
  readonly w = 16;
  readonly h = 24;
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
      this.onGround = false;
    }
    this.jumpHeld = jump;

    // Gravity, capped at terminal velocity.
    this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL_SPEED);

    // Integrate position.
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = COLORS.player;
    ctx.fillRect(Math.round(this.x), Math.round(this.y), this.w, this.h);
  }
}
