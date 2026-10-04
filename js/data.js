/* ============================================================
   BongLy TradeAI — Shared data + helpers (no backend needed)
   Everything persists in localStorage.
   ============================================================ */
(function () {
  "use strict";

  const LS = {
    users: "bongly_users",
    session: "bongly_session",
    positions: "bongly_positions",
    alerts: "bongly_alerts",
    settings: "bongly_alert_settings",
    logs: "bongly_admin_logs",
  };

  const read = (k, fallback) => {
    try {
      const raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  };
  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  /* ---------------- Market universe ---------------- */
  const MARKETS = [
    { sym: "BTC/USDT", name: "Bitcoin", price: 67432.5, vol: "2.4B", tag: "BTC", color: "#f7931a" },
    { sym: "ETH/USDT", name: "Ethereum", price: 3521.8, vol: "1.1B", tag: "ETH", color: "#8b5cf6" },
    { sym: "SOL/USDT", name: "Solana", price: 172.34, vol: "640M", tag: "SOL", color: "#22d3ee" },
    { sym: "XAU/USD", name: "Gold Spot", price: 2386.4, vol: "310M", tag: "XAU", color: "#f7b955" },
    { sym: "EUR/USD", name: "Euro / Dollar", price: 1.0872, vol: "980M", tag: "EUR", color: "#4f8cff" },
    { sym: "AAPL", name: "Apple Inc.", price: 214.29, vol: "1.8B", tag: "AAPL", color: "#16c784" },
    { sym: "NVDA", name: "NVIDIA Corp.", price: 131.17, vol: "2.1B", tag: "NVDA", color: "#76b900" },
    { sym: "TSLA", name: "Tesla Inc.", price: 248.5, vol: "1.4B", tag: "TSLA", color: "#f0616d" },
    { sym: "GBP/JPY", name: "Pound / Yen", price: 198.44, vol: "420M", tag: "GBP", color: "#a78bfa" },
    { sym: "WTI/USD", name: "Crude Oil", price: 78.92, vol: "260M", tag: "WTI", color: "#94a3b8" },
  ];

  /* ---------------- Synthetic price series ---------------- */
  // Deterministic-ish random walk so charts look alive but stable per session.
  function genSeries(symbol, count) {
    const m = MARKETS.find((x) => x.sym === symbol) || MARKETS[0];
    let price = m.price * (0.94 + Math.random() * 0.1);
    const drift = (Math.random() - 0.48) * m.price * 0.0009;
    const vol = m.price * 0.006;
    const out = [];
    const now = Date.now();
    const stepMs = 60 * 1000;
    for (let i = count - 1; i >= 0; i--) {
      const t = now - i * stepMs;
      const open = price;
      const close = open + drift + (Math.random() - 0.5) * vol * 2;
      const hi = Math.max(open, close) + Math.random() * vol * 0.9;
      const lo = Math.min(open, close) - Math.random() * vol * 0.9;
      out.push({
        t,
        o: +open.toFixed(m.price < 10 ? 5 : 2),
        h: +hi.toFixed(m.price < 10 ? 5 : 2),
        l: +lo.toFixed(m.price < 10 ? 5 : 2),
        c: +close.toFixed(m.price < 10 ? 5 : 2),
        v: Math.round(60 + Math.random() * 240),
      });
      price = close;
    }
    return out;
  }

  /* ---------------- News feed ---------------- */
  const NEWS = [
    { id: 1, tag: "BTC", title: "Bitcoin breaks key resistance as ETF inflows hit 3-week high", src: "CoinDesk", mins: 8, tone: "pos" },
    { id: 2, tag: "MAC", title: "Fed minutes hint at slower pace of rate cuts into Q3", src: "Reuters", mins: 21, tone: "neg" },
    { id: 3, tag: "ETH", title: "Ethereum staking yields steady above 4.1% amid validator growth", src: "The Block", mins: 34, tone: "pos" },
    { id: 4, tag: "NVDA", title: "NVIDIA supply chain reports point to record data-center demand", src: "Bloomberg", mins: 47, tone: "pos" },
    { id: 5, tag: "OIL", title: "Crude slips as OPEC+ signals extended voluntary cuts", src: "WSJ", mins: 62, tone: "neg" },
    { id: 6, tag: "XAU", title: "Gold consolidates near record as dollar softens", src: "Kitco", mins: 74, tone: "neu" },
    { id: 7, tag: "REG", title: "SEC publishes updated custody rule framework for exchanges", src: "FT", mins: 96, tone: "neu" },
    { id: 8, tag: "SOL", title: "Solana network activity surges 22% week over week", src: "Decrypt", mins: 118, tone: "pos" },
    { id: 9, tag: "TSLA", title: "Tesla deliveries miss consensus in latest quarterly print", src: "CNBC", mins: 140, tone: "neg" },
  ];

  /* ---------------- Seeded users ---------------- */
  function seedUsers() {
    const existing = read(LS.users, null);
    if (existing && existing.length) return existing;
    // join dates are spread over the last ~7 months so the growth chart always has data
    const daysAgo = (d) => dateStr(Date.now() - d * 86400000);
    const users = [
      { id: "u_1001", name: "Alex Rivera", email: "admin@bongly.io", pass: "admin123", role: "admin", plan: "Elite", status: "active", balance: 25400, created: daysAgo(178), alerts: 128 },
      { id: "u_1002", name: "Mia Chen", email: "user@bongly.io", pass: "user123", role: "user", plan: "Pro", status: "active", balance: 8750, created: daysAgo(141), alerts: 64 },
      { id: "u_1003", name: "Omar Haddad", email: "omar.h@mail.com", pass: "pass1234", role: "user", plan: "Pro", status: "active", balance: 5120.5, created: daysAgo(96), alerts: 41 },
      { id: "u_1004", name: "Sofia Petrova", email: "sofia.p@mail.com", pass: "pass1234", role: "user", plan: "Starter", status: "suspended", balance: 320, created: daysAgo(52), alerts: 12 },
      { id: "u_1005", name: "Liam O'Connor", email: "liam.oc@mail.com", pass: "pass1234", role: "user", plan: "Elite", status: "active", balance: 18430, created: daysAgo(21), alerts: 96 },
      { id: "u_1006", name: "Yuki Tanaka", email: "yuki.t@mail.com", pass: "pass1234", role: "user", plan: "Starter", status: "active", balance: 780, created: daysAgo(4), alerts: 23 },
    ];
    write(LS.users, users);
    return users;
  }

  function getUsers() { return read(LS.users, seedUsers()); }
  function saveUsers(u) { write(LS.users, u); }
  function getSession() { return read(LS.session, null); }
  function setSession(s) { write(LS.session, s); }
  function clearSession() { localStorage.removeItem(LS.session); }
  function findUser(email, pass) {
    return getUsers().find((u) => u.email.toLowerCase() === String(email).toLowerCase() && u.pass === pass) || null;
  }
  function getUserById(id) { return getUsers().find((u) => u.id === id) || null; }

  function requireAuth(roles) {
    const s = getSession();
    if (!s) { location.href = "login.html"; return null; }
    const u = getUserById(s.uid);
    if (!u) { clearSession(); location.href = "login.html"; return null; }
    if (roles && roles.length && !roles.includes(u.role)) { location.href = "dashboard.html"; return null; }
    return u;
  }

  /* ---------------- Alert settings ---------------- */
  const defaultSettings = { push: true, sound: true, vibrate: true, sms: false, minConf: 78, symbols: "all" };
  function getSettings() { return Object.assign({}, defaultSettings, read(LS.settings, {})); }
  function saveSettings(s) { write(LS.settings, s); }

  /* ---------------- Alerts log ---------------- */
  function getAlerts() { return read(LS.alerts, []); }
  function pushAlert(a) {
    const list = getAlerts();
    list.unshift(Object.assign({ id: Date.now(), at: Date.now() }, a));
    write(LS.alerts, list.slice(0, 60));
    return list;
  }

  /* ---------------- Admin activity log ---------------- */
  function getLogs() { return read(LS.logs, []); }
  function addLog(action, detail) {
    const list = getLogs();
    const s = getSession();
    list.unshift({ id: Date.now(), action, detail, by: s ? s.email : "system", at: Date.now() });
    write(LS.logs, list.slice(0, 40));
  }

  /* ---------------- Formatters ---------------- */
  const fmt = (n, d) => Number(n).toLocaleString("en-US", { minimumFractionDigits: d ?? 2, maximumFractionDigits: d ?? 2 });
  const money = (n, d) => "$" + fmt(n, d ?? 2);
  const pct = (n) => (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
  const timeAgo = (ts) => {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return s + "s ago";
    const m = Math.floor(s / 60);
    if (m < 60) return m + "m ago";
    const h = Math.floor(m / 60);
    if (h < 24) return h + "h ago";
    return Math.floor(h / 24) + "d ago";
  };
  const clock = (ts) => new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dateStr = (ts) => new Date(ts).toISOString().slice(0, 10);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------------- Toast notifications ---------------- */
  function ensureToastStack() {
    let el = document.querySelector(".toast-stack");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast-stack";
      document.body.appendChild(el);
    }
    return el;
  }
  function toast(title, msg, kind) {
    const stack = ensureToastStack();
    const icons = { buy: "📈", sell: "📉", warn: "⚠️", info: "🔔" };
    const el = document.createElement("div");
    el.className = "toast " + (kind || "info");
    el.innerHTML = `<div class="ic">${icons[kind] || icons.info}</div><div><b>${esc(title)}</b><p>${esc(msg)}</p></div>`;
    stack.appendChild(el);
    setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 320); }, 4600);
  }

  /* ---------------- Phone alerting (Notification + sound + vibrate) ---------------- */
  let audioCtx = null;
  function beep(kind) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.connect(g); g.connect(audioCtx.destination);
      const base = kind === "sell" ? 330 : kind === "warn" ? 240 : 520;
      o.frequency.setValueAtTime(base, audioCtx.currentTime);
      o.frequency.linearRampToValueAtTime(base * (kind === "sell" ? 0.7 : 1.35), audioCtx.currentTime + 0.16);
      g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.09, audioCtx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.3);
      o.start(); o.stop(audioCtx.currentTime + 0.32);
    } catch (e) { /* silent */ }
  }

  async function askPushPermission() {
    if (!("Notification" in window)) { toast("Push not supported", "This browser can't show system notifications — in-app alerts still work.", "warn"); return false; }
    let perm = Notification.permission;
    if (perm === "default") perm = await Notification.requestPermission();
    if (perm === "granted") { toast("Phone alerts enabled", "You'll get push notifications for new AI signals.", "buy"); return true; }
    toast("Push blocked", "Enable notifications in your browser/site settings to receive phone alerts.", "warn");
    return false;
  }

  function systemNotify(title, body) {
    if ("Notification" in window && Notification.permission === "granted") {
      try { new Notification(title, { body, icon: "favicon.svg", badge: "favicon.svg" }); } catch (e) { /* noop */ }
    }
  }

  function firePhoneAlert(sig) {
    const s = getSettings();
    const isBuy = sig.action === "BUY";
    const kind = isBuy ? "buy" : "sell";
    toast(`${sig.action} ${sig.symbol}`, `${sig.action} @ ${fmt(sig.price, sig.price < 10 ? 5 : 2)} · confidence ${sig.confidence}%`, kind);
    if (s.sound) beep(isBuy ? "buy" : "sell");
    if (s.vibrate && navigator.vibrate) navigator.vibrate(isBuy ? [18, 40, 18] : 40);
    systemNotify(`AI Signal · ${sig.action} ${sig.symbol}`, `${sig.action} at ${fmt(sig.price, sig.price < 10 ? 5 : 2)} — ${sig.confidence}% confidence. ${sig.note}`);
    pushAlert({ symbol: sig.symbol, action: sig.action, price: sig.price, confidence: sig.confidence, note: sig.note });
  }

  /* ---------------- Tiny chart engine (canvas) ---------------- */
  const Chart = {
    drawCandles(canvas, data, opts) {
      opts = opts || {};
      const dpr = window.devicePixelRatio || 1;
      const W = canvas.clientWidth, H = canvas.clientHeight;
      if (!W || !H) return;
      canvas.width = W * dpr; canvas.height = H * dpr;
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      const padL = 8, padR = 62, padT = 12, padB = 26;
      const cw = W - padL - padR, ch = H - padT - padB;
      if (!data.length) return;

      const highs = data.map((d) => d.h), lows = data.map((d) => d.l);
      const maxP = Math.max(...highs), minP = Math.min(...lows);
      const span = (maxP - minP) || 1;
      const yMax = maxP + span * 0.07, yMin = minP - span * 0.07;
      const y = (p) => padT + ch - ((p - yMin) / (yMax - yMin)) * ch;

      // grid + labels
      ctx.font = "10px ui-monospace, SFMono-Regular, Consolas, monospace";
      ctx.textBaseline = "middle";
      const rows = 5;
      for (let i = 0; i <= rows; i++) {
        const p = yMin + ((yMax - yMin) / rows) * i;
        const py = y(p);
        ctx.strokeStyle = i === 0 ? "#22304d" : "#151f36";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(padL, py); ctx.lineTo(padL + cw, py); ctx.stroke();
        ctx.fillStyle = "#5d6b87";
        ctx.textAlign = "left";
        ctx.fillText(p < 10 ? p.toFixed(4) : fmt(p, 2), padL + cw + 8, py);
      }
      // vertical time grid
      const cols = 6;
      for (let i = 0; i <= cols; i++) {
        const px = padL + (cw / cols) * i;
        ctx.strokeStyle = "#131c30";
        ctx.beginPath(); ctx.moveTo(px, padT); ctx.lineTo(px, padT + ch); ctx.stroke();
        const idx = Math.min(data.length - 1, Math.round((data.length - 1) * (i / cols)));
        const lbl = new Date(data[idx].t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
        ctx.fillStyle = "#4b5875";
        ctx.textAlign = i === 0 ? "left" : i === cols ? "right" : "center";
        ctx.fillText(lbl, px, padT + ch + 13);
      }

      const slot = cw / data.length;
      const bw = Math.max(1.6, slot * 0.62);

      // volume
      const maxV = Math.max(...data.map((d) => d.v));
      data.forEach((d, i) => {
        const x = padL + slot * i + slot / 2;
        const vh = (d.v / maxV) * ch * 0.16;
        ctx.fillStyle = d.c >= d.o ? "rgba(22,199,132,0.16)" : "rgba(240,97,109,0.16)";
        ctx.fillRect(x - bw / 2, padT + ch - vh, bw, vh);
      });

      // candles
      data.forEach((d, i) => {
        const x = padL + slot * i + slot / 2;
        const up = d.c >= d.o;
        const col = up ? "#16c784" : "#f0616d";
        ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, y(d.h)); ctx.lineTo(x, y(d.l)); ctx.stroke();
        const yo = y(d.o), yc = y(d.c);
        const top = Math.min(yo, yc), hgt = Math.max(1.4, Math.abs(yc - yo));
        if (up) { ctx.globalAlpha = 0.9; ctx.strokeRect(x - bw / 2, top, bw, hgt); ctx.globalAlpha = 1; }
        else ctx.fillRect(x - bw / 2, top, bw, hgt);
      });

      // EMA line
      const ema = (arr, p) => {
        const k = 2 / (p + 1); const out = []; let prev = arr[0].c;
        arr.forEach((d, i) => { const v = i ? d.c * k + prev * (1 - k) : d.c; out.push(v); prev = v; });
        return out;
      };
      const line = ema(data, 21);
      ctx.strokeStyle = "rgba(139,92,246,0.85)";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      line.forEach((v, i) => { const x = padL + slot * i + slot / 2; i ? ctx.lineTo(x, y(v)) : ctx.moveTo(x, y(v)); });
      ctx.stroke();

      // last price tag
      const last = data[data.length - 1];
      const lp = y(last.c);
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "rgba(79,140,255,0.5)";
      ctx.beginPath(); ctx.moveTo(padL, lp); ctx.lineTo(padL + cw, lp); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#4f8cff";
      ctx.fillRect(padL + cw + 2, lp - 9, padR - 6, 18);
      ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.font = "bold 10px ui-monospace, monospace";
      ctx.fillText(fmt(last.c, last.c < 10 ? 5 : 2), padL + cw + 7, lp);

      // crosshair
      const tip = opts.tipEl;
      if (tip && opts.hoverX != null) {
        const i = Math.max(0, Math.min(data.length - 1, Math.floor((opts.hoverX - padL) / slot)));
        const d = data[i];
        const x = padL + slot * i + slot / 2;
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = "rgba(255,255,255,0.25)";
        ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + ch); ctx.stroke();
        ctx.setLineDash([]);
        tip.style.display = "block";
        tip.style.left = Math.min(W - 150, x + 12) + "px";
        tip.style.top = padT + 6 + "px";
        tip.innerHTML = `<b style="color:#9dc0ff">${new Date(d.t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</b><br>O ${fmt(d.o, d.o < 10 ? 5 : 2)} H ${fmt(d.h, d.h < 10 ? 5 : 2)}<br>L ${fmt(d.l, d.l < 10 ? 5 : 2)} C ${fmt(d.c, d.c < 10 ? 5 : 2)}<br>Vol ${d.v}K`;
      } else if (tip) tip.style.display = "none";
    },

    // mini sparkline for landing hero
    drawSpark(canvas, data, up) {
      const dpr = window.devicePixelRatio || 1;
      const W = canvas.clientWidth, H = canvas.clientHeight;
      if (!W || !H) return;
      canvas.width = W * dpr; canvas.height = H * dpr;
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const vals = data.map((d) => d.c);
      const max = Math.max(...vals), min = Math.min(...vals), span = (max - min) || 1;
      const x = (i) => (i / (vals.length - 1)) * (W - 6) + 3;
      const y = (v) => H - 8 - ((v - min) / span) * (H - 20);
      const col = up ? "#16c784" : "#f0616d";
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, up ? "rgba(22,199,132,0.30)" : "rgba(240,97,109,0.30)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.beginPath(); ctx.moveTo(x(0), y(vals[0]));
      vals.forEach((v, i) => ctx.lineTo(x(i), y(v)));
      ctx.lineTo(x(vals.length - 1), H); ctx.lineTo(x(0), H); ctx.closePath();
      ctx.fillStyle = grad; ctx.fill();
      ctx.beginPath(); vals.forEach((v, i) => (i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v))));
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.stroke();
      ctx.beginPath(); ctx.arc(x(vals.length - 1), y(vals[vals.length - 1]), 3.2, 0, Math.PI * 2);
      ctx.fillStyle = col; ctx.fill();
    },

    // small area chart for admin growth
    drawBars(canvas, labels, values) {
      const dpr = window.devicePixelRatio || 1;
      const W = canvas.clientWidth, H = canvas.clientHeight;
      if (!W || !H) return;
      canvas.width = W * dpr; canvas.height = H * dpr;
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const padL = 6, padR = 6, padT = 10, padB = 22;
      const cw = W - padL - padR, ch = H - padT - padB;
      const max = Math.max(...values, 1);
      const bw = (cw / values.length) * 0.55;
      values.forEach((v, i) => {
        const x = padL + (cw / values.length) * i + (cw / values.length - bw) / 2;
        const h = (v / max) * ch;
        const grad = ctx.createLinearGradient(0, padT + ch - h, 0, padT + ch);
        grad.addColorStop(0, "#4f8cff"); grad.addColorStop(1, "rgba(79,140,255,0.15)");
        ctx.fillStyle = grad;
        const r = 4;
        ctx.beginPath();
        ctx.moveTo(x, padT + ch); ctx.lineTo(x, padT + ch - h + r);
        ctx.quadraticCurveTo(x, padT + ch - h, x + r, padT + ch - h);
        ctx.lineTo(x + bw - r, padT + ch - h);
        ctx.quadraticCurveTo(x + bw, padT + ch - h, x + bw, padT + ch - h + r);
        ctx.lineTo(x + bw, padT + ch); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#5d6b87"; ctx.font = "10px Inter, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "top";
        ctx.fillText(labels[i], x + bw / 2, padT + ch + 6);
      });
    },
  };

  /* ---------------- "AI" indicator engine ---------------- */
  function rsi(data, period) {
    period = period || 14;
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
      const d = data[i].c - data[i - 1].c;
      d >= 0 ? (gains += d) : (losses -= d);
    }
    let ag = gains / period, al = losses / period;
    for (let i = period + 1; i < data.length; i++) {
      const d = data[i].c - data[i - 1].c;
      ag = (ag * (period - 1) + (d > 0 ? d : 0)) / period;
      al = (al * (period - 1) + (d < 0 ? -d : 0)) / period;
    }
    return al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  }
  function macd(data) {
    const emaN = (n) => {
      const k = 2 / (n + 1); let prev = data[0].c;
      return data.map((d, i) => { const v = i ? d.c * k + prev * (1 - k) : d.c; prev = v; return v; });
    };
    const f = emaN(12), s = emaN(26);
    const macdLine = data.map((_, i) => f[i] - s[i]);
    const k = 2 / 10; let prev = macdLine[0];
    const sig = macdLine.map((v, i) => { const x = i ? v * k + prev * (1 - k) : v; prev = x; return x; });
    return { macd: macdLine[macdLine.length - 1], signal: sig[sig.length - 1] };
  }
  function ema(data, n) {
    const k = 2 / (n + 1); let prev = data[0].c;
    data.forEach((d, i) => { const v = i ? d.c * k + prev * (1 - k) : d.c; prev = v; });
    return prev;
  }

  function analyze(data, symbol) {
    const last = data[data.length - 1];
    const r = rsi(data);
    const m = macd(data);
    const e9 = ema(data, 9), e21 = ema(data, 21);
    const mom = ((last.c - data[data.length - 11].c) / data[data.length - 11].c) * 100;
    const volUp = data.slice(-5).reduce((a, b) => a + b.v, 0) / 5 > data.slice(-20, -5).reduce((a, b) => a + b.v, 0) / 15;
    const volScore = data.slice(-5).reduce((a, b) => a + b.v, 0) / 5 / (data.slice(-20, -5).reduce((a, b) => a + b.v, 0) / 15);

    let score = 50;
    score += r < 32 ? 18 : r > 70 ? -18 : (50 - r) * 0.22;
    score += m.macd > m.signal ? 13 : -13;
    score += e9 > e21 ? 9 : -9;
    score += Math.max(-12, Math.min(12, mom * 1.6));
    score += volUp ? 5 : -3;
    const confidence = Math.round(Math.max(55, Math.min(97, 52 + Math.abs(score - 50) * 1.15 + Math.random() * 5)));

    let action = "HOLD";
    if (score >= 63) action = "STRONG BUY";
    else if (score >= 53) action = "BUY";
    else if (score <= 37) action = "STRONG SELL";
    else if (score <= 47) action = "SELL";

    const notes = {
      "STRONG BUY": "Momentum + trend alignment with rising volume. Look for continuation above recent highs.",
      "BUY": "Mild bullish bias — trend is turning up but confirmation is still forming.",
      "HOLD": "Mixed signals across timeframes. Wait for a cleaner breakout or breakdown.",
      "SELL": "Mild bearish bias — momentum fading while resistance holds.",
      "STRONG SELL": "Trend + momentum breakdown with expanding sell volume. Risk-off near term.",
    };

    return {
      symbol,
      action,
      score: Math.round(score),
      confidence,
      price: last.c,
      note: notes[action],
      indicators: [
        { label: "RSI (14)", value: r.toFixed(1), raw: r, tone: r < 32 ? "up" : r > 70 ? "down" : "neu", text: r < 32 ? "Oversold" : r > 70 ? "Overbought" : "Neutral" },
        { label: "MACD", value: m.macd.toFixed(3), raw: Math.min(100, Math.max(0, 50 + m.macd * 40)), tone: m.macd > m.signal ? "up" : "down", text: m.macd > m.signal ? "Bullish cross" : "Bearish cross" },
        { label: "EMA 9 / 21", value: e9 > e21 ? "Bull" : "Bear", raw: e9 > e21 ? 72 : 28, tone: e9 > e21 ? "up" : "down", text: e9 > e21 ? "Above trend" : "Below trend" },
        { label: "Momentum (10)", value: pct(mom), raw: Math.min(100, Math.max(0, 50 + mom * 6)), tone: mom >= 0 ? "up" : "down", text: mom >= 0 ? "Buyers in control" : "Sellers in control" },
        { label: "Volume", value: volScore.toFixed(2) + "x", raw: Math.min(100, volScore * 40), tone: volUp ? "up" : "neu", text: volUp ? "Expanding" : "Average" },
        { label: "News sentiment", value: NEWS.filter((n) => n.tag === symbol.split("/")[0]).slice(0, 2).some((n) => n.tone === "pos") ? "+" : "~", raw: 66, tone: "neu", text: "AI reading headlines" },
      ],
    };
  }

  /* ---------------- Expose ---------------- */
  window.BL = {
    LS, MARKETS, NEWS, genSeries, getUsers, saveUsers, getSession, setSession, clearSession,
    findUser, getUserById, requireAuth, getSettings, saveSettings, getAlerts, pushAlert,
    getLogs, addLog, fmt, money, pct, timeAgo, clock, dateStr, esc, toast, Chart,
    analyze, firePhoneAlert, askPushPermission, beep, systemNotify,
  };
})();
