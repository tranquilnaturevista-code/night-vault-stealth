// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The game
// moves between six screens: title, play, paused, level complete, game over and victory.
//
// ?seed=N fixes the guard scan phases. ?shot=start|play|alert|win (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, LIVES, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_ALARM, EVENT_CAUGHT, EVENT_GAME_OVER, EVENT_LEVEL_COMPLETE, EVENT_PICKUP, EVENT_VICTORY } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_LEVEL_DONE, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, null);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let clickTarget = null;
  const input = createInput(canvas, (event) => {
    const at = renderer.toField(event.clientX, event.clientY);
    if (at.x >= 0 && at.x <= 1280 && at.y >= 0 && at.y <= 800) clickTarget = at;
  });
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and each event.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.resetGame();
    clickTarget = null;
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing ${world.state.level.name}. Steal all the intel, then reach the exit unseen.`);
  }

  function endGame() {
    screen = SCREEN_OVER;
    audio.gameOver();
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Caught. Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function handleEvents(events) {
    if (events & EVENT_PICKUP) {
      audio.pickup();
      announce(`Intel stolen. ${world.state.intelTaken} of ${world.state.totalIntel}.`);
    }
    if (events & EVENT_ALARM) {
      audio.alarm();
      announce('Alarm! A guard has spotted you. Break line of sight and hide.');
    }
    if (events & EVENT_CAUGHT) {
      audio.caught();
      announce(world.state.lives === 1 ? 'Caught! 1 life left.' : `Caught! ${world.state.lives} lives left.`);
    }
    if (events & EVENT_LEVEL_COMPLETE) {
      if (events & EVENT_VICTORY) {
        screen = SCREEN_VICTORY;
        audio.victory();
        if (world.state.score > best) {
          best = world.state.score;
          saveBest(best);
        }
        announce(`You cleared every level. Final score ${world.state.score}.`);
      } else {
        screen = SCREEN_LEVEL_DONE;
        audio.levelDone();
        announce(`Level clear. Score ${world.state.score}.`);
      }
    }
    if (events & EVENT_GAME_OVER) endGame();
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_RESTART && (screen === SCREEN_OVER || screen === SCREEN_VICTORY || screen === SCREEN_PLAY)) {
      startGame();
      return;
    }
    if (actions & ACTION_CONFIRM && screen === SCREEN_TITLE) {
      startGame();
    } else if (actions & ACTION_CONFIRM && screen === SCREEN_LEVEL_DONE) {
      clickTarget = null;
      if (world.nextLevel()) {
        accumulator = 0;
        screen = SCREEN_PLAY;
        announce(`Playing ${world.state.level.name}.`);
      }
    } else if (actions & ACTION_CONFIRM && (screen === SCREEN_OVER || screen === SCREEN_VICTORY)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      // The title screen's backdrop: the guards keep patrolling behind the title.
      world.step(STEP, { x: 0, y: 0 }, false, null);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const events = world.step(STEP, input.move(), input.sneaking(), clickTarget);
    if (clickTarget) {
      const dx = clickTarget.x - world.state.player.x;
      const dy = clickTarget.y - world.state.player.y;
      if (Math.hypot(dx, dy) < 10 || input.move().x !== 0 || input.move().y !== 0) clickTarget = null;
    }
    handleEvents(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
      step();
      accumulator -= STEP;
    }
    if (screen !== SCREEN_TITLE && screen !== SCREEN_PLAY) accumulator = 0;
    renderer.draw(world.state, screen, best, screen === SCREEN_PLAY ? clickTarget : null);
  }

  // Leaving the tab pauses a running game rather than letting guards close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Night Vault. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
