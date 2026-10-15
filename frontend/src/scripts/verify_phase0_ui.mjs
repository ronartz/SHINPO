import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

async function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function main() {
  const outDir = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/phase0';
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`=======================================================`);
  console.log(`SHINPO Phase 0: UI Recovery Verification & Capture`);
  console.log(`Target: ${outDir}`);
  console.log(`=======================================================`);

  const chrome = spawn('google-chrome', [
    '--headless=new',
    '--remote-debugging-port=9258',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    'http://localhost:5173/'
  ]);

  try {
    let wsUrl = null;
    for (let i = 0; i < 30; i++) {
      await sleep(300);
      try {
        const res = await fetch('http://127.0.0.1:9258/json/list');
        const list = await res.json();
        const page = list.find((it) => it.type === 'page');
        if (page && page.webSocketDebuggerUrl) {
          wsUrl = page.webSocketDebuggerUrl;
          break;
        }
      } catch {}
    }

    if (!wsUrl) throw new Error('Could not find Chrome webSocketDebuggerUrl on 9258');

    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => {
      ws.onopen = res;
      ws.onerror = rej;
    });

    let id = 1;
    const pending = new Map();
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    };

    function send(method, params = {}) {
      return new Promise((resolve) => {
        const msgId = id++;
        pending.set(msgId, resolve);
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    }

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await sleep(500);

    // 1. Authenticate using test configuration
    const testUser = process.env.SHINPO_AUDIT_USER || 'EONX';
    const testPass = process.env.SHINPO_AUDIT_PASSWORD || 'shinpo_dev';
    console.log(`Authenticating as ${testUser}...`);

    await send('Runtime.evaluate', {
      expression: `
        (async () => {
          const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ usernameOrEmail: ${JSON.stringify(testUser)}, password: ${JSON.stringify(testPass)} })
          });
          const data = await res.json();
          if (data && data.accessToken) {
            localStorage.setItem("shinpo_access_token", data.accessToken);
            localStorage.setItem("shinpo_refresh_token", data.refreshToken);
            localStorage.setItem("shinpo_auth_user", JSON.stringify(data.user));
            localStorage.setItem("shinpo_tutorial_completed", "true");
            return "LOGGED_IN";
          }
          return "LOGIN_FAILED";
        })()
      `,
      awaitPromise: true,
    });
    await sleep(1000);

    const THEMES = ['dark', 'light'];
    const SCREENS = [
      { tab: 'Dashboard', filePrefix: 'Dashboard' },
      { tab: 'Focus Engine', filePrefix: 'Focus' },
      { tab: 'Task Manager', filePrefix: 'TaskManager' },
    ];

    // Capture Core Views
    for (const screen of SCREENS) {
      for (const theme of THEMES) {
        console.log(`Capturing ${screen.filePrefix} [${theme}]...`);
        await send('Page.navigate', {
          url: `http://localhost:5173/?tab=${encodeURIComponent(screen.tab)}&theme=${theme}`,
        });
        await sleep(1800);

        const shot = await send('Page.captureScreenshot', { format: 'png' });
        const buffer = Buffer.from(shot.result.data, 'base64');
        const filename = path.join(outDir, `${screen.filePrefix}_${theme}.png`);
        fs.writeFileSync(filename, buffer);
        console.log(` -> Saved: ${path.basename(filename)}`);
      }
    }

    // Capture EONPAI with populated debrief and recommendation card
    console.log('\nCapturing EONPAI with populated recommendation & debrief cards...');
    for (const theme of THEMES) {
      await send('Page.navigate', {
        url: `http://localhost:5173/?tab=AI%20Assistant&theme=${theme}`,
      });
      await sleep(1500);

      // Inject rich realistic debrief analysis and action proposals into DOM/State
      await send('Runtime.evaluate', {
        expression: `
          (() => {
            const feed = document.querySelector('.ai-messages-scroll, .ai-messages-feed');
            if (feed) {
              const demoCard = document.createElement('div');
              demoCard.className = 'ai-bubble assistant';
              demoCard.style.maxWidth = '100%';
              demoCard.innerHTML = \`
                <div class="ai-bubble-meta">
                  <span class="ai-bubble-author">EONPAI</span>
                  <span class="ai-bubble-time">Just now</span>
                </div>
                <div class="ai-bubble-content">
                  <p>Here is your tactical focus session debrief and next recommended sprint:</p>
                  
                  <div class="ai-debrief-card" style="margin-top: 12px;">
                    <div class="ai-debrief-header">
                      <div class="ai-debrief-title-group">
                        <span class="ai-debrief-title">Sprint Complete: Architecture & Polish</span>
                      </div>
                      <span class="ai-debrief-accuracy-chip high">96% On Target</span>
                    </div>

                    <div class="debrief-stat-grid">
                      <div class="debrief-stat-block">
                        <span class="stat-label">Actual Focus</span>
                        <span class="stat-val">32m</span>
                      </div>
                      <div class="debrief-stat-block">
                        <span class="stat-label">Planned Budget</span>
                        <span class="stat-val">30m</span>
                      </div>
                      <div class="debrief-stat-block">
                        <span class="stat-label">Estimation Accuracy</span>
                        <span class="stat-val">96%</span>
                      </div>
                    </div>

                    <div class="ai-debrief-critique-box">
                      <div class="ai-debrief-critique-header">
                        <span>Pacing Review</span>
                      </div>
                      <p class="ai-debrief-text">Execution pace was sustained with zero distraction interventions. Kept flow state across 3 consecutive task completions.</p>
                    </div>

                    <div class="ai-debrief-recommendation-box" style="margin-top: 8px;">
                      <div class="ai-debrief-recommendation-header">
                        <span>Next Recommendation</span>
                      </div>
                      <p class="ai-debrief-text">Schedule a 10m tactical recharge or immediately arm the next subtask while mental context is fresh.</p>
                    </div>

                    <div class="ai-debrief-actions" style="margin-top: 10px;">
                      <span class="ai-debrief-actions-title">Recommended Next Steps:</span>
                      <div class="ai-recovery-options-row">
                        <div class="ai-recovery-option-card">
                          <div class="recovery-option-info">
                            <span class="recovery-option-title">Arm Subtask SPRINT-4</span>
                            <span class="recovery-option-desc">Start 25m Focus Block</span>
                          </div>
                          <button type="button" class="ai-arm-sprint-btn" title="Activate Sprint">
                            <span>Activate</span>
                          </button>
                        </div>
                        <div class="ai-recovery-option-card">
                          <div class="recovery-option-info">
                            <span class="recovery-option-title">10m Tactical Rest</span>
                            <span class="recovery-option-desc">Reset Cognitive Load</span>
                          </div>
                          <button type="button" class="ai-arm-sprint-btn" title="Activate Rest">
                            <span>Activate</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              \`;
              feed.appendChild(demoCard);
              demoCard.scrollIntoView({ behavior: 'instant', block: 'end' });
            }
          })()
        `,
      });
      await sleep(600);

      const shot = await send('Page.captureScreenshot', { format: 'png' });
      const buffer = Buffer.from(shot.result.data, 'base64');
      const filename = path.join(outDir, `Eonpai_Populated_${theme}.png`);
      fs.writeFileSync(filename, buffer);
      console.log(` -> Saved: ${path.basename(filename)}`);
    }

    // Capture Sidebar Expanded & Collapsed states
    console.log('\nCapturing Sidebar states...');
    for (const theme of THEMES) {
      await send('Page.navigate', {
        url: `http://localhost:5173/?tab=Dashboard&theme=${theme}`,
      });
      await sleep(1500);

      // Expanded Sidebar Screenshot
      const shotExp = await send('Page.captureScreenshot', { format: 'png' });
      const filenameExp = path.join(outDir, `Sidebar_Quote_Expanded_${theme}.png`);
      fs.writeFileSync(filenameExp, Buffer.from(shotExp.result.data, 'base64'));
      console.log(` -> Saved: ${path.basename(filenameExp)}`);

      // Collapse Sidebar to 70px icon rail
      await send('Runtime.evaluate', {
        expression: `
          const btn = document.querySelector('.sidebar-toggle-btn');
          if (btn) btn.click();
        `,
      });
      await sleep(600);

      const shotCol = await send('Page.captureScreenshot', { format: 'png' });
      const filenameCol = path.join(outDir, `Sidebar_Rail_Collapsed_${theme}.png`);
      fs.writeFileSync(filenameCol, Buffer.from(shotCol.result.data, 'base64'));
      console.log(` -> Saved: ${path.basename(filenameCol)}`);
    }

    console.log(`\nAll Phase 0 verification screenshots saved to: ${outDir}`);
    ws.close();
  } finally {
    chrome.kill('SIGKILL');
  }
}

main().catch((err) => {
  console.error('Phase 0 capture error:', err);
  process.exit(1);
});

