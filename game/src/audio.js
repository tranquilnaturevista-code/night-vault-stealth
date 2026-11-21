// Tiny sound effects, synthesized with WebAudio: no audio files, no network. The context is
// created on the first user gesture (browsers block sound before one); every call before that
// is a silent no-op.
export function createAudio() {
  let ctx = null;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    } catch {
      return null;
    }
    return ctx;
  }

  function tone(freq, dur, type = 'sine', gain = 0.08, slideTo = null) {
    const ac = ensure();
    if (!ac) return;
    try {
      if (ac.state === 'suspended') void ac.resume();
      const osc = ac.createOscillator();
      const amp = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ac.currentTime);
      if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, ac.currentTime + dur);
      amp.gain.setValueAtTime(gain, ac.currentTime);
      amp.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
      osc.connect(amp);
      amp.connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + dur);
    } catch {
      // Sound is decoration: never let it break the game.
    }
  }

  return {
    /** Called on the first click or keypress so later sounds are allowed to play. */
    unlock() {
      ensure();
    },
    pickup() {
      tone(880, 0.12, 'sine', 0.07, 1320);
    },
    alarm() {
      tone(220, 0.28, 'sawtooth', 0.06, 110);
      setTimeout(() => tone(220, 0.28, 'sawtooth', 0.06, 110), 140);
    },
    caught() {
      tone(160, 0.5, 'sawtooth', 0.09, 55);
    },
    levelDone() {
      [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.07), i * 110));
    },
    victory() {
      [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.07), i * 120));
    },
    gameOver() {
      [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'triangle', 0.06), i * 150));
    },
  };
}
