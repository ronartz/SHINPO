# Rust dependency advisory acceptance

**Status:** Open; accepted only for a supervised private-alpha evaluation. This is not a declaration that the advisories are fixed or that SHINPO is release-ready.

**Owner:** SHINPO owner (eonx)  
**Reviewed against:** dirty source on `feature/separate-desktop-mobile-architecture`, 2026-11-08  
**Expires:** 2026-11-15  
**Recheck:** before any new installer or public distribution, and weekly until closed.

## Findings

| Advisory | Locked dependency path | Reachability and impact assessment | Decision / closure condition |
|---|---|---|---|
| RUSTSEC-2024-0429 (unsound) | `tauri -> gtk -> glib 0.18.5`; also `tauri-runtime-wry -> webkit2gtk -> glib 0.18.5` | The affected API is `glib::VariantStrIter`'s iterator implementation. SHINPO has no direct source use of `VariantStrIter`; however GLib is compiled into the GTK/WebKit runtime and this inspection does not prove the API unreachable through upstream code. The advisory is still denied by `cargo audit --deny unsound`. | Do not force GLib 0.20 into the GTK 0.18 dependency family. Recheck the supported Tauri/Wry GTK upgrade path. Close only after a compatible upstream graph no longer resolves the affected GLib or a reviewed upstream fix is present, and the denied audit passes. |
| RUSTSEC-2026-0371 (unmaintained) | `keyring 4.2.0 -> zbus-secret-service-keyring-store 1.0.1 -> zbus 5.19.0 -> zbus_names 4.3.5` | The OS keyring integration is used for optional provider credentials. The exact deprecated `zbus_names` API usage resides in dependencies, not SHINPO code. This is a maintenance warning, not a demonstrated exploit. | Keep provider keyring operations optional and error-reporting. Recheck keyring/zbus upstream maintenance and upgrade only to a compatible maintained release. |
| RUSTSEC-2026-0370 (unmaintained) | `keyring 4.2.0 -> zbus-secret-service-keyring-store 1.0.1 -> zbus 5.19.0 -> zvariant 5.15.1` | `zvariant` is compiled and reachable through the Secret Service keyring transport when that backend is used. No SHINPO code calls zvariant directly. This advisory alone does not identify a security defect. | Recheck keyring/zbus upstream maintenance. Do not pin an incompatible replacement. |
| RUSTSEC-2026-0372 (unmaintained) | `keyring -> zbus-secret-service-keyring-store -> zbus -> zbus_macros -> zvariant_derive 5.15.1` | Derive crate is a compile-time dependency in the Secret Service chain; it is not loaded as an independent runtime component. | Recheck the maintained upstream graph and update as a compatible unit. |
| RUSTSEC-2024-0370 (unmaintained) | `tauri GTK graph -> glib 0.18.5 -> glib-macros 0.18.5 -> proc-macro-error 1.0.4`; also `gtk3-macros -> proc-macro-error` | `proc-macro-error` is used during compilation through transitive GTK/GLib derive macros, not at runtime. This is a maintenance warning, not a demonstrated runtime exploit. | Recheck upstream macro crate replacement through a compatible Tauri GTK stack update. |

## Resolved lockfile issue

`async-executor` is locked at **1.14.1** through `keyring 4.2.0 -> zbus-secret-service-keyring-store 1.0.1 -> zbus 5.19.0`. The formerly yanked 1.14.0 resolution is no longer in `frontend/src-tauri/Cargo.lock`; `cargo tree --locked --manifest-path frontend/src-tauri/Cargo.toml -i async-executor` confirms 1.14.1. Do not treat this resolved yanked-version issue as closure of the remaining RustSec warnings.

## Evidence and release effect

`cargo tree --locked --manifest-path frontend/src-tauri/Cargo.toml -i glib`, and the corresponding `-i zvariant`, `-i zbus_names`, and `-i proc-macro-error` commands produced the dependency paths above on 2026-11-08.

`cargo audit --deny unsound --file frontend/src-tauri/Cargo.lock` failed on RUSTSEC-2024-0429 and printed the four unmaintained advisories. The affected GTK stack has not been force-upgraded. No Windows runtime reachability analysis is implied by this Linux dependency graph.

Until the unsound advisory is resolved or independently reviewed and explicitly accepted for the intended build, automated security qualification remains **FAIL**. The unmaintained advisories remain visible and open. This record expires on 2026-11-15; it must be renewed or removed after fresh evidence.
