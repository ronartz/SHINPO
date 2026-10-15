import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

async function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

const TABS = [
  'Dashboard',
  'Goals & Missions',
  'Focus Engine',
  'Schedule',
  'Analytics',
  'Task Manager',
  'AI Assistant'
];

const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1000, height: 768 }
];

const THEMES = ['dark', 'light'];

// Browser-injected DOM evaluation script
const DOM_AUDIT_SCRIPT = `
(() => {
  function parseColor(str) {
    if (!str) return null;
    str = str.trim();
    if (str === "transparent" || str === "rgba(0, 0, 0, 0)") return { r: 0, g: 0, b: 0, a: 0 };
    const m = str.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/);
    if (m) {
      return {
        r: parseInt(m[1], 10),
        g: parseInt(m[2], 10),
        b: parseInt(m[3], 10),
        a: m[4] !== undefined ? parseFloat(m[4]) : 1
      };
    }
    return null;
  }

  function composite(fg, bg) {
    const a = fg.a + bg.a * (1 - fg.a);
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    return {
      r: Math.round((fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a),
      g: Math.round((fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a),
      b: Math.round((fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a),
      a: a
    };
  }

  function luminance(c) {
    const sRGB = [c.r / 255, c.g / 255, c.b / 255];
    const lum = sRGB.map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    return 0.2126 * lum[0] + 0.7152 * lum[1] + 0.0722 * lum[2];
  }

  function contrastRatio(fg, bg) {
    const l1 = luminance(fg);
    const l2 = luminance(bg);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }

  function getEffectiveBackgroundColor(el) {
    let cur = el;
    let c = { r: 0, g: 0, b: 0, a: 0 };
    const isLight = document.documentElement.getAttribute("data-theme") === "light";
    const def = isLight ? { r: 247, g: 246, b: 243, a: 1 } : { r: 18, g: 19, b: 22, a: 1 };

    while (cur && cur !== document.documentElement) {
      const s = window.getComputedStyle(cur);
      let bg = parseColor(s.backgroundColor);
      if ((!bg || bg.a === 0) && s.backgroundImage && s.backgroundImage.includes('gradient')) {
        const m = s.backgroundImage.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (m) {
          bg = {
            r: parseInt(m[1], 10),
            g: parseInt(m[2], 10),
            b: parseInt(m[3], 10),
            a: m[4] !== undefined ? parseFloat(m[4]) : 1
          };
        }
      }
      if (bg && bg.a > 0) {
        c = composite(bg, c);
        if (c.a >= 0.98) break;
      }
      cur = cur.parentElement;
    }
    if (c.a < 0.98) c = composite(c, def);
    return c;
  }

  const results = {
    horizontalOverflow: false,
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    contrastFailures: [],
    tinyText: [],
    clippedText: [],
    unlabelledControls: []
  };

  if (document.documentElement.scrollWidth > window.innerWidth + 2) {
    results.horizontalOverflow = true;
  }

  const allElements = document.querySelectorAll('*');
  for (const el of allElements) {
    const tag = el.tagName.toLowerCase();
    if (['script', 'style', 'svg', 'path', 'defs', 'polygon', 'linearGradient', 'stop'].includes(tag)) continue;
    
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0 || rect.bottom < 0 || rect.top > window.innerHeight) continue;

    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) continue;

    // Check accessible buttons/inputs
    if (['button', 'input', 'select', 'textarea'].includes(tag)) {
      const hasAria = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
      const hasTitle = el.getAttribute('title');
      const text = el.innerText ? el.innerText.trim() : '';
      const placeholder = el.getAttribute('placeholder');
      if (!hasAria && !hasTitle && !text && !placeholder) {
        results.unlabelledControls.push({
          tag,
          className: el.className ? String(el.className).slice(0, 50) : '',
          id: el.id || ''
        });
      }
    }

    const hasDirectText = Array.from(el.childNodes).some(n => n.nodeType === Node.TEXT_NODE && n.nodeValue.trim().length > 0);
    if (hasDirectText) {
      const text = el.innerText ? el.innerText.trim() : '';
      if (!text) continue;

      const fontSize = parseFloat(style.fontSize);
      const fontWeight = parseInt(style.fontWeight, 10) || 400;
      const isLarge = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
      const minRatio = isLarge ? 3.0 : 4.5;

      // Font size check (< 11.5px)
      if (fontSize < 11.5 && !el.closest('.shinpo-matrix-mark') && !el.classList.contains('sidebar-active-arrow')) {
        results.tinyText.push({
          tag,
          className: el.className ? String(el.className).slice(0, 60) : '',
          fontSize: fontSize + 'px',
          textSnippet: text.slice(0, 40)
        });
      }

      // Clipping check
      if (el.scrollWidth > el.clientWidth + 3 && style.overflow === 'hidden' && style.textOverflow !== 'ellipsis') {
        results.clippedText.push({
          tag,
          className: el.className ? String(el.className).slice(0, 60) : '',
          textSnippet: text.slice(0, 40),
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth
        });
      }

      // Contrast check
      const fg = parseColor(style.color);
      if (fg) {
        // Special case: check if element itself has gradient background (like avatar circle or gradient tags)
        const hasBgImage = style.backgroundImage && style.backgroundImage !== 'none';
        if (!hasBgImage) {
          const bg = getEffectiveBackgroundColor(el);
          const ratio = contrastRatio(fg, bg);
          if (ratio < minRatio) {
            results.contrastFailures.push({
              tag,
              className: el.className ? String(el.className).slice(0, 60) : '',
              textSnippet: text.slice(0, 50),
              fontSize: fontSize + 'px',
              color: style.color,
              bgColor: 'rgb(' + bg.r + ',' + bg.g + ',' + bg.b + ')',
              ratio: Math.round(ratio * 100) / 100,
              required: minRatio
            });
          }
        }
      }
    }
  }

  return {
    horizontalOverflow: results.horizontalOverflow,
    scrollWidth: results.scrollWidth,
    innerWidth: results.innerWidth,
    contrastFailuresCount: results.contrastFailures.length,
    contrastFailures: results.contrastFailures.slice(0, 25),
    tinyTextCount: results.tinyText.length,
    tinyText: results.tinyText.slice(0, 15),
    clippedTextCount: results.clippedText.length,
    clippedText: results.clippedText.slice(0, 10),
    unlabelledControlsCount: results.unlabelledControls.length,
    unlabelledControls: results.unlabelledControls.slice(0, 10)
  };
})()
`;

async function main() {
  const mode = process.argv[2] || 'baseline';
  const outBase = `/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/${mode}`;
  const reportPath = `/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/scratch/ui_defects_${mode}.json`;
  fs.mkdirSync(outBase, { recursive: true });

  console.log(`=======================================================`);
  console.log(`Starting SHINPO UI Quality Audit & Matrix: [${mode}]`);
  console.log(`Output: ${outBase}`);
  console.log(`=======================================================`);

  const chrome = spawn('google-chrome', [
    '--headless=new',
    '--remote-debugging-port=9244',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    'http://localhost:5173/'
  ]);

  const auditReport = {
    mode,
    timestamp: new Date().toISOString(),
    matrixResults: {},
    additionalStates: {},
    summary: {
      totalCombinations: 0,
      totalScreenshots: 0,
      totalContrastFailures: 0,
      totalTinyText: 0,
      totalClippedText: 0,
      horizontalOverflows: 0
    }
  };

  try {
    let wsUrl = null;
    for (let i = 0; i < 30; i++) {
      await sleep(300);
      try {
        const res = await fetch('http://127.0.0.1:9244/json/list');
        const list = await res.json();
        const page = list.find(it => it.type === 'page');
        if (page && page.webSocketDebuggerUrl) {
          wsUrl = page.webSocketDebuggerUrl;
          break;
        }
      } catch {}
    }

    if (!wsUrl) throw new Error("Could not find chrome webSocketDebuggerUrl on 9244");

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
    await sleep(1500);

    // 1. Capture Auth Screen before logging in (Dark and Light)
    console.log("Auditing Auth View (Logged out)...");
    for (const theme of THEMES) {
      await send('Page.navigate', {
        url: `http://localhost:5173/?theme=${theme}`
      });
      await sleep(1000);
      await send('Runtime.evaluate', {
        expression: `
          localStorage.clear();
          document.documentElement.setAttribute('data-theme', '${theme}');
        `
      });
      await send('Page.reload');
      await sleep(1200);

      await send('Emulation.setDeviceMetricsOverride', {
        width: 1440,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false
      });
      await sleep(350);

      const auditEval = await send('Runtime.evaluate', {
        expression: DOM_AUDIT_SCRIPT,
        returnByValue: true
      });
      const auditData = auditEval.result?.result?.value || {};
      auditReport.additionalStates[`Auth_${theme}_1440x900`] = auditData;

      const shot = await send('Page.captureScreenshot', { format: 'png' });
      const buffer = Buffer.from(shot.result.data, 'base64');
      const filename = path.join(outBase, `Auth_1440x900_${theme}.png`);
      fs.writeFileSync(filename, buffer);
      auditReport.summary.totalScreenshots++;
      console.log(`[AUTH] Captured ${path.basename(filename)} - Contrast failures: ${auditData.contrastFailuresCount || 0}`);
    }

    // 2. Authenticate using test configuration
    const auditUser = process.env.SHINPO_AUDIT_USER || "EONX";
    const auditPass = process.env.SHINPO_AUDIT_PASSWORD || "shinpo_dev";
    console.log(`\nAuthenticating as ${auditUser}...`);
    await send('Runtime.evaluate', {
      expression: `
        (async () => {
          const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ usernameOrEmail: ${JSON.stringify(auditUser)}, password: ${JSON.stringify(auditPass)} })
          });
          const data = await res.json();
          if (data && data.accessToken) {
            localStorage.setItem("shinpo_access_token", data.accessToken);
            localStorage.setItem("shinpo_refresh_token", data.refreshToken);
            localStorage.setItem("shinpo_auth_user", JSON.stringify(data.user));
            localStorage.setItem("shinpo_tutorial_completed", "true");
            return "LOGGED_IN: " + (data.user?.username || "user");
          }
          return "LOGIN_FAILED";
        })()
      `,
      awaitPromise: true
    });
    await sleep(1000);

    // 3. Complete 56-combination matrix (7 tabs x 4 viewports x 2 themes)
    console.log("\nStarting 56-combination matrix audit...");
    for (const tab of TABS) {
      const tabSlug = tab.replace(/[^a-zA-Z0-9]/g, '_');
      console.log(`\n-------------------------------------------------------`);
      console.log(`Auditing Screen: [${tab}]`);
      console.log(`-------------------------------------------------------`);

      for (const theme of THEMES) {
        await send('Page.navigate', {
          url: `http://localhost:5173/?tab=${encodeURIComponent(tab)}&theme=${theme}`
        });
        await sleep(1500);

        for (const vp of VIEWPORTS) {
          const comboKey = `${tabSlug}_${vp.width}x${vp.height}_${theme}`;
          await send('Emulation.setDeviceMetricsOverride', {
            width: vp.width,
            height: vp.height,
            deviceScaleFactor: 1,
            mobile: false
          });
          await sleep(400);

          // Evaluate DOM
          const auditEval = await send('Runtime.evaluate', {
            expression: DOM_AUDIT_SCRIPT,
            returnByValue: true
          });
          const auditData = auditEval.result?.result?.value || {};
          auditReport.matrixResults[comboKey] = auditData;
          auditReport.summary.totalCombinations++;
          if (auditData.horizontalOverflow) auditReport.summary.horizontalOverflows++;
          auditReport.summary.totalContrastFailures += auditData.contrastFailuresCount || 0;
          auditReport.summary.totalTinyText += auditData.tinyTextCount || 0;
          auditReport.summary.totalClippedText += auditData.clippedTextCount || 0;

          // Capture Screenshot
          const shot = await send('Page.captureScreenshot', { format: 'png' });
          const buffer = Buffer.from(shot.result.data, 'base64');
          const filename = path.join(outBase, `${comboKey}.png`);
          fs.writeFileSync(filename, buffer);
          auditReport.summary.totalScreenshots++;

          console.log(`[${theme.toUpperCase()} ${vp.width}x${vp.height}] ${tabSlug} -> Contrast: ${auditData.contrastFailuresCount || 0}, Tiny: ${auditData.tinyTextCount || 0}, Clipped: ${auditData.clippedTextCount || 0}, H-Overflow: ${auditData.horizontalOverflow ? 'YES' : 'NO'}`);
        }
      }
    }

    // 4. Additional States: Sidebar collapsed vs expanded, Modals/Dialogs
    console.log("\nAuditing Additional States (Sidebar toggle, Modals)...");
    
    // Sidebar toggle test at 1440x900 Light & Dark
    for (const theme of THEMES) {
      await send('Page.navigate', {
        url: `http://localhost:5173/?tab=Dashboard&theme=${theme}`
      });
      await sleep(1200);
      await send('Emulation.setDeviceMetricsOverride', {
        width: 1440,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false
      });
      await sleep(300);

      // Click toggle sidebar button
      await send('Runtime.evaluate', {
        expression: `
          const btn = document.querySelector('.sidebar-toggle-btn');
          if (btn) btn.click();
        `
      });
      await sleep(500);

      const shot = await send('Page.captureScreenshot', { format: 'png' });
      const buffer = Buffer.from(shot.result.data, 'base64');
      const filename = path.join(outBase, `Sidebar_Collapsed_1440x900_${theme}.png`);
      fs.writeFileSync(filename, buffer);
      auditReport.summary.totalScreenshots++;
      console.log(`[SIDEBAR] Captured collapsed sidebar: ${path.basename(filename)}`);
    }

    // Open Create Goal Modal
    for (const theme of THEMES) {
      await send('Page.navigate', {
        url: `http://localhost:5173/?tab=Goals%20%26%20Missions&theme=${theme}`
      });
      await sleep(1500);
      await send('Emulation.setDeviceMetricsOverride', {
        width: 1440,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false
      });
      await sleep(300);

      // Open modal
      await send('Runtime.evaluate', {
        expression: `
          const createBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('New Goal') || b.innerText.includes('Create Goal'));
          if (createBtn) createBtn.click();
        `
      });
      await sleep(600);

      const auditEval = await send('Runtime.evaluate', {
        expression: DOM_AUDIT_SCRIPT,
        returnByValue: true
      });
      const auditData = auditEval.result?.result?.value || {};
      auditReport.additionalStates[`Modal_CreateGoal_${theme}_1440x900`] = auditData;

      const shot = await send('Page.captureScreenshot', { format: 'png' });
      const buffer = Buffer.from(shot.result.data, 'base64');
      const filename = path.join(outBase, `Modal_CreateGoal_1440x900_${theme}.png`);
      fs.writeFileSync(filename, buffer);
      auditReport.summary.totalScreenshots++;
      console.log(`[MODAL] Captured Create Goal modal: ${path.basename(filename)} - Contrast: ${auditData.contrastFailuresCount || 0}`);
    }

    // Save report
    fs.writeFileSync(reportPath, JSON.stringify(auditReport, null, 2));
    console.log(`\n=======================================================`);
    console.log(`AUDIT COMPLETE! Total screenshots: ${auditReport.summary.totalScreenshots}`);
    console.log(`Defect report written to: ${reportPath}`);
    console.log(`Total contrast failures logged across matrix: ${auditReport.summary.totalContrastFailures}`);
    console.log(`Total tiny text logged across matrix: ${auditReport.summary.totalTinyText}`);
    console.log(`Total clipped text logged: ${auditReport.summary.totalClippedText}`);
    console.log(`Horizontal overflows: ${auditReport.summary.horizontalOverflows}`);
    console.log(`=======================================================`);

    ws.close();
  } finally {
    chrome.kill('SIGKILL');
  }
}

main().catch(err => {
  console.error("Audit error:", err);
  process.exit(1);
});
