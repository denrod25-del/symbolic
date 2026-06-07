import { CANVAS_HEIGHT, CANVAS_WIDTH } from './core/constants';
import { Game } from './core/Game';
import { GameLoop } from './core/GameLoop';

const canvas = document.querySelector<HTMLCanvasElement>('#game');
if (!canvas) throw new Error('Canvas #game not found');

canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('2D canvas context unavailable');
ctx.imageSmoothingEnabled = false; // crisp pixels for the sprite skin later

const game = new Game();
const loop = new GameLoop({
  update: (dt) => game.update(dt),
  render: () => game.render(ctx),
});

loop.start();
