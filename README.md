# BongLy TradeAI — AI Trade Signals Platform

A complete, dependency-free **HTML / CSS / JavaScript** trading-signal website: AI signal engine, live candlestick charts, market news, one-click trading, phone alerts, a user dashboard and a full admin dashboard for creating and managing users.

Everything runs in the browser — no build step, no backend, no npm install. Data is persisted in `localStorage`.

---

## Pages

| File | Description |
|---|---|
| `index.html` | Landing page — hero with live chart, market ticker, features, how-it-works, platform preview, pricing, FAQ, footer |
| `login.html` | Sign in / create account (role-aware redirect to dashboard or admin) |
| `dashboard.html` | Trader dashboard — live chart, AI signal engine, trade panel, positions, news, phone-alert settings, alert centre |
| `admin.html` | Admin dashboard — stats, user CRUD (create / edit / suspend / delete), subscription breakdown, growth chart, activity log |

```
Bong-ly/
├── index.html          # landing page
├── login.html          # auth
├── dashboard.html      # user dashboard
├── admin.html          # admin dashboard
├── favicon.svg
├── css/
│   └── style.css       # full design system + responsive (phone) layout
└── js/
    ├── data.js         # shared data, storage, AI indicator engine, canvas chart engine, alerts
    ├── landing.js      # landing interactions
    ├── dashboard.js    # dashboard logic
    └── admin.js        # admin logic
```

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@bongly.io` | `admin123` |
| Trader | `user@bongly.io` | `user123` |

You can also create a new account from the sign-up form, and admins can create users from **Admin → Create user**.

## AI signal structure

Every analysis now produces a complete **trade plan**, not just a direction:

```js
{
  id, uid, symbol, tf,                 // "sig_x1", user, "BTC/USDT", "1H"
  action, strength, dir,               // STRONG BUY | BUY | HOLD | SELL | STRONG SELL + strong|moderate|neutral
  score, confidence,                   // 0-100 model score + confidence %
  entry, entryLow, entryHigh,          // entry zone (volatility based)
  stop,                                // stop loss
  targets: [tp1, tp2, tp3],            // three take-profit levels
  rr,                                  // risk : reward to TP2
  indicators: [{ label, value, raw, tone, text }],  // RSI, MACD, EMA, momentum, volume, news
  note, model,                         // rationale + model version
  createdAt, status, pnl               // lifecycle + live P&L from entry
}
```

**Lifecycle** (auto-resolved on every price tick): `watching -> active -> tp1 -> tp2 (target hit) | stopped (stopped out)`.
One live plan per symbol per user; the win rate is computed from real closed outcomes, not a static number.

Levels come from the mean candle range (ATR) of the last 14 bars:
`entry = price - 0.1*ATR`, `stop = price - 1.7*ATR`, `targets = price + 1.4 / 2.8 / 4.2*ATR` (mirrored for sells) -> headline **R:R about 1 : 1.6-1.8**.

Surfaces: **AI signal structure** card on the dashboard, the **AI signal board** table (live / all / won / lost), the **AI win rate** stat, and **Admin -> AI signal performance** (per-symbol win rate).

## Features

**AI signal engine** — scores RSI(14), MACD(12,26,9), EMA 9/21 trend, 10-candle momentum, relative volume and news sentiment into a 0–100 score, then maps it to `STRONG BUY / BUY / HOLD / SELL / STRONG SELL` with a confidence percentage and per-indicator breakdown.

**Charts** — hand-built canvas candlestick chart with volume profile, EMA-21 overlay, live last-price tag, crosshair OHLCV readout, timeframes (15m / 1H / 4H / 1D) and a live price engine that streams new candles.

**News** — sentiment-tagged headlines (bullish / bearish / neutral) with symbol tags and filters.

**Trading** — market buy/sell tickets with leverage, % size shortcuts, live order summary, margin checks, open-position table with real-time unrealised P&L, and one-click close that settles the realised P&L into the account balance.

**Phone alerts** — browser push notifications (`Notification` API, permission requested in-app), alert sound (WebAudio), haptic vibration (`navigator.vibrate`), in-app toasts, a minimum-confidence threshold, and a persistent alert centre. Signals are auto-generated every 15 s and alerted when they clear your threshold. The UI is fully responsive with a mobile bottom nav.

**Admin** — user statistics (total / active / suspended / MRR), searchable and filterable user table, create-user form with password generator, edit modal, suspend/activate, delete (with self-protection), JSON export, subscription breakdown, 7-month growth bar chart and a full admin activity log.

## Running it

Any static file server works, e.g.:

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

Or simply open `index.html` in a browser.

> Note: phone alerts require a secure context — `http://localhost` or any HTTPS host. Opening files via `file://` still works for everything else.

## Disclaimer

This is a front-end demo for educational purposes. Market data is simulated, and nothing here is financial advice.
