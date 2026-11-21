// Every tuning number and colour in one place. The playfield is a fixed 1280x800 logical
// area (one screen, no camera scroll: the whole level is always visible, which is what the
// screenshots show); the renderer scales it to the window, so no rule depends on screen size.

export const FIELD = { width: 1280, height: 800 };
export const TILE = 40;
export const COLS = 32;
export const ROWS = 20;

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  walkSpeed: 175,
  sneakSpeed: 95,
  /** How close a guard must get to spot a player hiding in a bush. */
  bushSpotRange: 62,
  /** How close a guard must get to spot the player from behind (outside its cone). */
  bumpRange: 34,
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 72,
  suspiciousSpeed: 105,
  chaseSpeed: 152,
  /** Seconds a guard waits at each patrol waypoint, scanning around. */
  waitAtWaypoint: 1.6,
  /** Seconds a guard looks around at a spot it was sent to investigate. */
  investigateTime: 2.4,
  visionRange: 250,
  /** Half of the vision cone's angle, in radians (about 38 degrees each side). */
  visionHalfAngle: 0.66,
};

/** How fast the detection meter (0..1) fills when a guard can see the player. */
export const DETECTION = {
  baseRate: 2.0,
  sneakFactor: 0.55,
  runFactor: 1.3,
  /** How fast the meter drains while no guard sees the player. */
  drainRate: 0.45,
  /** Seconds the player must stay unseen for a chasing guard to give up. */
  chaseGiveUp: 3.0,
};

export const NOISE = {
  /** How far a running player's footsteps carry, in pixels. */
  runRadius: 150,
  /** Seconds between noise pulses while running. */
  pulseInterval: 0.45,
};

export const LIVES = 3;
export const INTEL_POINTS = 100;
export const GHOST_BONUS = 250;
export const TIME_BONUS_PER_SECOND = 5;

export const PALETTE = {
  backdrop: '#0d1017',
  floorA: '#181d27',
  floorB: '#1b212d',
  floorLine: '#232b3a',
  wall: '#2e3850',
  wallTop: '#4a5a7d',
  wallSide: '#1c2333',
  crate: '#6b4f2a',
  crateEdge: '#8a6a3c',
  bush: '#1d4a2e',
  bushLight: '#2c6b42',
  bushDark: '#122e1c',
  player: '#37e0c8',
  playerDark: '#1d8f80',
  guard: '#e5484d',
  guardDark: '#8f2b2f',
  cone: 'rgba(255, 205, 70, 0.30)',
  coneSuspicious: 'rgba(255, 150, 50, 0.38)',
  coneAlert: 'rgba(255, 60, 60, 0.42)',
  exit: '#39d353',
  exitLocked: '#5a6b7a',
  intel: '#f2c94c',
  text: '#eef1f5',
  muted: '#8b93a3',
  panel: 'rgba(10, 13, 20, 0.82)',
  danger: '#ff5a5a',
  warn: '#ffb020',
  ok: '#39d353',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'night-vault.best';
