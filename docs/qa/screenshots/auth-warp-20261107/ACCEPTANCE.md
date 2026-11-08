# Authentication Warp Background — Fedora Tauri Acceptance

Tested the rebuilt local Tauri executable at 1400×900 with disposable XDG profiles. The harness confirmed ports 8080 and 5432 were stopped.

| Appearance | Card rectangle (x, y, width, height) | Overflow |
| --- | --- | --- |
| Aurora Dark, initial workspace form | 470, 100.796875, 460, 698.390625 | None |
| Classic Dark, Sign In | 470, 129.796875, 460, 640.390625 | None |
| Classic Light, Sign In | 470, 129.796875, 460, 640.390625 | None |
| Aurora Light, Sign In | 470, 129.796875, 460, 640.390625 | None |
| Aurora Dark, Sign In | 470, 129.796875, 460, 640.390625 | None |

The Warp layer rendered four perspective grid planes and eight deterministic beams, remained `position: absolute` with `pointer-events: none`, and sat at z-index 0 behind the card at z-index 10. Native WebKitGTK reported a 10-second beam animation. The card geometry stayed stable during the animation and across all four theme combinations. The native flow created a disposable workspace, confirmed its recovery screen, signed out/in through Settings theme changes, and exercised password visibility.

Reduced-motion run: the actual WebView reported `prefers-reduced-motion: reduce`, beam `animation-name: none`, and retained the static grid. The two screenshots taken 1.2 seconds apart were byte-identical. The test used a process-local GTK settings shim to expose the preference; it did not change the desktop's global setting.

Checks:

- `npx tauri build --no-bundle` — passed; built `frontend/src-tauri/target/release/shinpo-desktop`.
- `npm test` — 153 passed, 0 failed.
- `npm run lint` — 0 errors; 3 existing `no-explicit-any` warnings in `frontend/e2e/comprehensive-tabs-audit.spec.ts`.
- `npm run build` — passed; Vite reported existing ineffective dynamic-import warnings for `focusSessions.ts` and `goalsAndMissions.ts`.
- `npm run test:tauri:native -- --spec e2e/tauri-native/auth-warp-acceptance.spec.js` — passed against the rebuilt Tauri WebView for the four themes and local authentication interactions.
- The same native spec with `SHINPO_EXPECT_REDUCED_MOTION=1` — passed; static screenshots matched byte-for-byte.

The Warp acceptance covers this background change only; it is not an overall SHINPO release qualification.
