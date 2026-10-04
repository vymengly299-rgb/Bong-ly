/* ============================================================
   BongLy TradeAI — Admin dashboard logic (user management)
   ============================================================ */
(function () {
  "use strict";
  const BL = window.BL;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  const me = BL.requireAuth(["admin"]);
  if (!me) return;

  const PLAN_PRICE = { Starter: 0, Pro: 39, Elite: 99 };
  let filter = { q: "", role: "all", status: "all" };
  let editingId = null;

  /* ---------------- header ---------------- */
  const initials = me.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  $("#sideAvatar").textContent = initials;
  $("#topAvatar").textContent = initials;
  $("#sideName").textContent = me.name;
  $("#topName").textContent = me.name;
  $("#topEmail").textContent = me.email;
  $("#logoutBtn").addEventListener("click", () => {
    BL.clearSession();
    BL.toast("Signed out", "Admin session ended.", "info");
    setTimeout(() => (location.href = "login.html"), 500);
  });
  setInterval(() => ($("#clockNow").textContent = new Date().toLocaleString("en-GB")), 1000);
  $("#clockNow").textContent = new Date().toLocaleString("en-GB");

  /* ---------------- stats ---------------- */
  function renderStats() {
    const users = BL.getUsers();
    const active = users.filter((u) => u.status === "active").length;
    const susp = users.length - active;
    const mrr = users.filter((u) => u.status === "active").reduce((a, u) => a + (PLAN_PRICE[u.plan] || 0), 0);
    $("#statUsers").textContent = users.length;
    $("#statActive").textContent = active;
    $("#statSusp").textContent = susp + " suspended";
    $("#statAlerts").textContent = BL.getUsers().reduce((a, u) => a + (u.alerts || 0), 0);
    $("#statMrr").textContent = "$" + mrr.toLocaleString("en-US");
    const thisMonth = users.filter((u) => u.created && u.created.slice(0, 7) === new Date().toISOString().slice(0, 7)).length;
    $("#statUsersSub").textContent = `+${thisMonth} this month`;

    // plans table
    const plans = {};
    users.forEach((u) => {
      plans[u.plan] = plans[u.plan] || { n: 0, rev: 0 };
      plans[u.plan].n++;
      plans[u.plan].rev += PLAN_PRICE[u.plan] || 0;
    });
    $("#plansTable").innerHTML = `<table><thead><tr><th>Plan</th><th>Price</th><th>Users</th><th>MRR</th><th>Share</th></tr></thead><tbody>
      ${Object.keys(PLAN_PRICE).map((p) => {
        const d = plans[p] || { n: 0, rev: 0 };
        const share = users.length ? Math.round((d.n / users.length) * 100) : 0;
        return `<tr>
          <td><b>${p}</b></td>
          <td class="mono">$${PLAN_PRICE[p]}</td>
          <td class="mono">${d.n}</td>
          <td class="mono">$${d.rev.toLocaleString("en-US")}</td>
          <td><div class="flex items-center gap-8"><div style="width:80px;height:5px;border-radius:99px;background:var(--bg);overflow:hidden;border:1px solid var(--line-soft)"><div style="width:${share}%;height:100%;background:var(--grad)"></div></div><b class="mono tiny">${share}%</b></div></td>
        </tr>`;
      }).join("")}
    </tbody></table>`;

    // growth chart from created dates by month
    const months = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7);
      months.push({ key, label: d.toLocaleDateString("en-GB", { month: "short" }), n: users.filter((u) => (u.created || "").slice(0, 7) === key).length });
    }
    BL.Chart.drawBars($("#growthChart"), months.map((m) => m.label), months.map((m) => m.n));
  }

  /* ---------------- users table ---------------- */
  function renderUsers() {
    const users = BL.getUsers().filter((u) => {
      const q = filter.q.toLowerCase();
      const okQ = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.plan || "").toLowerCase().includes(q);
      const okR = filter.role === "all" || u.role === filter.role;
      const okS = filter.status === "all" || u.status === filter.status;
      return okQ && okR && okS;
    });

    const wrap = $("#usersTable");
    if (!users.length) {
      wrap.innerHTML = `<div class="empty"><div class="ic">👥</div>No users match your filters.</div>`;
      return;
    }
    wrap.innerHTML = `<table><thead><tr>
        <th>User</th><th>Role</th><th>Plan</th><th>Balance</th><th>Alerts</th><th>Joined</th><th>Status</th><th>Actions</th>
      </tr></thead><tbody>
      ${users.map((u) => `<tr>
        <td><div class="pair-cell"><span class="pair-ico" style="background:${u.role === "admin" ? "rgba(139,92,246,.14)" : "rgba(79,140,255,.12)"};color:${u.role === "admin" ? "#c4b0ff" : "#9dc0ff"}">${u.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</span>
          <div><b style="font-size:13px">${BL.esc(u.name)}</b><br><span class="tiny muted">${BL.esc(u.email)}</span></div></div></td>
        <td><span class="badge ${u.role === "admin" ? "badge-violet" : "badge-blue"}">${u.role}</span></td>
        <td><span class="badge ${u.plan === "Elite" ? "badge-amber" : u.plan === "Pro" ? "badge-green" : "badge-muted"}">${u.plan}</span></td>
        <td class="mono">${BL.money(u.balance || 0)}</td>
        <td class="mono">${u.alerts || 0}</td>
        <td class="muted tiny">${u.created || "—"}</td>
        <td><span class="status-dot ${u.status === "active" ? "on" : "off"}">${u.status}</span></td>
        <td><div class="row-actions">
          <button class="btn btn-ghost btn-sm" data-edit="${u.id}">Edit</button>
          <button class="btn btn-ghost btn-sm" data-toggle="${u.id}">${u.status === "active" ? "Suspend" : "Activate"}</button>
          <button class="btn btn-ghost btn-sm" data-del="${u.id}" style="color:var(--red)">Delete</button>
        </div></td>
      </tr>`).join("")}
      </tbody></table>`;

    $$("[data-edit]").forEach((b) => b.addEventListener("click", () => openEdit(b.dataset.edit)));
    $$("[data-toggle]").forEach((b) =>
      b.addEventListener("click", () => {
        const users = BL.getUsers();
        const u = users.find((x) => x.id === b.dataset.toggle);
        u.status = u.status === "active" ? "suspended" : "active";
        BL.saveUsers(users);
        BL.addLog(u.status === "active" ? "User activated" : "User suspended", u.email);
        renderUsers(); renderStats(); renderLogs();
        BL.toast("User updated", `${u.name} is now ${u.status}.`, u.status === "active" ? "buy" : "warn");
      })
    );
    $$("[data-del]").forEach((b) =>
      b.addEventListener("click", () => {
        const users = BL.getUsers();
        const u = users.find((x) => x.id === b.dataset.del);
        if (u.id === me.id) return BL.toast("Action blocked", "You cannot delete your own admin account.", "warn");
        if (!confirm(`Delete ${u.name} (${u.email})? This cannot be undone.`)) return;
        BL.saveUsers(users.filter((x) => x.id !== u.id));
        BL.addLog("User deleted", u.email);
        renderUsers(); renderStats(); renderLogs();
        BL.toast("User deleted", `${u.name} has been removed.`, "sell");
      })
    );
  }

  /* ---------------- filters ---------------- */
  $("#adminSearch").addEventListener("input", (e) => { filter.q = e.target.value; renderUsers(); });
  $$("#roleFilter button").forEach((b) =>
    b.addEventListener("click", () => {
      $$("#roleFilter button").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      filter.role = b.dataset.r;
      renderUsers();
    })
  );
  $("#statusFilter").addEventListener("change", (e) => { filter.status = e.target.value; renderUsers(); });

  /* ---------------- create user ---------------- */
  $("#createUserForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("#cu-name").value.trim();
    const email = $("#cu-email").value.trim();
    const p1 = $("#cu-pass").value;
    const p2 = $("#cu-pass2").value;
    if (!name || !email || !p1) return BL.toast("Missing details", "Name, email and password are required.", "warn");
    if (p1.length < 6) return BL.toast("Weak password", "Use at least 6 characters.", "warn");
    if (p1 !== p2) return BL.toast("Passwords differ", "Make sure both passwords match.", "warn");
    const users = BL.getUsers();
    if (users.some((u) => u.email.toLowerCase() === email.toLowerCase()))
      return BL.toast("Email taken", "Another account already uses that email.", "warn");

    const user = {
      id: "u_" + Date.now().toString(36),
      name, email, pass: p1,
      role: $("#cu-role").value,
      plan: $("#cu-plan").value,
      status: $("#cu-status").value,
      balance: parseFloat($("#cu-balance").value) || 0,
      created: BL.dateStr(Date.now()),
      alerts: 0,
    };
    users.push(user);
    BL.saveUsers(users);
    BL.addLog("User created", `${user.email} · ${user.role} · ${user.plan}`);
    renderUsers(); renderStats(); renderLogs();
    e.target.reset();
    $("#cu-balance").value = 10000;
    BL.toast("User created ✅", `${name} (${email}) can now sign in.`, "buy");
    document.getElementById("sec-users").scrollIntoView({ behavior: "smooth" });
  });

  $("#genPassBtn").addEventListener("click", () => {
    const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#";
    let p = "";
    for (let i = 0; i < 10; i++) p += chars[Math.floor(Math.random() * chars.length)];
    $("#cu-pass").value = p;
    $("#cu-pass2").value = p;
    BL.toast("Password generated", "A strong password was filled in for you.", "info");
  });

  $("#newUserBtn").addEventListener("click", () => {
    document.getElementById("sec-create").scrollIntoView({ behavior: "smooth" });
  });

  /* ---------------- edit modal ---------------- */
  function openEdit(id) {
    const u = BL.getUsers().find((x) => x.id === id);
    if (!u) return;
    editingId = id;
    $("#ed-name").value = u.name;
    $("#ed-email").value = u.email;
    $("#ed-pass").value = u.pass;
    $("#ed-role").value = u.role;
    $("#ed-plan").value = u.plan;
    $("#ed-balance").value = u.balance;
    $("#ed-status").value = u.status;
    $("#editModal").classList.add("show");
  }
  const closeModal = () => { $("#editModal").classList.remove("show"); editingId = null; };
  $("#closeModal").addEventListener("click", closeModal);
  $("#cancelModal").addEventListener("click", closeModal);
  $("#editModal").addEventListener("click", (e) => { if (e.target.id === "editModal") closeModal(); });

  $("#saveUserBtn").addEventListener("click", () => {
    if (!editingId) return;
    const users = BL.getUsers();
    const u = users.find((x) => x.id === editingId);
    const email = $("#ed-email").value.trim();
    if (!email) return BL.toast("Invalid email", "Email cannot be empty.", "warn");
    if (users.some((x) => x.id !== editingId && x.email.toLowerCase() === email.toLowerCase()))
      return BL.toast("Email taken", "Another account already uses that email.", "warn");
    u.name = $("#ed-name").value.trim() || u.name;
    u.email = email;
    u.pass = $("#ed-pass").value || u.pass;
    u.role = $("#ed-role").value;
    u.plan = $("#ed-plan").value;
    u.balance = parseFloat($("#ed-balance").value) || 0;
    u.status = $("#ed-status").value;
    BL.saveUsers(users);
    BL.addLog("User updated", `${u.email} · ${u.role} · ${u.plan} · ${u.status}`);
    closeModal(); renderUsers(); renderStats(); renderLogs();
    BL.toast("Changes saved", `${u.name} was updated.`, "buy");
  });

  /* ---------------- logs ---------------- */
  function renderLogs() {
    const logs = BL.getLogs();
    const el = $("#logList");
    if (!logs.length) {
      el.innerHTML = `<div class="empty"><div class="ic">🧾</div>No admin activity recorded yet.</div>`;
      return;
    }
    el.innerHTML = logs
      .map(
        (l) => `<div class="alert-item">
        <span class="ic">🧾</span>
        <div class="grow"><b>${BL.esc(l.action)}</b><p>${BL.esc(l.detail)}</p></div>
        <div style="text-align:right"><span class="tiny muted">${BL.timeAgo(l.at)}</span><br><span class="tiny muted-2" style="font-size:10.5px">${BL.esc(l.by)}</span></div>
      </div>`
      )
      .join("");
  }
  $("#clearLogs").addEventListener("click", () => {
    localStorage.removeItem(BL.LS.logs);
    renderLogs();
    BL.toast("Log cleared", "Admin activity log emptied.", "info");
  });

  /* ---------------- export ---------------- */
  $("#exportBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(BL.getUsers(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "bongly-users.json";
    a.click();
    URL.revokeObjectURL(a.href);
    BL.addLog("Users exported", BL.getUsers().length + " records");
    renderLogs();
    BL.toast("Export ready", "bongly-users.json downloaded.", "buy");
  });

  /* ---------------- sidebar / scrollspy ---------------- */
  const sidebar = $("#sidebar"), scrim = $("#scrim");
  $("#menuBtn").addEventListener("click", () => { sidebar.classList.add("open"); scrim.classList.add("show"); });
  scrim.addEventListener("click", () => { sidebar.classList.remove("open"); scrim.classList.remove("show"); });
  const links = $$(".side-link[href^='#']");
  links.forEach((l) =>
    l.addEventListener("click", (e) => {
      const el = document.querySelector(l.getAttribute("href"));
      if (el) { e.preventDefault(); el.scrollIntoView({ behavior: "smooth" }); }
      sidebar.classList.remove("open"); scrim.classList.remove("show");
    })
  );
  const spy = new IntersectionObserver(
    (entries) => entries.forEach((en) => { if (en.isIntersecting) links.forEach((l) => l.classList.toggle("active", l.getAttribute("href") === "#" + en.target.id)); }),
    { rootMargin: "-25% 0px -65% 0px" }
  );
  $$("section[id^='sec-']").forEach((s) => spy.observe(s));

  /* ---------------- boot ---------------- */
  renderUsers();
  renderStats();
  renderLogs();
})();
