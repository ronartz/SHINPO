# SHINPO privacy summary

## Stored locally

SHINPO's local account stores goals, tasks, schedules, Focus history, reflections, progress/reward events, onboarding state, Guardian preferences and observations, and EONPAI conversation/action history in an encrypted SQLCipher vault. Account metadata is stored alongside that vault. The operating system credential store may hold optional provider credentials.

Guardian app observation is consent-gated. Native app handling is warning-only; it does not automatically close applications.

## Network use

The local desktop workflow does not require a SHINPO server, Spring Boot, PostgreSQL, or Docker. With no external AI provider configured, EONPAI uses deterministic offline planning. If a user configures and invokes a remote AI provider, the request and selected context are sent to that provider. Browser Companion communicates with the local desktop through the native-messaging host; browser website policy requires a live paired connection.

No telemetry is described as enabled by default in the local desktop path. Verify the current build's provider and browser status before relying on network behavior.

## Backups and deletion

A recovery key can recover access to the wrapped database key; it is not a backup. A supported encrypted export/restore workflow has not been qualified. Until it is, close SHINPO before copying the complete application-data directory. Account deletion removes local vault data through the application, but filesystem deletion is not a guaranteed secure overwrite on SSDs or copy-on-write filesystems.
