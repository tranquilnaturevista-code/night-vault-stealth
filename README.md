[![make.fun](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/tranquilnaturevista-code/night-vault-stealth/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/tranquilnaturevista-code/night-vault-stealth/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)

# Night Vault — a stealth game

Slip past the guards, steal the intel, and vanish through the exit — unseen.

**Entry for the [make.fun bounty "Make the best stealth game"](https://make.fun/bounty/best-stealth-game-20261121-1759)** ($50, 10 places, closes 2026-11-22 05:59 UTC).

## How to play

Open `game/index.html` in desktop Chrome (or run `node serve.ts` and open http://localhost:8080). No network, no install, no build step.

- **Move:** WASD or arrow keys — or click anywhere to walk there.
- **Sneak:** hold Shift — slower and quieter, and much harder for guards to spot.
- **Goal:** steal every piece of intel on the floor. The exit opens only once all of it is stolen; reach it unseen to clear the level.
- **Guards** patrol fixed routes and watch with vision cones. Crates block their sight; bushes hide you inside them (unless a guard gets very close). Running makes noise they can hear — a guard that hears footsteps comes to look.
- **Spotted:** the ring above your head fills while a guard sees you. Fill it and the alarm goes up: every guard that saw you gives chase. Break line of sight and stay hidden until they give up.
- **Caught:** a chasing guard that reaches you costs a life. You have 3.

Three levels — **The Gallery**, **The Vault Floor**, **The Director's Wing** — each with more guards, more intel, and tighter patrols. Finish a level fast and without ever raising the alarm for time and ghost bonuses.

## Files

- `game/` — the playable game: `index.html` plus its ES modules under `game/src/` (no libraries, no network requests).
  - `world.js` — rules: movement and collision, guard patrol / investigate / chase, vision cones with line of sight, detection, noise, intel, lives and score.
  - `levels.js` — the three levels.
  - `render.js` — everything drawn on one canvas.
  - `shots.js` — the staged screenshot scenes (real play, steered by an autopilot).
  - `input.js`, `audio.js` (WebAudio bleeps, synthesized, no files), `random.js`, `main.js`.
- `screenshots/` — 4 real renders of the game's own code: mid-heist (cover), title, alarm, level clear.
- `main.ts` — the entrypoint: copies `game/` and `screenshots/` to `/output` and writes `dossier.json` with `vendor/makefun-game.ts`.
- `serve.ts` — a tiny static server for local play-testing.

## License

MIT — see [LICENSE](LICENSE).
