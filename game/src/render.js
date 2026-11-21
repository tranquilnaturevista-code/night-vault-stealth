// Everything the player sees, drawn on one canvas: the night-time level from above, the
// guards with their vision cones, the cover, the exit, the HUD and every screen. The playfield
// is a fixed 1280x800 logical area scaled to fit the window, so the game looks the same at any
// window size and the screenshots are exactly what a player sees.
import { FIELD, TILE, COLS, ROWS, PALETTE, FONT, GUARD, PLAYER, LIVES } from './config.js';
import { visionPolygon } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_LEVEL_DONE = 'levelDone';
export const SCREEN_VICTORY = 'victory';

const TAU = Math.PI * 2;

function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    scale = Math.min(w / FIELD.width, h / FIELD.height) * dpr;
    offsetX = (canvas.width - FIELD.width * scale) / 2;
    offsetY = (canvas.height - FIELD.height * scale) / 2;
  }

  function toField(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const dpr = canvas.width / rect.width;
    const x = (clientX - rect.left) * dpr;
    const y = (clientY - rect.top) * dpr;
    return { x: (x - offsetX) / scale, y: (y - offsetY) / scale };
  }

  function drawFloor(state) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const ch = state.grid[r][c];
        const x = c * TILE;
        const y = r * TILE;
        if (ch === '#') continue;
        ctx.fillStyle = (c + r) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.strokeStyle = PALETTE.floorLine;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
      }
    }
  }

  function drawWalls(state) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (state.grid[r][c] !== '#') continue;
        const x = c * TILE;
        const y = r * TILE;
        ctx.fillStyle = PALETTE.wallSide;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = PALETTE.wall;
        ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
        ctx.fillStyle = PALETTE.wallTop;
        ctx.fillRect(x + 1, y + 1, TILE - 2, 4);
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
      }
    }
  }

  function drawCrate(x, y) {
    ctx.fillStyle = PALETTE.crateEdge;
    ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
    ctx.fillStyle = PALETTE.crate;
    ctx.fillRect(x + 6, y + 6, TILE - 12, TILE - 12);
    ctx.strokeStyle = PALETTE.crateEdge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 6, y + 6);
    ctx.lineTo(x + TILE - 6, y + TILE - 6);
    ctx.moveTo(x + TILE - 6, y + 6);
    ctx.lineTo(x + 6, y + TILE - 6);
    ctx.stroke();
  }

  function drawBush(x, y, t) {
    const cx = x + TILE / 2;
    const cy = y + TILE / 2;
    ctx.fillStyle = PALETTE.bushDark;
    ctx.beginPath();
    ctx.arc(cx, cy, 19, 0, TAU);
    ctx.fill();
    ctx.fillStyle = PALETTE.bush;
    ctx.beginPath();
    ctx.arc(cx - 6, cy - 4, 11, 0, TAU);
    ctx.arc(cx + 7, cy - 6, 10, 0, TAU);
    ctx.arc(cx + 2, cy + 7, 11, 0, TAU);
    ctx.fill();
    ctx.fillStyle = PALETTE.bushLight;
    const wobble = Math.sin(t * 1.8 + cx * 0.05) * 1.5;
    ctx.beginPath();
    ctx.arc(cx - 7 + wobble, cy - 6, 4, 0, TAU);
    ctx.arc(cx + 8, cy + 3 + wobble, 3.5, 0, TAU);
    ctx.arc(cx + 1, cy - 10, 3, 0, TAU);
    ctx.fill();
  }

  function drawExit(state, t) {
    const { x, y, open } = state.exit;
    const pulse = open ? 0.75 + 0.25 * Math.sin(t * 3) : 0.4;
    ctx.save();
    ctx.shadowColor = open ? PALETTE.exit : PALETTE.exitLocked;
    ctx.shadowBlur = open ? 26 : 8;
    ctx.fillStyle = open ? `rgba(57, 211, 83, ${0.55 + 0.3 * pulse})` : 'rgba(90, 107, 122, 0.5)';
    ctx.beginPath();
    ctx.arc(x, y, 26, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = open ? '#0b2e13' : '#20262e';
    ctx.beginPath();
    ctx.arc(x, y, 17, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = open ? PALETTE.exit : PALETTE.exitLocked;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, 17, 0, TAU);
    ctx.stroke();
    if (open) {
      ctx.fillStyle = PALETTE.exit;
      for (let i = -1; i <= 1; i++) {
        const yy = y + i * 8 + Math.sin(t * 3) * 1.5;
        ctx.beginPath();
        ctx.moveTo(x - 6, yy - 3);
        ctx.lineTo(x + 2, yy);
        ctx.lineTo(x - 6, yy + 3);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      ctx.fillStyle = '#c8d0dc';
      ctx.fillRect(x - 5, y - 1, 10, 8);
      ctx.strokeStyle = '#c8d0dc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y - 1, 4, Math.PI, 0);
      ctx.stroke();
    }
    ctx.font = `700 11px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = open ? PALETTE.exit : PALETTE.muted;
    ctx.fillText(open ? 'EXIT' : 'LOCKED', x, y - 32);
  }

  function drawIntel(item, t) {
    if (item.taken) return;
    const bob = Math.sin(t * 2.4 + item.x * 0.02) * 2;
    ctx.save();
    ctx.translate(item.x, item.y + bob);
    ctx.shadowColor = PALETTE.intel;
    ctx.shadowBlur = 14;
    ctx.fillStyle = PALETTE.intel;
    ctx.rotate(Math.PI / 4 + Math.sin(t * 1.2) * 0.15);
    ctx.fillRect(-8, -8, 16, 16);
    ctx.restore();
    ctx.fillStyle = '#fff7d6';
    ctx.beginPath();
    ctx.arc(item.x - 3, item.y - 4 + bob, 2.5, 0, TAU);
    ctx.fill();
  }

  function drawPatrolPaths(state) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([2, 7]);
    ctx.lineCap = 'round';
    for (const guard of state.guards) {
      ctx.beginPath();
      guard.route.forEach((wp, i) => {
        if (i === 0) ctx.moveTo(wp.x, wp.y);
        else ctx.lineTo(wp.x, wp.y);
      });
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }

  function coneFill(mode) {
    if (mode === 'chase') return PALETTE.coneAlert;
    if (mode === 'suspicious') return PALETTE.coneSuspicious;
    return PALETTE.cone;
  }

  function drawGuard(state, guard) {
    const poly = visionPolygon(state.grid, guard);
    ctx.save();
    ctx.fillStyle = coneFill(guard.mode);
    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 220, 110, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.shadowColor = PALETTE.guard;
    ctx.shadowBlur = 10;
    ctx.fillStyle = PALETTE.guard;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, GUARD.radius, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = PALETTE.guardDark;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, GUARD.radius - 5, 0, TAU);
    ctx.fill();
    // Facing wedge: the direction the guard looks.
    ctx.fillStyle = '#ffd9d9';
    ctx.beginPath();
    ctx.moveTo(guard.x + Math.cos(guard.angle) * (GUARD.radius + 3), guard.y + Math.sin(guard.angle) * (GUARD.radius + 3));
    ctx.lineTo(guard.x + Math.cos(guard.angle + 0.5) * (GUARD.radius - 4), guard.y + Math.sin(guard.angle + 0.5) * (GUARD.radius - 4));
    ctx.lineTo(guard.x + Math.cos(guard.angle - 0.5) * (GUARD.radius - 4), guard.y + Math.sin(guard.angle - 0.5) * (GUARD.radius - 4));
    ctx.closePath();
    ctx.fill();
    // Alert marker.
    if (guard.mode === 'chase' || guard.mode === 'suspicious') {
      ctx.font = `900 20px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = guard.mode === 'chase' ? '#ff6b6b' : '#ffb020';
      ctx.fillText(guard.mode === 'chase' ? '!' : '?', guard.x, guard.y - GUARD.radius - 8);
    }
  }

  function drawPlayer(state, t) {
    const p = state.player;
    const hidden = p.hidden;
    ctx.save();
    if (hidden) ctx.globalAlpha = 0.55;
    ctx.shadowColor = PALETTE.player;
    ctx.shadowBlur = 12;
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(p.x, p.y, PLAYER.radius - (p.sneaking ? 2 : 0), 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = PALETTE.playerDark;
    ctx.beginPath();
    ctx.arc(p.x, p.y, PLAYER.radius - 6, 0, TAU);
    ctx.fill();
    // Hood point: the direction the player faces.
    ctx.fillStyle = '#e6fffa';
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(p.facing) * (PLAYER.radius + 2), p.y + Math.sin(p.facing) * (PLAYER.radius + 2));
    ctx.lineTo(p.x + Math.cos(p.facing + 0.45) * (PLAYER.radius - 6), p.y + Math.sin(p.facing + 0.45) * (PLAYER.radius - 6));
    ctx.lineTo(p.x + Math.cos(p.facing - 0.45) * (PLAYER.radius - 6), p.y + Math.sin(p.facing - 0.45) * (PLAYER.radius - 6));
    ctx.closePath();
    ctx.fill();
    if (hidden) {
      ctx.font = `700 10px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#9be8a9';
      ctx.fillText('HIDDEN', p.x, p.y - PLAYER.radius - 8);
    }
    // Detection arc above the player while a guard is filling the meter.
    if (state.detection > 0.02) {
      const a0 = -Math.PI / 2;
      const a1 = a0 + TAU * state.detection;
      ctx.strokeStyle = state.detection > 0.75 ? PALETTE.danger : PALETTE.warn;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, PLAYER.radius + 9, a0, a1);
      ctx.stroke();
    }
  }

  function drawNoiseRings(state) {
    for (const ring of state.noiseRings) {
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.35 * (1 - ring.r / ring.max)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.r, 0, TAU);
      ctx.stroke();
    }
  }

  function drawWorld(state, t, clickTarget) {
    drawFloor(state);
    drawPatrolPaths(state);
    drawExit(state, t);
    for (const item of state.intel) drawIntel(item, t);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const ch = state.grid[r][c];
        if (ch === 'C') drawCrate(c * TILE, r * TILE);
        else if (ch === 'B') drawBush(c * TILE, r * TILE, t);
      }
    }
    drawWalls(state);
    for (const guard of state.guards) drawGuard(state, guard);
    drawPlayer(state, t);
    drawNoiseRings(state);
    if (clickTarget) {
      ctx.strokeStyle = 'rgba(55, 224, 200, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(clickTarget.x, clickTarget.y, 8, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(clickTarget.x - 11, clickTarget.y);
      ctx.lineTo(clickTarget.x + 11, clickTarget.y);
      ctx.moveTo(clickTarget.x, clickTarget.y - 11);
      ctx.lineTo(clickTarget.x, clickTarget.y + 11);
      ctx.stroke();
    }
  }

  function pill(text, cx, y, bg, fg) {
    ctx.font = `700 13px ${FONT}`;
    const w = ctx.measureText(text).width + 24;
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, y, w, 26, 13);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cx, y + 14);
    ctx.textBaseline = 'alphabetic';
  }

  function drawHud(state, screen) {
    const t = state.levelTime;
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(0, 0, FIELD.width, 46);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 15px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(`${state.levelIndex + 1}. ${state.level.name}`, 14, 29);
    ctx.font = `400 13px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`Intel ${state.intelTaken}/${state.totalIntel}`, 210, 29);
    ctx.fillStyle = state.exit.open ? PALETTE.ok : PALETTE.muted;
    ctx.fillText(state.exit.open ? 'EXIT OPEN — go!' : 'Steal all intel to open the exit', 300, 29);

    const alert = state.alertLevel;
    const label = alert === 'alarm' ? '⚠ ALARM — HIDE!' : alert === 'suspicious' ? '? SUSPICIOUS' : '✓ UNDETECTED';
    const bg = alert === 'alarm' ? '#7a1d1d' : alert === 'suspicious' ? '#6b4d0f' : '#123f22';
    const fg = alert === 'alarm' ? '#ffb3b3' : alert === 'suspicious' ? '#ffd88a' : '#8fe6a8';
    pill(label, FIELD.width / 2, 10, bg, fg);

    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 15px ${FONT}`;
    const hearts = '♥'.repeat(state.lives) + '♡'.repeat(Math.max(0, LIVES - state.lives));
    ctx.fillText(`Score ${state.score}   ${hearts}   ${formatTime(t)}`, FIELD.width - 14, 29);

    if (state.detection > 0.02) {
      const bw = 260;
      const bx = (FIELD.width - bw) / 2;
      const by = 54;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath();
      ctx.roundRect(bx - 8, by - 4, bw + 16, 20, 10);
      ctx.fill();
      ctx.fillStyle = '#3a2a12';
      ctx.fillRect(bx, by, bw, 12);
      ctx.fillStyle = state.detection > 0.75 ? PALETTE.danger : PALETTE.warn;
      ctx.fillRect(bx, by, bw * state.detection, 12);
      ctx.font = `700 10px ${FONT}`;
      ctx.fillStyle = PALETTE.text;
      ctx.textAlign = 'center';
      ctx.fillText('SPOTTED', FIELD.width / 2, by + 28);
    }

    ctx.textAlign = 'left';
    ctx.font = `400 12px ${FONT}`;
    ctx.fillStyle = 'rgba(238, 241, 245, 0.55)';
    if (screen === SCREEN_PLAY) {
      ctx.fillText('WASD / arrows — move   •   Shift — sneak (slow, quiet, harder to spot)   •   Click — walk there   •   Running makes noise   •   Bushes hide you   •   P — pause', 14, FIELD.height - 12);
    }
  }

  function drawVignette(state) {
    const cx = state.player.x;
    const cy = state.player.y;
    const g = ctx.createRadialGradient(cx, cy, 180, cx, cy, 620);
    g.addColorStop(0, 'rgba(4, 6, 10, 0)');
    g.addColorStop(1, 'rgba(4, 6, 10, 0.52)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    if (state.caughtFlash > 0) {
      ctx.fillStyle = `rgba(229, 72, 77, ${Math.min(0.45, state.caughtFlash * 0.4)})`;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
  }

  function overlayPanel(title, lines, accent) {
    ctx.fillStyle = 'rgba(6, 8, 13, 0.72)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    const pw = 620;
    const ph = 150 + lines.length * 30;
    const px = (FIELD.width - pw) / 2;
    const py = (FIELD.height - ph) / 2;
    ctx.fillStyle = 'rgba(13, 17, 26, 0.95)';
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 16);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = accent;
    ctx.font = `900 40px ${FONT}`;
    ctx.fillText(title, FIELD.width / 2, py + 62);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `400 16px ${FONT}`;
    lines.forEach((line, i) => ctx.fillText(line, FIELD.width / 2, py + 104 + i * 30));
  }

  function draw(state, screen, best, clickTarget) {
    resize();
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(-offsetX / scale, -offsetY / scale, FIELD.width + (offsetX * 2) / scale, FIELD.height + (offsetY * 2) / scale);
    const t = state.elapsed;
    drawWorld(state, t, screen === SCREEN_PLAY ? clickTarget : null);
    drawVignette(state);
    drawHud(state, screen);

    if (screen === SCREEN_TITLE) {
      ctx.fillStyle = 'rgba(6, 8, 13, 0.66)';
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.player;
      ctx.font = `900 84px ${FONT}`;
      ctx.fillText('NIGHT VAULT', FIELD.width / 2, 250);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `400 22px ${FONT}`;
      ctx.fillText('A stealth game — slip past the guards, steal the intel, vanish through the exit.', FIELD.width / 2, 296);
      ctx.font = `400 17px ${FONT}`;
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText('Guards watch with vision cones. Crates block their sight, bushes hide you.', FIELD.width / 2, 340);
      ctx.fillText('Sneak with Shift. Run and they will hear you. Get seen and the alarm goes up.', FIELD.width / 2, 368);
      ctx.fillStyle = PALETTE.intel;
      ctx.font = `700 20px ${FONT}`;
      ctx.fillText('Press SPACE or click to play', FIELD.width / 2, 440);
      if (best > 0) {
        ctx.fillStyle = PALETTE.muted;
        ctx.font = `400 15px ${FONT}`;
        ctx.fillText(`Best score: ${best}`, FIELD.width / 2, 478);
      }
      ctx.fillStyle = 'rgba(238, 241, 245, 0.5)';
      ctx.font = `400 13px ${FONT}`;
      ctx.fillText('WASD / arrows to move  •  Shift to sneak  •  Click to walk there  •  P to pause', FIELD.width / 2, 530);
    } else if (screen === SCREEN_PAUSED) {
      overlayPanel('PAUSED', ['Press P or Space to keep sneaking.'], PALETTE.muted);
    } else if (screen === SCREEN_OVER) {
      overlayPanel('CAUGHT', [`The guards got you. Score ${state.score}.`, 'Press R to start over.'], PALETTE.danger);
    } else if (screen === SCREEN_LEVEL_DONE) {
      const timeBonus = Math.max(0, Math.round((state.level.parSeconds - state.levelTime) * 5));
      overlayPanel('LEVEL CLEAR', [
        `Intel stolen: ${state.intelTaken}/${state.totalIntel}  •  Time bonus +${timeBonus}${state.ghost ? '  •  Ghost bonus +250' : ''}`,
        `Score ${state.score} — press SPACE for the next level.`,
      ], PALETTE.ok);
    } else if (screen === SCREEN_VICTORY) {
      overlayPanel('THE VAULT IS YOURS', [
        `All three levels cleared, unseen enough. Final score ${state.score}.`,
        'Press R to play again.',
      ], PALETTE.intel);
    }
  }

  window.addEventListener('resize', resize);
  resize();
  return { draw, toField, resize };
}
