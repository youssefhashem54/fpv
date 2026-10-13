# Changelog

All notable changes to NEONLINE — FPV Drone Racing.

## [1.0.1] — Release candidate packaging

### Added

- `README.md` with full documentation (controls, build instructions, project structure)
- MIT `LICENSE`
- `CHANGELOG.md` for release notes

---

## [1.0.0] — First public release

The complete game in a single self-contained HTML file (`dist/index.html`, ~880 KB).

### Flight

- Angle-mode FPV quad physics: body-axis thrust, gravity, quadratic drag, throttle smoothing
- Spring-stick mouse attitude with sensitivity and invert-Y settings, keyboard fallback (arrows)
- Speed-reactive FOV (74°→100°), throttle prop-shake, wind streak speed lines

### Racing

- 14-gate synthwave canyon circuit with climb, rock-field dive and low slalom sections
- Next-gate sky beacon, off-screen direction arrow, missed-gate detection
- Crash slow-mo with tumbling physics and respawn at the active gate (clock keeps running)
- Race timer, live gate pips, minimap, personal best persistence

### Combat

- 12 sentry drones with patrol / aggro / strafe-orbit / telegraphed-fire AI
- Player laser bolts (right-click / `F` / touch trigger), weapon energy meter, hitmarkers
- Kill reward: −2.0 seconds per destroyed sentry; kill counter on the HUD
- Enemy plasma returns fire with velocity-led shots and close-miss whooshes

### Platforms

- Launch-time device picker (auto-detected, remembered, switchable from menu)
- Mobile twin-stick controller: left = throttle (center-hover) + yaw, right = pitch/roll, FIRE trigger
- Pointer-lock flow with recapture, pause on lock loss / tab hide

### Presentation & Audio

- Custom sky-dome and grid shaders, striped sunset sun, stars, pylon field, floating rocks
- HDR bloom post-processing with quality toggle
- Fully synthesized audio via Web Audio API: motors, wind, chimes, lasers, explosions

[kill]: #
[1.0.1]: #101---release-candidate-packaging
[1.0.0]: #100---first-public-release
