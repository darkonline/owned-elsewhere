// Minimal Chrome DevTools Protocol helpers shared by the e2e and exploration scripts.
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const EDGE = process.env.EDGE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
    else listeners.forEach(l => l(m));
  };
  const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const msg = { id: ++id, method, params };
    if (sessionId) msg.sessionId = sessionId;
    pending.set(msg.id, { res, rej });
    ws.send(JSON.stringify(msg));
  });
  return { send, on: l => listeners.push(l), close: () => ws.close() };
}

/** Starts headless Edge with a throw-away profile. opts: { extDir, lang, port } */
async function launch(opts = {}) {
  const port = opts.port || 9333;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'oe-cdp-'));
  const args = ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`, '--enable-unsafe-extension-debugging'];
  if (opts.lang) args.push('--lang=' + opts.lang, '--accept-lang=' + opts.lang);
  if (opts.extDir) args.push(`--disable-extensions-except=${opts.extDir}`);
  args.push('about:blank');
  const proc = spawn(EDGE, args, { stdio: 'ignore' });
  let ver;
  for (let i = 0; i < 50 && !ver; i++) { try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch (e) { await sleep(200); } }
  if (!ver) throw new Error('Edge did not start');
  const c = await connect(ver.webSocketDebuggerUrl);
  let extId = null;
  if (opts.extDir) extId = (await c.send('Extensions.loadUnpacked', { path: opts.extDir })).id;

  const newPage = async (url, { width = 1280, height = 800, wait = 1500 } = {}) => {
    const { targetId } = await c.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await c.send('Target.attachToTarget', { targetId, flatten: true });
    await c.send('Page.enable', {}, sessionId);
    await c.send('Runtime.enable', {}, sessionId);
    c.on(m => { if (m.sessionId === sessionId && m.method === 'Runtime.exceptionThrown') console.log('  page exception:', m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description); });
    await c.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }, sessionId);
    await c.send('Page.navigate', { url }, sessionId);
    await sleep(wait);
    return sessionId;
  };
  const evaluate = async (sid, expr) => {
    const r = await c.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, sid);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text);
    return r.result.value;
  };
  const screenshot = async (sid, file) => {
    const { data } = await c.send('Page.captureScreenshot', { format: 'png' }, sid);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
  };
  const close = async () => {
    c.close();
    proc.kill();
    await sleep(500);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { /* still locked */ }
  };
  return { c, extId, newPage, evaluate, screenshot, close, sleep };
}

module.exports = { launch, sleep };
