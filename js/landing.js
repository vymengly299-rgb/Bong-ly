/* Landing page interactions: nav, ticker, hero chart, FAQ, counters */
(function () {
  "use strict";
  const { MARKETS, genSeries, Chart, fmt, esc } = window.BL;

  /* nav scroll state */
  const nav = document.querySelector(".nav");
  const onScroll = () => nav && nav.classList.toggle("scrolled", window.scrollY > 12);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* mobile nav */
  const burger = document.querySelector(".nav-burger");
  if (burger) {
    burger.addEventListener("click", () => {
      const links = document.querySelector(".nav-links");
      links.style.display = links.style.display === "flex" ? "" : "flex";
      links.style.flexDirection = "column";
      links.style.position = "absolute";
      links.style.top = "68px";
      links.style.left = "0";
      links.style.right = "0";
      links.style.background = "#0b1120";
      links.style.padding = "18px 24px";
      links.style.borderBottom = "1px solid var(--line)";
    });
  }

  /* live ticker */
  const ticker = document.querySelector(".ticker");
  if (ticker) {
    const items = [];
    MARKETS.forEach((m) => {
      const chg = (Math.random() - 0.45) * 4.2;
      items.push(`<div class="ticker-item"><span class="pair-ico" style="color:${m.color};border-color:${m.color}44;background:${m.color}18">${m.tag}</span><b>${m.sym}</b><span class="mono muted">${fmt(m.price, m.price < 10 ? 5 : 2)}</span><span class="chg ${chg >= 0 ? "up" : "down"}">${chg >= 0 ? "▲" : "▼"} ${Math.abs(chg).toFixed(2)}%</span></div>`);
    });
    ticker.innerHTML = items.join("") + items.join("");
    // gently nudge prices for a "live" feel
    setInterval(() => {
      ticker.querySelectorAll(".chg").forEach((el, i) => {
        const delta = (Math.random() - 0.5) * 0.12;
        const cur = parseFloat(el.textContent.replace(/[▼▲\s%]/g, "")) * (el.textContent.includes("▼") ? -1 : 1);
        const next = +(cur + delta).toFixed(2);
        el.className = "chg " + (next >= 0 ? "up" : "down");
        el.textContent = `${next >= 0 ? "▲" : "▼"} ${Math.abs(next).toFixed(2)}%`;
      });
    }, 2200);
  }

  /* hero sparkline chart */
  const heroCanvas = document.getElementById("heroChart");
  if (heroCanvas) {
    const series = genSeries("BTC/USDT", 90);
    BL.Chart.drawSpark(heroCanvas, series, series[series.length - 1].c >= series[0].c);
    let last = series[series.length - 1];
    setInterval(() => {
      const drift = last.c * 0.0009;
      last = { t: Date.now(), o: last.c, h: last.c + Math.random() * 20, l: last.c - Math.random() * 20, c: last.c + drift + (Math.random() - 0.5) * 40, v: 120 };
      series.push(last); series.shift();
      BL.Chart.drawSpark(heroCanvas, series, last.c >= series[0].c);
      const priceEl = document.getElementById("heroPrice");
      if (priceEl) priceEl.textContent = fmt(last.c, 2);
    }, 1500);
  }

  // redraw the hero sparkline on resize
  let rT;
  window.addEventListener("resize", () => {
    clearTimeout(rT);
    rT = setTimeout(() => {
      const c = document.getElementById("heroChart");
      if (c) BL.Chart.drawSpark(c, series, series[series.length - 1].c >= series[0].c);
    }, 120);
  });

  /* FAQ accordion */
  document.querySelectorAll(".faq-item").forEach((item) => {
    const q = item.querySelector(".faq-q");
    q.addEventListener("click", () => {
      const open = item.classList.contains("open");
      document.querySelectorAll(".faq-item.open").forEach((i) => i.classList.remove("open"));
      if (!open) item.classList.add("open");
    });
  });

  /* reveal on scroll */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.style.opacity = 1; e.target.style.transform = "none"; io.unobserve(e.target); } });
  }, { threshold: 0.12 });
  document.querySelectorAll("[data-reveal]").forEach((el, i) => {
    el.style.opacity = 0;
    el.style.transform = "translateY(22px)";
    el.style.transition = `opacity .55s ease ${i * 60}ms, transform .55s ease ${i * 60}ms`;
    io.observe(el);
  });

  /* year */
  document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
})();
