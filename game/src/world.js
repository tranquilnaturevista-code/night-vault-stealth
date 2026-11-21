// The game's rules and state, with no drawing and no browser in it: the player, the guards
// and their vision, the intel, the exit, detection, noise, lives and score. step() advances one
// fixed step and returns what happened as bit flags, so the caller can react without the world
// knowing about screens or sound. Nothing here allocates after createWorld returns.
import { TILE, PLAYER, GUARD, DETECTION, NOISE, LIVES, INTEL_POINTS, GHOST_BONUS, TIME_BONUS_PER_SECOND } from './config.js';
import { LEVELS, COLS, ROWS, isSolidTile } from './levels.js';

export const EVENT_PICKUP = 1;
export const EVENT_ALARM = 2;
export const EVENT_CAUGHT = 4;
export const EVENT_LEVEL_COMPLETE = 8;
export const EVENT_GAME_OVER = 16;
export const EVENT_VICTORY = 32;
export const EVENT_CALM = 64;

const TAU = Math.PI * 2;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function dist(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

/** Shortest signed turn from angle `a` to angle `b`, in (-PI, PI]. */
function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d <= -Math.PI) d += TAU;
  return d;
}

function tileAt(grid, col, row) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return '#';
  return grid[row][col];
}

function isSolidAt(grid, x, y) {
  return isSolidTile(tileAt(grid, Math.floor(x / TILE), Math.floor(y / TILE)));
}

/** A circle of `radius` at (x, y) overlaps any solid tile. */
function circleHitsSolid(grid, x, y, radius) {
  const c0 = Math.floor((x - radius) / TILE);
  const c1 = Math.floor((x + radius) / TILE);
  const r0 = Math.floor((y - radius) / TILE);
  const r1 = Math.floor((y + radius) / TILE);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (!isSolidTile(tileAt(grid, c, r))) continue;
      const nearestX = clamp(x, c * TILE, c * TILE + TILE);
      const nearestY = clamp(y, r * TILE, r * TILE + TILE);
      const dx = x - nearestX;
      const dy = y - nearestY;
      if (dx * dx + dy * dy < radius * radius) return true;
    }
  }
  return false;
}

/** Move a circle with wall sliding: try x, then y, keeping each axis that stays clear. */
function moveCircle(grid, pos, dx, dy, radius) {
  const nx = pos.x + dx;
  if (!circleHitsSolid(grid, nx, pos.y, radius)) pos.x = nx;
  const ny = pos.y + dy;
  if (!circleHitsSolid(grid, pos.x, ny, radius)) pos.y = ny;
}

/** True when the straight line between two points crosses no solid tile. */
export function hasLineOfSight(grid, x0, y0, x1, y1) {
  const d = dist(x0, y0, x1, y1);
  const steps = Math.max(1, Math.ceil(d / 6));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (isSolidAt(grid, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
  }
  return true;
}

/**
 * The guard's vision cone as a polygon: rays fanned across the cone, each stopped by the first
 * solid tile (or the cone's range). The renderer draws this; the rules use the same test.
 */
export function visionPolygon(grid, guard) {
  const rays = 26;
  const points = [{ x: guard.x, y: guard.y }];
  for (let i = 0; i <= rays; i++) {
    const a = guard.angle - GUARD.visionHalfAngle + (2 * GUARD.visionHalfAngle * i) / rays;
    let len = GUARD.visionRange;
    const stepLen = 8;
    for (let d = stepLen; d <= GUARD.visionRange; d += stepLen) {
      if (isSolidAt(grid, guard.x + Math.cos(a) * d, guard.y + Math.sin(a) * d)) {
        len = d;
        break;
      }
    }
    points.push({ x: guard.x + Math.cos(a) * len, y: guard.y + Math.sin(a) * len });
  }
  return points;
}

export function createWorld(random) {
  const state = {
    levelIndex: 0,
    level: null,
    grid: null,
    player: { x: 0, y: 0, facing: 0, sneaking: false, moving: false, hidden: false, speed: 0 },
    guards: [],
    intel: [],
    exit: { x: 0, y: 0, open: false },
    detection: 0,
    alertLevel: 'calm',
    lives: LIVES,
    score: 0,
    elapsed: 0,
    levelTime: 0,
    levelScore: 0,
    ghost: true,
    noisePulse: 0,
    noiseRings: [],
    caughtFlash: 0,
    levelComplete: false,
    gameOver: false,
    victory: false,
    totalIntel: 0,
    intelTaken: 0,
  };

  function tileCentre(c, r) {
    return { x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 };
  }

  function loadLevel(index) {
    const level = LEVELS[index];
    state.levelIndex = index;
    state.level = level;
    state.grid = level.map.map((row) => row.split(''));
    state.guards = [];
    state.intel = [];
    state.detection = 0;
    state.alertLevel = 'calm';
    state.levelTime = 0;
    state.ghost = true;
    state.noiseRings = [];
    state.caughtFlash = 0;
    state.levelComplete = false;
    level.map.forEach((row, r) => {
      [...row].forEach((ch, c) => {
        const at = tileCentre(c, r);
        if (ch === 'P') {
          state.player.x = at.x;
          state.player.y = at.y;
          state.player.facing = 0;
        } else if (ch === 'E') {
          state.exit.x = at.x;
          state.exit.y = at.y;
          state.exit.open = false;
        } else if (ch === 'L') {
          state.intel.push({ x: at.x, y: at.y, taken: false });
        }
      });
    });
    level.guards.forEach((route, i) => {
      const start = tileCentre(route[0][0], route[0][1]);
      const waypoints = route.map(([c, r]) => tileCentre(c, r));
      state.guards.push({
        x: start.x,
        y: start.y,
        angle: Math.atan2(waypoints[1].y - start.y, waypoints[1].x - start.x),
        route: waypoints,
        waypointIndex: 1,
        waiting: 0,
        scanPhase: random() * TAU,
        mode: 'patrol',
        investigate: null,
        investigateTimer: 0,
        lastSeen: null,
        unseenTimer: 0,
        id: i,
      });
    });
    state.totalIntel = state.intel.length;
    state.intelTaken = 0;
  }

  function resetPositions() {
    // After being caught: the player and the guards go back to their starts, the intel stays
    // stolen, the detection meter clears. The level is not restarted.
    const level = state.level;
    level.map.forEach((row, r) => {
      [...row].forEach((ch, c) => {
        if (ch === 'P') {
          const at = tileCentre(c, r);
          state.player.x = at.x;
          state.player.y = at.y;
          state.player.facing = 0;
        }
      });
    });
    state.guards.forEach((guard, i) => {
      const start = guard.route[0];
      guard.x = start.x;
      guard.y = start.y;
      guard.angle = Math.atan2(guard.route[1].y - start.y, guard.route[1].x - start.x);
      guard.waypointIndex = 1;
      guard.waiting = 0;
      guard.mode = 'patrol';
      guard.investigate = null;
      guard.lastSeen = null;
      guard.unseenTimer = 0;
    });
    state.detection = 0;
    state.alertLevel = 'calm';
    state.caughtFlash = 1.2;
  }

  function playerInBush() {
    const ch = tileAt(state.grid, Math.floor(state.player.x / TILE), Math.floor(state.player.y / TILE));
    return ch === 'B';
  }

  /** Whether this guard can currently see the player, and how far away the player is. */
  function guardSeesPlayer(guard) {
    const p = state.player;
    const d = dist(guard.x, guard.y, p.x, p.y);
    if (d > GUARD.visionRange) return { sees: false, d };
    if (d < PLAYER.bumpRange) return { sees: true, d };
    if (playerInBush() && d > PLAYER.bushSpotRange) return { sees: false, d };
    const toPlayer = Math.atan2(p.y - guard.y, p.x - guard.x);
    if (Math.abs(angleDiff(guard.angle, toPlayer)) > GUARD.visionHalfAngle) return { sees: false, d };
    if (!hasLineOfSight(state.grid, guard.x, guard.y, p.x, p.y)) return { sees: false, d };
    return { sees: true, d };
  }

  function guardTurnTowards(guard, targetAngle, dt, turnRate) {
    const d = angleDiff(guard.angle, targetAngle);
    const maxTurn = turnRate * dt;
    guard.angle += clamp(d, -maxTurn, maxTurn);
  }

  function guardMoveTowards(guard, tx, ty, speed, dt) {
    const dx = tx - guard.x;
    const dy = ty - guard.y;
    const d = Math.hypot(dx, dy);
    if (d < 2) return true;
    const stepLen = Math.min(speed * dt, d);
    const nx = guard.x + (dx / d) * stepLen;
    const ny = guard.y + (dy / d) * stepLen;
    const before = { x: guard.x, y: guard.y };
    moveCircle(state.grid, guard, nx - guard.x, ny - guard.y, GUARD.radius);
    const moved = dist(before.x, before.y, guard.x, guard.y);
    if (moved > 0.01) guardTurnTowards(guard, Math.atan2(dy, dx), dt, 6);
    return dist(guard.x, guard.y, tx, ty) < 6;
  }

  function stepGuard(guard, dt) {
    const p = state.player;
    const seen = guardSeesPlayer(guard);
    if (seen.sees) {
      guard.lastSeen = { x: p.x, y: p.y };
      guard.unseenTimer = 0;
      if (guard.mode !== 'chase') {
        guard.mode = 'chase';
      }
    } else if (guard.mode === 'chase') {
      guard.unseenTimer += dt;
      if (guard.unseenTimer > DETECTION.chaseGiveUp) {
        guard.mode = 'suspicious';
        guard.investigate = guard.lastSeen ? { ...guard.lastSeen } : { x: guard.x, y: guard.y };
        guard.investigateTimer = 0;
      }
    }

    if (guard.mode === 'chase' && guard.lastSeen) {
      guardMoveTowards(guard, guard.lastSeen.x, guard.lastSeen.y, GUARD.chaseSpeed, dt);
      return;
    }
    if (guard.mode === 'suspicious' && guard.investigate) {
      const arrived = guardMoveTowards(guard, guard.investigate.x, guard.investigate.y, GUARD.suspiciousSpeed, dt);
      if (arrived) {
        guard.investigateTimer += dt;
        guard.angle += Math.sin(state.elapsed * 2.2 + guard.scanPhase) * 1.6 * dt;
        if (guard.investigateTimer > GUARD.investigateTime) {
          guard.mode = 'return';
          guard.investigate = null;
        }
      }
      return;
    }
    if (guard.mode === 'return') {
      // Walk back to the nearest waypoint, then resume the patrol from there.
      let nearest = 0;
      let nearestD = Infinity;
      guard.route.forEach((wp, i) => {
        const d = dist(guard.x, guard.y, wp.x, wp.y);
        if (d < nearestD) {
          nearestD = d;
          nearest = i;
        }
      });
      const target = guard.route[nearest];
      if (guardMoveTowards(guard, target.x, target.y, GUARD.patrolSpeed, dt)) {
        guard.waypointIndex = (nearest + 1) % guard.route.length;
        guard.mode = 'patrol';
        guard.waiting = 0;
      }
      return;
    }
    // Patrol: walk the waypoints, pausing at each to scan the room.
    const target = guard.route[guard.waypointIndex];
    if (guard.waiting > 0) {
      guard.waiting -= dt;
      guard.angle += Math.sin(state.elapsed * 1.4 + guard.scanPhase) * 1.1 * dt;
      return;
    }
    if (guardMoveTowards(guard, target.x, target.y, GUARD.patrolSpeed, dt)) {
      guard.waypointIndex = (guard.waypointIndex + 1) % guard.route.length;
      guard.waiting = GUARD.waitAtWaypoint;
    }
  }

  /**
   * One fixed step. `move` is {x, y} (-1..1 each), `sneak` slows the player down and makes
   * them harder to spot, `clickTarget` is a field point to walk to (or null). Returns event flags.
   */
  function step(dt, move, sneak, clickTarget) {
    if (state.gameOver || state.victory || state.levelComplete) return 0;
    let events = 0;
    state.elapsed += dt;
    state.levelTime += dt;
    if (state.caughtFlash > 0) state.caughtFlash = Math.max(0, state.caughtFlash - dt);

    const p = state.player;
    let mx = move.x;
    let my = move.y;
    if ((mx === 0 && my === 0) && clickTarget) {
      const dx = clickTarget.x - p.x;
      const dy = clickTarget.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > 8) {
        mx = dx / d;
        my = dy / d;
      }
    }
    const mag = Math.hypot(mx, my);
    if (mag > 1) {
      mx /= mag;
      my /= mag;
    }
    p.sneaking = sneak && mag > 0;
    p.moving = mag > 0;
    const speed = p.sneaking ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
    p.speed = p.moving ? speed : 0;
    if (p.moving) {
      p.facing = Math.atan2(my, mx);
      moveCircle(state.grid, p, mx * speed * dt, my * speed * dt, PLAYER.radius);
    }
    p.hidden = playerInBush();

    // Running footsteps carry: guards in earshot come to look.
    if (p.moving && !p.sneaking) {
      state.noisePulse -= dt;
      if (state.noisePulse <= 0) {
        state.noisePulse = NOISE.pulseInterval;
        state.noiseRings.push({ x: p.x, y: p.y, r: 8, max: NOISE.runRadius });
        for (const guard of state.guards) {
          if (guard.mode === 'patrol' && dist(guard.x, guard.y, p.x, p.y) < NOISE.runRadius) {
            guard.mode = 'suspicious';
            guard.investigate = { x: p.x, y: p.y };
            guard.investigateTimer = 0;
          }
        }
      }
    }
    for (const ring of state.noiseRings) ring.r += 260 * dt;
    state.noiseRings = state.noiseRings.filter((ring) => ring.r < ring.max);

    // Detection: the fastest guard that sees the player fills the meter.
    let anySees = false;
    let fillRate = 0;
    for (const guard of state.guards) {
      const seen = guardSeesPlayer(guard);
      if (!seen.sees) continue;
      anySees = true;
      let rate = DETECTION.baseRate * (1 - (seen.d / GUARD.visionRange) * 0.6);
      if (p.sneaking) rate *= DETECTION.sneakFactor;
      if (p.moving && !p.sneaking) rate *= DETECTION.runFactor;
      if (p.hidden && seen.d < PLAYER.bushSpotRange) rate *= 2;
      fillRate = Math.max(fillRate, rate);
    }
    const wasCalm = state.alertLevel === 'calm';
    if (anySees) {
      state.detection = Math.min(1, state.detection + fillRate * dt);
      if (state.detection >= 1) {
        state.alertLevel = 'alarm';
        state.ghost = false;
        if (wasCalm) events |= EVENT_ALARM;
      } else if (state.detection > 0.25) {
        state.alertLevel = 'suspicious';
      }
    } else {
      state.detection = Math.max(0, state.detection - DETECTION.drainRate * dt);
      if (state.detection === 0 && state.alertLevel !== 'calm') {
        const anyChasing = state.guards.some((g) => g.mode === 'chase' || g.mode === 'suspicious');
        if (!anyChasing) {
          state.alertLevel = 'calm';
          events |= EVENT_CALM;
        }
      }
    }

    for (const guard of state.guards) stepGuard(guard, dt);

    // Caught: a chasing guard that reaches the player.
    for (const guard of state.guards) {
      if (guard.mode === 'chase' && dist(guard.x, guard.y, p.x, p.y) < GUARD.radius + PLAYER.radius + 4) {
        state.lives -= 1;
        events |= EVENT_CAUGHT;
        if (state.lives <= 0) {
          state.gameOver = true;
          events |= EVENT_GAME_OVER;
        } else {
          resetPositions();
        }
        break;
      }
    }

    // Intel: walk over it to steal it.
    for (const item of state.intel) {
      if (!item.taken && dist(p.x, p.y, item.x, item.y) < 26) {
        item.taken = true;
        state.intelTaken += 1;
        state.score += INTEL_POINTS;
        state.levelScore += INTEL_POINTS;
        events |= EVENT_PICKUP;
      }
    }
    if (state.intelTaken === state.totalIntel && !state.exit.open) state.exit.open = true;

    // Exit: reach it once it is open (all intel stolen) to finish the level.
    if (state.exit.open && dist(p.x, p.y, state.exit.x, state.exit.y) < 30) {
      const timeBonus = Math.max(0, Math.round((state.level.parSeconds - state.levelTime) * TIME_BONUS_PER_SECOND));
      const ghostBonus = state.ghost ? GHOST_BONUS : 0;
      state.score += timeBonus + ghostBonus;
      state.levelScore += timeBonus + ghostBonus;
      state.levelComplete = true;
      events |= EVENT_LEVEL_COMPLETE;
      if (state.levelIndex + 1 >= LEVELS.length) {
        state.victory = true;
        events |= EVENT_VICTORY;
      }
    }
    return events;
  }

  function nextLevel() {
    if (state.levelIndex + 1 < LEVELS.length) {
      loadLevel(state.levelIndex + 1);
      return true;
    }
    return false;
  }

  function resetGame() {
    state.lives = LIVES;
    state.score = 0;
    state.levelScore = 0;
    state.elapsed = 0;
    state.gameOver = false;
    state.victory = false;
    loadLevel(0);
  }

  loadLevel(0);
  return { state, step, loadLevel, nextLevel, resetGame, resetPositions, guardSeesPlayer, hasLineOfSight: (x0, y0, x1, y1) => hasLineOfSight(state.grid, x0, y0, x1, y1) };
}
