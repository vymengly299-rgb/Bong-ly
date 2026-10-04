/* ============================================================
   BongLy TradeAI — User dashboard logic
   ============================================================ */
(function () {
  "use strict";
  const BL = window.BL;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  /* ---------------- auth ---------------- */
  const me = BL.requireAuth(["user", "admin"]);
  if (!me) return;

  const session = BL.getSession();
  const initials = me.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  $("#sideAvatar").textContent = initials;
  $("#topAvatar").textContent = initials;
  $("#sideName").textContent = me.name;
  $("#sidePlan").textContent = me.plan + " plan";
  $("#topName").textContent = me.name;
  $("#topEmail").textContent = me.email;
  $("#setName").value = me.name;
  $("#setEmail").value = me.email;
  $("#greeting").textContent = `${greet()}, ${me.name.split(" ")[0]} 👋`;
  if (me.role === "admin") $("#adminLink").classList.remove("hidden");

  function greet() {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  }

  $("#logoutBtn").addEventListener("click", () => {
    BL.clearSession();
    BL.toast("Signed out", "You have been signed out safely.", "info");
    setTimeout(() => (location.href = "login.html"), 500);
  });

  /* ---------------- market data ---------------- */
  const seriesMap = {}; // symbol -> candles
  BL.MARKETS.forEach((m) => (seriesMap[m.sym] = BL.genSeries(m.sym, 110)));
  let current = "BTC/USDT";
  let timeframe = "1H";
  const TF_SCALE = { "15m": 0.35, "1H": 1, "4H": 3.2, "1D": 7.5 };

  function visibleSeries() {
    const all = seriesMap[current];
    const n = Math.max(40, Math.round(110 / TF_SCALE[timeframe]));
    return all.slice(-n);
  }
  function priceMap() {
    const m = {};
    Object.keys(seriesMap).forEach((k) => (m[k] = seriesMap[k][seriesMap[k].length - 1].c));
    return m;
  }
  const dec = (sym) => (BL.MARKETS.find((m) => m.sym === sym).price < 10 ? 5 : 2);
  const priceNow = (sym) => seriesMap[sym][seriesMap[sym].length - 1].c;

  // symbol selectors
  const symbolSelect = $("#symbolSelect");
  const tradeSymbol = $("#tradeSymbol");
  BL.MARKETS.forEach((m) => {
    symbolSelect.insertAdjacentHTML("beforeend", `<option value="${m.sym}" ${m.sym === current ? "selected" : ""}>${m.sym} · ${m.name}</option>`);
    tradeSymbol.insertAdjacentHTML("beforeend", `<option value="${m.sym}" ${m.sym === current ? "selected" : ""}>${m.sym}</option>`);
  });
  symbolSelect.addEventListener("change", () => { current = symbolSelect.value; tradeSymbol.value = current; renderAll(); });
  tradeSymbol.addEventListener("change", () => { current = tradeSymbol.value; symbolSelect.value = current; renderAll(); });

  // timeframes
  $$("#tfSeg button").forEach((b) =>
    b.addEventListener("click", () => {
      $$("#tfSeg button").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      timeframe = b.dataset.tf;
      renderChart();
    })
  );

  /* ---------------- chart ---------------- */
  const canvas = $("#mainChart");
  const tip = $("#chartTip");
  let hoverX = null;

  function renderChart() {
    const data = visibleSeries();
    BL.Chart.drawCandles(canvas, data, { tipEl: tip, hoverX });
    const last = data[data.length - 1];
    const first = data[0];
    const d = dec(current);
    $("#chartPrice").textContent = BL.fmt(last.c, d);
    const chg = ((last.c - first.c) / first.c) * 100;
    $("#chartChange").innerHTML = `<span class="badge ${chg >= 0 ? "badge-green" : "badge-red"}">${chg >= 0 ? "▲" : "▼"} ${BL.pct(chg)}</span>`;
    const slice = seriesMap[current].slice(-40);
    $("#stat24h").textContent = BL.fmt(Math.max(...slice.map((x) => x.h)), d);
    $("#stat24l").textContent = BL.fmt(Math.min(...slice.map((x) => x.l)), d);
    $("#stat24v").textContent = (slice.reduce((a, b) => a + b.v, 0) / 1000).toFixed(1) + "M";
    $("#chartUpdated").textContent = "updated " + BL.clock(Date.now());
  }

  canvas.addEventListener("mousemove", (e) => {
    const r = canvas.getBoundingClientRect();
    hoverX = e.clientX - r.left;
    renderChart();
  });
  canvas.addEventListener("mouseleave", () => { hoverX = null; renderChart(); });

  // keep the canvas crisp when the viewport changes
  let resizeT;
  window.addEventListener("resize", () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(renderChart, 120);
  });

  /* ---------------- live price engine ---------------- */
  setInterval(() => {
    BL.MARKETS.forEach((m) => {
      const arr = seriesMap[m.sym];
      const last = arr[arr.length - 1];
      const vol = m.price * 0.0022;
      const c = Math.max(m.price * 0.5, last.c + (Math.random() - 0.5) * vol * 2);
      arr.push({
        t: Date.now(),
        o: last.c,
        h: Math.max(last.c, c) + Math.random() * vol * 0.4,
        l: Math.min(last.c, c) - Math.random() * vol * 0.4,
        c: +c.toFixed(m.price < 10 ? 5 : 2),
        v: Math.round(60 + Math.random() * 260),
      });
      if (arr.length > 400) arr.shift();
    });
    renderChart();
    renderPositions();
    renderOrderSummary();
    BL.resolveSignals(priceMap());
    renderBoard();
    renderSignalStats();
  }, 1400);

  setInterval(() => { $("#clockNow").textContent = new Date().toLocaleTimeString("en-GB"); }, 1000);
  $("#clockNow").textContent = new Date().toLocaleTimeString("en-GB");

  /* ---------------- AI signal engine (structured trade plan) ---------------- */
  let currentSignal = null;

  function renderSignal(sig, animate) {
    currentSignal = sig;
    const box = $("#verdictBox");
    const kind = sig.action.includes("BUY") ? "buy" : sig.action.includes("SELL") ? "sell" : "hold";
    box.className = "ai-verdict " + (sig.action === "STRONG BUY" ? "strong-buy" : sig.action === "STRONG SELL" ? "strong-sell" : kind);
    $("#verdictAction").textContent = `${sig.action} · ${sig.symbol}`;
    $("#verdictAction").className = sig.action.includes("BUY") ? "up" : sig.action.includes("SELL") ? "down" : "";
    $("#verdictNote").textContent = sig.note;
    $("#confNum").textContent = sig.confidence + "%";
    $("#analyzeSymbol").textContent = sig.symbol;
    $("#sigModel").textContent = sig.model || "BongLy-AI v2.4";
    $("#sigTf").textContent = sig.tf;
    $("#sigStrength").textContent = sig.strength + " conviction";
    $("#sigStrength").className = "badge " + (sig.strength === "strong" ? "badge-green" : sig.strength === "moderate" ? "badge-blue" : "badge-muted");
    $("#sigScore").textContent = "score " + sig.score + "/100";
    const st = BL.STATUS_META[sig.status] || BL.STATUS_META.watching;
    $("#sigStatus").textContent = st.icon + " " + st.label;
    $("#sigStatus").className = "badge " + st.cls;
    requestAnimationFrame(() => ($("#confFill").style.width = sig.confidence + "%"));

    const d = dec(sig.symbol);
    $("#lvEntry").textContent = sig.dir === 0 ? "—" : `${BL.fmt(sig.entryLow, d)} – ${BL.fmt(sig.entryHigh, d)}`;
    $("#lvStop").textContent = sig.stop == null ? "—" : BL.fmt(sig.stop, d);
    $("#lvT1").textContent = sig.targets[0] != null ? BL.fmt(sig.targets[0], d) : "—";
    $("#lvT2").textContent = sig.targets[1] != null ? BL.fmt(sig.targets[1], d) : "—";
    $("#lvT3").textContent = sig.targets[2] != null ? BL.fmt(sig.targets[2], d) : "—";
    $("#lvRr").textContent = sig.rr ? "1 : " + sig.rr : "—";

    $("#indList").innerHTML = sig.indicators
      .map(
        (i) => `<div class="ind-row">
          <span class="lbl">${i.label}</span>
          <span class="bar"><div style="width:${i.raw}%;background:${i.tone === "up" ? "var(--green)" : i.tone === "down" ? "var(--red)" : "var(--muted-2)"}"></div></span>
          <span class="val ${i.tone === "up" ? "up" : i.tone === "down" ? "down" : "muted"}">${i.value}</span>
          <span class="tiny muted" style="min-width:112px;text-align:right">${i.text}</span>
        </div>`
      )
      .join("");
    if (!animate) return;
  }

  function runAnalysis(symbol, animate) {
    const orb = $("#aiOrb");
    orb.classList.add("thinking");
    orb.textContent = "⏳";
    $("#verdictNote").textContent = "Scanning price action, momentum and news sentiment…";
    setTimeout(() => {
      const sig = BL.buildSignal(symbol, seriesMap[symbol], timeframe, me.id);
      BL.addSignal(sig);
      renderSignal(sig, true);
      orb.classList.remove("thinking");
      orb.textContent = sig.action.includes("BUY") ? "📈" : sig.action.includes("SELL") ? "📉" : "🤖";
      renderBoard();
      renderSignalStats();
      const st = BL.getSettings();
      if (sig.confidence >= st.minConf) BL.firePhoneAlert(sig);
      else BL.toast("Analysis complete", `${sig.action} ${sig.symbol} at ${sig.confidence}% — below your ${st.minConf}% alert threshold.`, "info");
      renderAlerts();
    }, animate ? 900 : 0);
  }

  $("#analyzeBtn").addEventListener("click", () => runAnalysis(current, true));
  $("#analyzeBtn2").addEventListener("click", () => {
    document.getElementById("sec-signal").scrollIntoView({ behavior: "smooth", block: "center" });
    runAnalysis(current, true);
  });

  $("#takeSignalBtn").addEventListener("click", () => {
    if (!currentSignal) return BL.toast("No signal yet", "Run an AI analysis first.", "warn");
    tradeSymbol.value = currentSignal.symbol;
    current = currentSignal.symbol;
    symbolSelect.value = current;
    setSide(currentSignal.action.includes("SELL") ? "sell" : "buy");
    renderChart();
    document.getElementById("sec-trade").scrollIntoView({ behavior: "smooth", block: "center" });
    BL.toast("Ticket prefilled", `${currentSignal.action} ${currentSignal.symbol} loaded into the trade panel.`, "buy");
  });

  $("#alertOnSignalBtn").addEventListener("click", () => BL.askPushPermission());

  /* ---------------- signal board + auto signal loop ---------------- */
  let boardFilter = "live";

  function renderBoard() {
    const all = BL.getSignals().filter((x) => x.uid === me.id);
    const live = (x) => x.status === "active" || x.status === "tp1" || x.status === "watching";
    const rows = (boardFilter === "live" ? all.filter(live) : boardFilter === "all" ? all : all.filter((x) => x.status === boardFilter)).slice(0, 12);
    const wrap = $("#boardTable");
    if (!rows.length) {
      wrap.innerHTML = `<div class="empty"><div class="ic">🗂️</div>No signals here yet — run an AI analysis to build a trade plan.</div>`;
      return;
    }
    wrap.innerHTML = `<table><thead><tr>
        <th>Symbol</th><th>TF</th><th>Signal</th><th>Conviction</th><th>Entry</th><th>Stop</th><th>TP1 / TP2 / TP3</th><th>R:R</th><th>Conf.</th><th>Status</th><th>P&L</th><th>Age</th>
      </tr></thead><tbody>
      ${rows.map((g) => {
        const d = dec(g.symbol);
        const st = BL.STATUS_META[g.status] || BL.STATUS_META.watching;
        const buy = g.action.includes("BUY");
        const pnlCls = (g.pnl || 0) >= 0 ? "up" : "down";
        return `<tr>
          <td><div class="pair-cell"><span class="pair-ico">${g.symbol.split("/")[0].slice(0, 4)}</span><b>${g.symbol}</b></div></td>
          <td class="tiny muted">${g.tf}</td>
          <td><span class="badge ${buy ? "badge-green" : g.action.includes("SELL") ? "badge-red" : "badge-amber"}">${g.action}</span></td>
          <td class="tiny muted">${g.strength}</td>
          <td class="mono tiny">${g.entryLow != null ? BL.fmt(g.entryLow, d) + " – " + BL.fmt(g.entryHigh, d) : "—"}</td>
          <td class="mono tiny down">${g.stop != null ? BL.fmt(g.stop, d) : "—"}</td>
          <td class="mono tiny">${g.targets.length ? g.targets.map((t) => BL.fmt(t, d)).join(" / ") : "—"}</td>
          <td class="mono tiny">${g.rr ? "1:" + g.rr : "—"}</td>
          <td><div class="flex items-center gap-8"><div style="width:44px;height:5px;border-radius:99px;background:var(--bg);overflow:hidden;border:1px solid var(--line-soft)"><div style="width:${g.confidence}%;height:100%;background:var(--grad)"></div></div><b class="mono tiny">${g.confidence}%</b></div></td>
          <td><span class="badge ${st.cls}">${st.icon} ${st.label}</span></td>
          <td class="mono tiny ${pnlCls}">${g.pnl ? BL.pct(g.pnl) : "—"}</td>
          <td class="tiny muted">${BL.timeAgo(g.createdAt)}</td>
        </tr>`;
      }).join("")}
      </tbody></table>`;
  }

  function renderSignalStats() {
    const st = BL.signalStats(me.id);
    const wr = $("#statWinRate");
    wr.textContent = st.winRate == null ? "—" : st.winRate + "%";
    wr.className = st.winRate == null ? "" : st.winRate >= 50 ? "up" : "down";
    $("#statWinSub").textContent = st.resolved
      ? `${st.won}W / ${st.lost}L of ${st.resolved} closed · ${st.active} live`
      : `${st.active} live · tracking outcomes`;
  }

  $$("#boardFilter button").forEach((b) =>
    b.addEventListener("click", () => {
      $$("#boardFilter button").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      boardFilter = b.dataset.f;
      renderBoard();
    })
  );

  /* auto signal loop — this is what triggers phone alerts */
  setInterval(() => {
    const sym = BL.MARKETS[Math.floor(Math.random() * BL.MARKETS.length)].sym;
    const sig = BL.buildSignal(sym, seriesMap[sym], timeframe, me.id);
    BL.addSignal(sig);
    const st = BL.getSettings();
    if (sig.confidence >= st.minConf) {
      BL.firePhoneAlert(sig);
      renderAlerts();
      if (sym === current) renderSignal(sig, true);
    }
    renderBoard();
    renderSignalStats();
  }, 15000);

  /* ---------------- trade panel ---------------- */
  let side = "buy";

  function setSide(s) {
    side = s;
    $("#buyTab").classList.toggle("active-buy", s === "buy");
    $("#sellTab").classList.toggle("active-sell", s === "sell");
    const btn = $("#placeOrderBtn");
    btn.className = "btn btn-block " + (s === "buy" ? "btn-buy" : "btn-sell");
    btn.textContent = s === "buy" ? "Place buy order" : "Place sell order";
    renderOrderSummary();
  }
  $("#buyTab").addEventListener("click", () => setSide("buy"));
  $("#sellTab").addEventListener("click", () => setSide("sell"));

  function lev() { return parseFloat($("#leverage").value) || 1; }
  function renderOrderSummary() {
    const sym = tradeSymbol.value;
    const qty = parseFloat($("#qty").value) || 0;
    const p = priceNow(sym);
    const value = p * qty;
    $("#sumType").textContent = "Market · " + (side === "buy" ? "Buy" : "Sell");
    $("#sumPrice").textContent = BL.fmt(p, dec(sym));
    $("#sumValue").textContent = BL.money(value);
    $("#sumMargin").textContent = BL.money(value / lev());
  }
  ["#qty", "#leverage", "#tradeSymbol"].forEach((s) => $(s).addEventListener("input", renderOrderSummary));
  $$(".amount-row button").forEach((b) =>
    b.addEventListener("click", () => {
      const pct = parseFloat(b.dataset.pct) / 100;
      const budget = (me.balance || 10000) * pct * lev();
      const p = priceNow(tradeSymbol.value);
      $("#qty").value = (budget / p).toFixed(4);
      renderOrderSummary();
    })
  );

  const positions = JSON.parse(localStorage.getItem(BL.LS.positions) || "[]");

  function savePositions() {
    localStorage.setItem(BL.LS.positions, JSON.stringify(positions.filter((p) => p.uid === me.id)));
  }

  function renderPositions() {
    const mine = positions.filter((p) => p.uid === me.id);
    $("#posCount").textContent = `${mine.length} open`;
    const wrap = $("#posTableWrap");
    if (!mine.length) {
      wrap.innerHTML = `<div class="empty"><div class="ic">📂</div>No open positions — place an order above or take an AI signal.</div>`;
    } else {
      wrap.innerHTML = `<table><thead><tr><th>Symbol</th><th>Side</th><th>Qty</th><th>Entry</th><th>Mark</th><th>P&amp;L</th><th></th></tr></thead><tbody>
        ${mine.map((p) => {
          const mark = priceNow(p.symbol);
          const pnl = (mark - p.entry) * p.qty * p.lev * (p.side === "buy" ? 1 : -1);
          return `<tr>
            <td><div class="pair-cell"><span class="pair-ico">${p.symbol.split("/")[0].slice(0, 4)}</span><b>${p.symbol}</b></div></td>
            <td><span class="badge ${p.side === "buy" ? "badge-green" : "badge-red"}">${p.side.toUpperCase()}</span></td>
            <td class="mono">${p.qty}</td>
            <td class="mono">${BL.fmt(p.entry, dec(p.symbol))}</td>
            <td class="mono">${BL.fmt(mark, dec(p.symbol))}</td>
            <td class="mono ${pnl >= 0 ? "up" : "down"}">${BL.money(pnl)}</td>
            <td><button class="btn btn-ghost btn-sm" data-close="${p.id}">Close</button></td>
          </tr>`;
        }).join("")}
      </tbody></table>`;
      $$("[data-close]").forEach((b) =>
        b.addEventListener("click", () => {
          const p = positions.find((x) => x.id === b.dataset.close);
          const mark = priceNow(p.symbol);
          const pnl = (mark - p.entry) * p.qty * p.lev * (p.side === "buy" ? 1 : -1);
          positions.splice(positions.indexOf(p), 1);
          savePositions();
          const users = BL.getUsers();
          const u = users.find((x) => x.id === me.id);
          u.balance = +(u.balance + pnl).toFixed(2);
          me.balance = u.balance;
          BL.saveUsers(users);
          renderPositions();
          renderStats();
          BL.toast("Position closed", `${p.symbol} closed at ${BL.fmt(mark, dec(p.symbol))} · realised ${BL.money(pnl)}`, pnl >= 0 ? "buy" : "sell");
        })
      );
    }
    // stats
    let pnl = 0;
    mine.forEach((p) => {
      const mark = priceNow(p.symbol);
      pnl += (mark - p.entry) * p.qty * p.lev * (p.side === "buy" ? 1 : -1);
    });
    $("#statPnl").textContent = BL.money(pnl);
    $("#statPnl").className = "mono " + (pnl >= 0 ? "up" : "down");
    $("#statPnlSub").textContent = `across ${mine.length} position${mine.length === 1 ? "" : "s"}`;
  }

  $("#placeOrderBtn").addEventListener("click", () => {
    const sym = tradeSymbol.value;
    const qty = parseFloat($("#qty").value);
    if (!qty || qty <= 0) return BL.toast("Invalid quantity", "Enter a quantity greater than zero.", "warn");
    const p = priceNow(sym);
    const margin = (p * qty) / lev();
    if (margin > (me.balance || 10000)) return BL.toast("Insufficient margin", "Reduce size, leverage or close a position.", "warn");
    positions.push({ id: "p_" + Date.now(), uid: me.id, symbol: sym, side, qty: +qty.toFixed(4), entry: p, lev: lev(), at: Date.now() });
    savePositions();
    renderPositions();
    renderOrderSummary();
    BL.toast("Order filled", `${side === "buy" ? "Bought" : "Sold"} ${qty} ${sym} @ ${BL.fmt(p, dec(sym))}`, side === "buy" ? "buy" : "sell");
    document.getElementById("sec-trade").scrollIntoView({ behavior: "smooth", block: "center" });
  });

  /* ---------------- alert settings ---------------- */
  let settings = BL.getSettings();
  $("#tgPush").checked = settings.push;
  $("#tgSound").checked = settings.sound;
  $("#tgVib").checked = settings.vibrate;
  $("#tgSms").checked = settings.sms;
  $("#confRange").value = settings.minConf;
  $("#confLabel").textContent = settings.minConf + "%";
  if (settings.phone) $("#phoneNum").value = settings.phone;

  function persistSettings() {
    settings = {
      push: $("#tgPush").checked,
      sound: $("#tgSound").checked,
      vibrate: $("#tgVib").checked,
      sms: $("#tgSms").checked,
      minConf: parseInt($("#confRange").value, 10),
      phone: $("#phoneNum").value.trim(),
    };
    BL.saveSettings(settings);
    $("#pushStatus").textContent = settings.push ? "enabled" : "off";
    $("#pushStatus").className = "badge " + (settings.push ? "badge-green" : "badge-muted");
    $("#alertBadge").textContent = settings.push ? "ON" : "OFF";
    $("#pushBtn").classList.toggle("hidden", settings.push || !("Notification" in window));
  }
  ["#tgPush", "#tgSound", "#tgVib", "#tgSms", "#confRange", "#phoneNum"].forEach((s) =>
    $(s).addEventListener("input", () => {
      if (s === "#confRange") $("#confLabel").textContent = $("#confRange").value + "%";
      persistSettings();
    })
  );
  $("#confRange").addEventListener("input", () => ($("#confLabel").textContent = $("#confRange").value + "%"));
  $("#enablePushBtn").addEventListener("click", async () => {
    const ok = await BL.askPushPermission();
    if (ok) { $("#tgPush").checked = true; persistSettings(); }
  });
  $("#pushBtn").addEventListener("click", () => $("#enablePushBtn").click());

  function testAlert() {
    const sig = { symbol: current, action: side === "buy" ? "BUY" : "SELL", price: priceNow(current), confidence: 92, note: "Test alert — this is how signals reach your phone." };
    BL.firePhoneAlert(sig);
    renderAlerts();
  }
  $("#testAlertBtn").addEventListener("click", testAlert);
  $("#testAlertBtn2").addEventListener("click", testAlert);

  function renderAlerts() {
    const list = BL.getAlerts();
    const log = $("#alertLog");
    $("#bellCount").textContent = list.length;
    $("#statAlerts").textContent = list.length + (me.alerts ? " / " + me.alerts : "");
    if (!list.length) {
      log.innerHTML = `<div class="empty"><div class="ic">🔔</div>No alerts yet — enable phone alerts or send a test.</div>`;
      return;
    }
    log.innerHTML = list
      .map(
        (a) => `<div class="alert-item">
        <span class="ic">${a.action.includes("BUY") ? "📈" : a.action.includes("SELL") ? "📉" : "🔔"}</span>
        <div class="grow"><b class="${a.action.includes("BUY") ? "up" : "down"}">${a.action} ${a.symbol}</b>
        <p>${BL.fmt(a.price, dec(a.symbol))} · ${a.confidence}% confidence</p></div>
        <span class="tiny muted">${BL.timeAgo(a.at)}</span>
      </div>`
      )
      .join("");
  }
  $("#clearAlerts").addEventListener("click", () => {
    localStorage.removeItem(BL.LS.alerts);
    renderAlerts();
    BL.toast("Alerts cleared", "The alert centre is now empty.", "info");
  });
  $("#bellBtn").addEventListener("click", () => {
    document.getElementById("sec-alerts").scrollIntoView({ behavior: "smooth" });
  });

  /* ---------------- news ---------------- */
  let newsFilter = "all";
  function renderNews() {
    const list = BL.NEWS.filter((n) => newsFilter === "all" || n.tone === newsFilter);
    $("#newsList").innerHTML =
      list
        .map(
          (n) => `<div class="news-item">
        <div class="news-ico ${n.tone}">${n.tone === "pos" ? "▲" : n.tone === "neg" ? "▼" : "◆"}</div>
        <div class="grow"><h4>${BL.esc(n.title)}</h4>
        <p><span class="badge badge-muted">${n.tag}</span><span>${n.src}</span><span>${n.mins}m ago</span></p></div>
      </div>`
        )
        .join("") || `<div class="empty"><div class="ic">📰</div>No headlines in this filter.</div>`;
  }
  $$("#newsFilter button").forEach((b) =>
    b.addEventListener("click", () => {
      $$("#newsFilter button").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      newsFilter = b.dataset.f;
      renderNews();
    })
  );

  /* ---------------- settings ---------------- */
  $("#saveSettingsBtn").addEventListener("click", () => {
    const users = BL.getUsers();
    const u = users.find((x) => x.id === me.id);
    u.name = $("#setName").value.trim() || u.name;
    BL.saveUsers(users);
    me.name = u.name;
    $("#sideName").textContent = u.name;
    $("#topName").textContent = u.name;
    $("#sideAvatar").textContent = u.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    $("#topAvatar").textContent = $("#sideAvatar").textContent;
    if ($("#setQty").value) $("#qty").value = $("#setQty").value;
    renderOrderSummary();
    BL.toast("Settings saved", "Your profile and default order size were updated.", "buy");
  });

  /* ---------------- sidebar / scrollspy ---------------- */
  const sidebar = $("#sidebar"), scrim = $("#scrim");
  $("#menuBtn").addEventListener("click", () => { sidebar.classList.add("open"); scrim.classList.add("show"); });
  scrim.addEventListener("click", () => { sidebar.classList.remove("open"); scrim.classList.remove("show"); });

  const links = $$(".side-link[href^='#']");
  links.forEach((l) =>
    l.addEventListener("click", (e) => {
      const id = l.getAttribute("href");
      const el = document.querySelector(id);
      if (el) { e.preventDefault(); el.scrollIntoView({ behavior: "smooth" }); }
      sidebar.classList.remove("open"); scrim.classList.remove("show");
    })
  );
  const spy = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          links.forEach((l) => l.classList.toggle("active", l.getAttribute("href") === "#" + en.target.id));
        }
      });
    },
    { rootMargin: "-25% 0px -65% 0px" }
  );
  $$("section[id^='sec-']").forEach((s) => spy.observe(s));

  /* ---------------- stats ---------------- */
  function renderStats() {
    $("#statBalance").textContent = BL.money(me.balance || 10000);
    const start = 10000;
    const chg = ((me.balance - start) / start) * 100;
    const el = $("#statBalanceChg");
    el.textContent = BL.pct(chg) + " vs deposit";
    el.className = chg >= 0 ? "up" : "down";
  }

  /* ---------------- boot ---------------- */
  function renderAll() {
    renderChart();
    renderOrderSummary();
    renderSignal(BL.buildSignal(current, visibleSeries(), timeframe, me.id), false);
  }
  renderAll();
  renderPositions();
  renderBoard();
  renderSignalStats();
  renderStats();
  renderAlerts();
  renderNews();
  persistSettings();

  // nudge the AI to produce a first live signal shortly after load
  setTimeout(() => runAnalysis(current, true), 1200);
})();
