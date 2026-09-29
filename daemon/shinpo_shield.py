#!/usr/bin/env python3
"""
SHINPO (進歩) — FOCUS ENFORCEMENT SHIELD DAEMON
Monitors active focus sessions from the Spring Boot API and enforces flow state
by terminating distracting desktop processes in real time.

Usage:
    python3 daemon/shinpo_shield.py
    python3 daemon/shinpo_shield.py --dry-run
"""

import sys
import os
import time
import json
import subprocess
import urllib.request
import urllib.error
from datetime import datetime, timezone

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "shield_config.json")

def load_config():
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {
        "api_url": "http://localhost:8080/api/focus-sessions?userId=1",
        "poll_interval_seconds": 2,
        "blacklist": ["discord", "steam", "spotify", "telegram-desktop"],
        "auto_kill": True,
        "notify_desktop": True,
    }

def send_os_notification(title, message):
    """Sends a native desktop notification on Linux via notify-send."""
    try:
        subprocess.run(
            ["notify-send", "-u", "critical", "-a", "SHINPO Shield", title, message],
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except Exception:
        pass

def fetch_active_session(api_url, auth_token=None):
    """Fetches sessions from Spring Boot and returns the first ACTIVE session or None."""
    token = auth_token or os.environ.get("SHINPO_AUTH_TOKEN")
    headers = {"User-Agent": "SHINPO-Shield-Daemon/1.0", "Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        req = urllib.request.Request(
            api_url,
            headers=headers,
        )
        with urllib.request.urlopen(req, timeout=3) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                for s in data:
                    if s.get("status") == "ACTIVE":
                        return s
    except Exception:
        pass
    return None

def scan_and_terminate(blacklist, dry_run=False):
    """Scans running processes and terminates any matching blacklist entries."""
    terminated = []
    
    # On Linux, inspect /proc or use pgrep
    for app in blacklist:
        app_clean = app.strip().lower()
        if not app_clean:
            continue
        try:
            # Check if process is running
            out = subprocess.check_output(
                ["pgrep", "-f", "-l", app_clean],
                stderr=subprocess.DEVNULL,
            ).decode("utf-8", errors="ignore")
            
            lines = [l.strip() for l in out.splitlines() if l.strip()]
            for line in lines:
                parts = line.split(" ", 1)
                pid = parts[0]
                proc_name = parts[1] if len(parts) > 1 else app_clean

                # Avoid killing ourselves or python interpreter running this script
                if str(os.getpid()) == pid or "shinpo_shield" in proc_name:
                    continue

                if dry_run:
                    print(f"  [DRY-RUN] Would terminate: PID {pid} ({proc_name})")
                    terminated.append(proc_name)
                else:
                    try:
                        os.kill(int(pid), 15)  # SIGTERM
                        print(f"  [ENFORCED] Terminated: PID {pid} ({proc_name})")
                        terminated.append(proc_name)
                    except ProcessLookupError:
                        pass
                    except PermissionError:
                        print(f"  [PERMISSION ERROR] Run with 'sudo' to terminate PID {pid} ({proc_name})")
        except subprocess.CalledProcessError:
            # pgrep returns non-zero when no matching process is found
            pass
        except Exception as e:
            pass

    return terminated

def main():
    dry_run = "--dry-run" in sys.argv
    config = load_config()

    print("=" * 65)
    print("  進歩 (SHINPO) FOCUS ENFORCEMENT SHIELD DAEMON ONLINE")
    print(f"  Monitoring API: {config['api_url']}")
    print(f"  Enforcement: {'DRY-RUN (audit only)' if dry_run else 'ACTIVE KILL (enforcing flow)'}")
    print(f"  Blacklist: {', '.join(config['blacklist'])}")
    print("=" * 65)

    is_in_lockdown = False

    while True:
        try:
            active_session = fetch_active_session(config["api_url"])

            if active_session:
                session_name = active_session.get("name", "Focus Sprint")
                duration = active_session.get("durationMinutes", 25)
                intention = active_session.get("intention") or "Deep Work"

                if not is_in_lockdown:
                    is_in_lockdown = True
                    print(f"\n[LOCKDOWN ENGAGED] Active Session: '{session_name}' ({duration}m)")
                    print(f"  Intention: {intention}")
                    send_os_notification(
                        "🛡️ SHINPO Focus Shield Engaged",
                        f"Lockdown active for {duration}m sprint: {intention}",
                    )

                # Scan and kill distractions
                killed = scan_and_terminate(config["blacklist"], dry_run=dry_run)
                if killed and config.get("notify_desktop", True):
                    send_os_notification(
                        "🚫 Distraction Blocked by SHINPO",
                        f"Terminated {len(killed)} app(s): {', '.join(killed)}",
                    )
            else:
                if is_in_lockdown:
                    is_in_lockdown = False
                    print("\n[LOCKDOWN DISENGAGED] Focus session concluded. Normal OS access restored.")
                    send_os_notification(
                        "✅ SHINPO Focus Session Ended",
                        "Distraction enforcement released. Great execution.",
                    )

            time.sleep(config.get("poll_interval_seconds", 2))

        except KeyboardInterrupt:
            print("\n[SHINPO SHIELD] Stopped by user. Exiting cleanly.")
            break
        except Exception as e:
            time.sleep(3)

if __name__ == "__main__":
    main()
