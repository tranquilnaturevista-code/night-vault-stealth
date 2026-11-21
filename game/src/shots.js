// The screenshot scenes behind ?shot=start|play|alert|win. Each one plays the real rules
// forward from a fresh level for a fixed script, steered by a simple autopilot (a Dijkstra path
// over the tile grid that treats tiles inside a guard's vision cone as costly, so it sneaks
// around cones and only walks into one on purpose for the alert shot), so the frame is what a
// short game really looks like and the same seed always gives the same frame.
import { TILE, STEP, GUARD } from './config.js';
import { isWalkableTile } from './levels.js';
import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_LEVEL_DONE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 30;
const WIN_LIMIT_SECONDS = 240;
const SAMPLE = STEP;

/** Cost of stepping on a tile a guard can currently see (the autopilot routes around cones). */
const WATCHED_COST = 25;

function tileOf(x, y) {
  return { c: Math.floor(x / TILE), r: Math.floor(y / TILE) };
}

function tileCentre(c, r) {
  return { x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 };
}

function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/** Whether a guard's cone covers a tile centre right now. */
function tileWatched(world, c, r) {
  const at = tileCentre(c, r);
  for (const guard of world.state.guards) {
    const dx = at.x - guard.x;
    const dy = at.y - guard.y;
    const d = Math.hypot(dx, dy);
    if (d > GUARD.visionRange) continue;
    if (Math.abs(angleDiff(guard.angle, Math.atan2(dy, dx))) > GUARD.visionHalfAngle) continue;
    if (!world.hasLineOfSight(guard.x, guard.y, at.x, at.y)) continue;
    return true;
  }
  return false;
}

/**
 * Cheapest path (Dijkstra over the 32x20 tile grid) from the player's tile to `goal`, as a list
 * of tile centres. Tiles a guard watches cost extra, so the path sneaks around cones.
 */
function findPath(world, goal) {
  const state = world.state;
  const grid = state.grid;
  const start = tileOf(state.player.x, state.player.y);
  const goalTile = tileOf(goal.x, goal.y);
  const key = (c, r) => r * 32 + c;
  const cost = new Map([[key(start.c, start.r), 0]]);
  const prev = new Map();
  const open = [[0, start.c, start.r]];
  while (open.length > 0) {
    let best = 0;
    for (let i = 1; i < open.length; i++) if (open[i][0] < open[best][0]) best = i;
    const [, c, r] = open.splice(best, 1)[0];
    if (c === goalTile.c && r === goalTile.r) break;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nc >= 32 || nr < 0 || nr >= 20) continue;
      if (!isWalkableTile(grid[nr][nc])) continue;
      const stepCost = 1 + (tileWatched(world, nc, nr) ? WATCHED_COST : 0);
      const next = cost.get(key(c, r)) + stepCost;
      if (next < (cost.get(key(nc, nr)) ?? Infinity)) {
        cost.set(key(nc, nr), next);
        prev.set(key(nc, nr), [c, r]);
        open.push([next, nc, nr]);
      }
    }
  }
  const path = [];
  let cur = [goalTile.c, goalTile.r];
  let guard = 0;
  while (cur && !(cur[0] === start.c && cur[1] === start.r) && guard < 200) {
    path.unshift(tileCentre(cur[0], cur[1]));
    cur = prev.get(key(cur[0], cur[1]));
    guard += 1;
  }
  return path;
}

/** Steer the player along a path: the move vector toward its next node, or {x:0,y:0}. */
function followPath(world, path) {
  while (path.length > 0) {
    const node = path[0];
    const dx = node.x - world.state.player.x;
    const dy = node.y - world.state.player.y;
    if (Math.hypot(dx, dy) < 10) {
      path.shift();
      continue;
    }
    const d = Math.hypot(dx, dy);
    return { x: dx / d, y: dy / d };
  }
  return { x: 0, y: 0 };
}

function nearestIntel(state) {
  let best = null;
  let bestD = Infinity;
  for (const item of state.intel) {
    if (item.taken) continue;
    const d = Math.hypot(item.x - state.player.x, item.y - state.player.y);
    if (d < bestD) {
      bestD = d;
      best = item;
    }
  }
  return best;
}

function nearestGuard(state) {
  let best = null;
  let bestD = Infinity;
  for (const guard of state.guards) {
    const d = Math.hypot(guard.x - state.player.x, guard.y - state.player.y);
    if (d < bestD) {
      bestD = d;
      best = guard;
    }
  }
  return { guard: best, d: bestD };
}

/**
 * Set `world` to the named scene (start, play, alert or win; any other name is start) and return
 * the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  const state = world.state;
  state.lives = 3;
  state.score = 0;
  state.levelScore = 0;
  world.loadLevel(0);

  if (name !== 'play' && name !== 'alert' && name !== 'win') {
    // Title screen over a level whose guards have been patrolling for a while.
    for (let i = 0; i < START_SECONDS / SAMPLE; i++) world.step(SAMPLE, { x: 0, y: 0 }, false, null);
    return { screen: SCREEN_TITLE, best: 0 };
  }

  if (name === 'alert') {
    // Close in on the nearest guard until it starts to spot the player, then hold the 210-250 px
    // band: close enough that the meter keeps filling, far enough that the guard cannot reach
    // the player before the alarm goes up. Then flee, so the frame catches the chase (red cones,
    // "!" markers, the ALARM pill) with all three lives intact.
    const toward = (guard) => {
      const dx = guard.x - state.player.x;
      const dy = guard.y - state.player.y;
      const mag = Math.hypot(dx, dy) || 1;
      return { x: dx / mag, y: dy / mag };
    };
    const away = (guard) => {
      const dx = state.player.x - guard.x;
      const dy = state.player.y - guard.y;
      const mag = Math.hypot(dx, dy) || 1;
      return { x: dx / mag, y: dy / mag };
    };
    let alarmed = false;
    for (let i = 0; i < 1200; i++) {
      const { guard, d } = nearestGuard(state);
      let move;
      if (state.detection < 0.15 && d > 240) move = toward(guard);
      else if (d < 210) move = away(guard);
      else if (d > 250) move = toward(guard);
      else move = { x: 0, y: 0 };
      world.step(SAMPLE, move, false, null);
      if (state.alertLevel === 'alarm') {
        alarmed = true;
        break;
      }
      if (state.lives < 3) break;
    }
    if (alarmed) {
      for (let i = 0; i < 45; i++) {
        const { guard } = nearestGuard(state);
        world.step(SAMPLE, away(guard), false, null);
      }
    }
    return { screen: SCREEN_PLAY, best: 0 };
  }

  // Play and win: sneak to the nearest intel, then the next, then the exit. The play scene
  // stops mid-level (two intel stolen, deep in the gallery with a guard's cone sweeping past);
  // the win scene finishes the level. If the next step of the path is inside a guard's cone
  // while the player is already being spotted, the autopilot waits for the cone to sweep past
  // instead of walking into it (up to 4 seconds, then it goes anyway).
  const win = name === 'win';
  const limit = win ? WIN_LIMIT_SECONDS : PLAY_SECONDS;
  let path = [];
  let pathAge = 0;
  let waitTimer = 0;
  for (let i = 0; i < limit / SAMPLE; i++) {
    if (state.levelComplete) break;
    const target = state.exit.open ? state.exit : nearestIntel(state);
    if (!target) break;
    pathAge += 1;
    if (path.length === 0 || pathAge > 30) {
      path = findPath(world, target);
      pathAge = 0;
    }
    const { d } = nearestGuard(state);
    const sneak = d < (win ? 240 : 300) || state.detection > 0.05;
    let move = followPath(world, path);
    const next = path[0];
    if (next && state.detection > 0.02 && tileWatched(world, Math.floor(next.x / TILE), Math.floor(next.y / TILE))) {
      waitTimer += SAMPLE;
      if (waitTimer <= 4) move = { x: 0, y: 0 };
      else waitTimer = 0;
    } else {
      waitTimer = 0;
    }
    world.step(SAMPLE, move, sneak, null);
    if (!win && state.intelTaken >= 2 && state.elapsed >= 15) break;
  }
  return { screen: win && state.levelComplete ? SCREEN_LEVEL_DONE : SCREEN_PLAY, best: 0 };
}
