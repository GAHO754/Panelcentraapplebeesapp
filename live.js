(() => {
  const db = firebase.database();
  const auth = firebase.auth();
  const $ = (id) => document.getElementById(id);

  const ADMIN_GATE = false;

  async function requireAdmin(user) {
    if (!ADMIN_GATE) return true;
    if (!user) return false;
    const snap = await db.ref(`admins/${user.uid}`).once("value");
    return snap.exists() && snap.val() === true;
  }

  const statusChip = $("statusChip");
  const whoami = $("whoami");
  const storeFilter = $("storeFilter");
  const typeFilter = $("typeFilter");
  const q = $("q");
  const btnClear = $("btnClear");
  const btnToggleView = $("btnToggleView");
  const list = $("list");
  const tbody = $("tbody");
  const count = $("count");
  const tableWrap = $("tableWrap");

  const overlay = $("inspectorOverlay");
  const btnCloseIns = $("btnCloseIns");
  const btnRefreshIns = $("btnRefreshIns");
  const insTitle = $("insTitle");
  const insSub = $("insSub");
  const insMsg = $("insMsg");
  const pillUid = $("pillUid");
  const profileKV = $("profileKV");
  const sumSaldo = $("sumSaldo");
  const sumTickets = $("sumTickets");
  const sumCanjes = $("sumCanjes");
  const summaryCards = $("summaryCards");
  const ticketsList = $("ticketsList");
  const redsList = $("redsList");
  const limitsCards = $("limitsCards");
  const alertsList = $("alertsList");
  const alertsEmpty = $("alertsEmpty");
  const userHistoryList = $("userHistoryList");

  const LIMIT = 60;
  $("n").textContent = LIMIT;

  let cache = [];
  let viewMode = "cards";
  let liveRef = null;
  let INS = { uid: "", email: "" };

  function fmtTime(ms) {
    try {
      return new Date(ms || 0).toLocaleString("es-MX");
    } catch {
      return "";
    }
  }

  function money(n) {
    const v = Number(n || 0);
    return `$${v.toFixed(2)}`;
  }

  function safe(s) {
    return String(s || "").replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    }[m]));
  }

  function matchQuery(evt, query) {
    if (!query) return true;
    query = query.toLowerCase();
    const s = JSON.stringify(evt || {}).toLowerCase();
    return s.includes(query);
  }

  function statusClass(st) {
    st = String(st || "ok").toLowerCase();
    if (st === "ok") return "tag ok";
    if (st === "warn" || st === "warning") return "tag warn";
    return "tag err";
  }

  function eventMainUser(evt) {
    if (evt.uid || evt.userEmail) {
      return { uid: evt.uid || "", email: evt.userEmail || "" };
    }
    const cu = evt.redeem?.customerUid || evt.redeem?.userId || "";
    return { uid: cu, email: evt.customerEmail || "" };
  }

  function extractStore(evt) {
    return String(evt.storeId || evt.storeName || "").trim();
  }

  function upsertStoresFromCache() {
    const oficialStores = {
      "Torres": "Applebee's Torres",
      "Tecnologico": "Applebee's Tecnológico",
      "Paseo Triunfo": "Applebee's Paseo Triunfo"
    };

    const currentSelection = storeFilter.value;

    storeFilter.innerHTML =
      `<option value="">Todas las sucursales</option>` +
      Object.entries(oficialStores)
        .map(([id, nombre]) => `<option value="${safe(id)}">${safe(nombre)}</option>`)
        .join("");

    if (currentSelection && oficialStores[currentSelection]) {
      storeFilter.value = currentSelection;
    }
  }

  function render() {
    const t = typeFilter.value;
    const query = q.value.trim();
    const s = storeFilter.value;

    const filtered = cache
      .filter(e => !t || e.type === t)
      .filter(e => !s || extractStore(e) === s)
      .filter(e => matchQuery(e, query));

    count.textContent = filtered.length;

    if (viewMode === "cards") {
      tableWrap.style.display = "none";
      list.style.display = "grid";

      list.innerHTML = filtered.map(e => {
        const cls = statusClass(e.status);
        const title = `${e.type || "event"} • ${fmtTime(e.createdAt)}`;
        const email = e.userEmail || "";
        const uid = e.uid || "";
        const store = e.storeName || e.storeId || "";
        const folio = e.ticket?.folio || "";
        const total = (typeof e.ticket?.total === "number") ? e.ticket.total.toFixed(2) : "";
        const mesero = e.ticket?.mesero || "";
        const code = e.redeem?.code || e.code || "";
        const reward = e.redeem?.rewardName || e.redeem?.rewardId || "";
        const cost = Number.isFinite(Number(e.redeem?.cost)) ? money(e.redeem.cost) : "";
        const customerUid = e.redeem?.customerUid || "";

        const mainUser = eventMainUser(e);
        const inspectUid = mainUser.uid || customerUid || uid;
        const inspectEmail = mainUser.email || email;
        const reason = e.reason ? `• reason: ${safe(e.reason)}` : "";

        return `
          <div class="card evt">
            <div class="evt-top">
              <div class="row">
                <span class="${cls}">${safe(e.status || "ok")}</span>
                <strong>${safe(title)}</strong>
                <span class="muted">${safe(store)}</span>
                <span class="muted">${reason}</span>
              </div>
              <span class="muted mono">${safe(e._id || "")}</span>
            </div>

            <div class="row muted">
              <div><b>Email:</b> ${safe(inspectEmail || "—")}</div>
              <div><b>UID:</b> <span class="mono">${safe(inspectUid || "—")}</span></div>
            </div>

            <div class="row">
              ${folio ? `<span class="chip">Folio: <b>${safe(folio)}</b></span>` : ""}
              ${e.ticket?.fecha ? `<span class="chip">Fecha: <b>${safe(e.ticket.fecha)}</b></span>` : ""}
              ${total ? `<span class="chip">Total: <b>$${safe(total)}</b></span>` : ""}
              ${mesero ? `<span class="chip">Mesero: <b>${safe(mesero)}</b></span>` : ""}
              ${code ? `<span class="chip">Código: <b class="mono">${safe(code)}</b></span>` : ""}
              ${reward ? `<span class="chip">Reward: <b>${safe(reward)}</b></span>` : ""}
              ${cost ? `<span class="chip">Costo: <b>${safe(cost)}</b></span>` : ""}
            </div>

            <div class="row" style="justify-content:flex-end;">
              <button class="btn3" data-inspect="1" data-uid="${safe(inspectUid || "")}" data-email="${safe(inspectEmail || "")}" type="button">Inspeccionar</button>
            </div>
          </div>
        `;
      }).join("") || `<div class="card muted">Sin eventos.</div>`;
    } else {
      list.style.display = "none";
      tableWrap.style.display = "block";

      tbody.innerHTML = filtered.map(e => {
        const st = e.status || "ok";
        const cls = statusClass(st);
        const store = e.storeName || e.storeId || "";
        const mainUser = eventMainUser(e);
        const uid = mainUser.uid || e.uid || e.redeem?.customerUid || "";
        const email = mainUser.email || e.userEmail || "";

        const ticketLine = e.ticket?.folio
          ? `Folio ${safe(e.ticket.folio)} · ${safe(e.ticket.fecha || "")} · $${safe((e.ticket.total ?? "").toString())} · ${safe(e.ticket.mesero || "")}`
          : (e.redeem?.code ? `Cupón ${safe(e.redeem.code)} · ${safe(e.redeem.rewardName || e.redeem.rewardId || "")} · ${money(e.redeem.cost || 0)}` : "—");

        return `
          <tr>
            <td class="mono">${safe(fmtTime(e.createdAt))}</td>
            <td class="mono">${safe(e.type || "")}</td>
            <td>${safe(store)}</td>
            <td><span class="${cls}">${safe(st)}</span></td>
            <td>${safe(email || "—")}<br><span class="mono muted">${safe(uid || "—")}</span></td>
            <td>${ticketLine}</td>
            <td>
              <button class="btn3" data-inspect="1" data-uid="${safe(uid || "")}" data-email="${safe(email || "")}" type="button">Inspeccionar</button>
            </td>
          </tr>
        `;
      }).join("") || `<tr><td colspan="7" class="muted">Sin eventos.</td></tr>`;
    }
  }

  function setActiveTab(tabName) {
    document.querySelectorAll(".tab").forEach(tab => {
      tab.classList.toggle("active", tab.dataset.tab === tabName);
    });

    document.querySelectorAll("[id^='tab_']").forEach(panel => {
      panel.style.display = "none";
    });

    const current = document.getElementById(`tab_${tabName}`);
    if (current) current.style.display = "block";
  }

  function showOverlay() {
    overlay.style.display = "block";
    overlay.setAttribute("aria-hidden", "false");
  }

  function hideOverlay() {
    overlay.style.display = "none";
    overlay.setAttribute("aria-hidden", "true");
  }

  btnCloseIns.addEventListener("click", hideOverlay);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) hideOverlay();
  });
  document.addEventListener("keydown", (e) => {
    if (overlay.style.display === "block" && e.key === "Escape") hideOverlay();
  });

  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => setActiveTab(tab.dataset.tab));
  });

  function startEndOfToday() {
    const s = new Date();
    s.setHours(0, 0, 0, 0);
    const e = new Date();
    e.setHours(23, 59, 59, 999);
    return { start: s.getTime(), end: e.getTime() };
  }

  function normalizeTicketPoints(t) {
    const p1 = Number(t.points || 0);
    const p2 = Number(t.puntosTotal || 0);
    return [p1, p2].find(v => Number.isFinite(v) && v > 0) || 0;
  }

  async function resolveUidByEmail(email) {
    const em = String(email || "").trim().toLowerCase();
    if (!em) return "";
    const found = cache.find(e => String(e.userEmail || "").toLowerCase() === em && e.uid);
    return found?.uid || "";
  }

  async function loadUserHistory(uid) {
    userHistoryList.innerHTML = `<div class="muted">Cargando historial…</div>`;

    if (!uid) {
      userHistoryList.innerHTML = `<div class="muted">UID no disponible</div>`;
      return;
    }

    try {
      const snap = await firebase.database()
        .ref("liveEvents")
        .orderByChild("uid")
        .equalTo(uid)
        .limitToLast(25)
        .once("value");

      if (!snap.exists()) {
        userHistoryList.innerHTML = `<div class="muted">Sin eventos previos</div>`;
        return;
      }

      const rows = [];
      snap.forEach(s => rows.push({ id: s.key, ...s.val() }));
      rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      userHistoryList.innerHTML = rows.map(e => `
        <div class="miniCard">
          <div class="miniRow">
            <div>
              <b>${safe(e.type || "event")}</b>
              <div class="muted">${fmtTime(e.createdAt)}</div>
            </div>
            <span class="${statusClass(e.status)}">${safe(e.status || "ok")}</span>
          </div>
          <div class="muted">${safe(e.storeName || e.storeId || "—")}</div>
        </div>
      `).join("");
    } catch (err) {
      console.error(err);
      userHistoryList.innerHTML = `<div class="muted">Error cargando historial</div>`;
    }
  }

  function detectAlertsForUser(uid) {
    const now = Date.now();
    const FIVE_MIN = 5 * 60 * 1000;

    const events = cache.filter(e => (
      e.uid === uid || e.redeem?.customerUid === uid
    ));

    const alerts = [];

    const failedRedeems = events.filter(e =>
      (e.type === "redeem_failed" || e.type === "redeem_lookup_fail" || e.type === "ticket_blocked" || e.type === "scan_invalid_format") &&
      (now - (e.createdAt || 0)) <= FIVE_MIN
    );

    if (failedRedeems.length >= 3) {
      alerts.push({
        level: "warn",
        msg: `⚠️ ${failedRedeems.length} intentos fallidos en 5 minutos`
      });
    }

    const codes = {};
    events.forEach(e => {
      const c = e.redeem?.code;
      if (!c) return;
      codes[c] = (codes[c] || 0) + 1;
    });

    Object.entries(codes).forEach(([code, qty]) => {
      if (qty >= 2) {
        alerts.push({
          level: "err",
          msg: `🚫 Código ${code} usado ${qty} veces`
        });
      }
    });

    const scans = events.filter(e =>
      String(e.type || "").includes("scan") &&
      (now - (e.createdAt || 0)) <= FIVE_MIN
    );

    if (scans.length >= 6) {
      alerts.push({
        level: "warn",
        msg: `🧪 ${scans.length} escaneos en 5 minutos`
      });
    }

    return alerts;
  }

  async function renderAlertsForUser(uid) {
    alertsList.innerHTML = "";
    alertsEmpty.style.display = "block";

    if (!uid) return;

    let hasAlerts = false;
    const localAlerts = detectAlertsForUser(uid);

    if (localAlerts.length) {
      hasAlerts = true;
      alertsEmpty.style.display = "none";

      alertsList.innerHTML += localAlerts.map(a => `
        <div class="miniCard">
          <span class="tag ${a.level === "err" ? "err" : "warn"}">${safe(a.level.toUpperCase())}</span>
          <div style="margin-top:6px">${safe(a.msg)}</div>
        </div>
      `).join("");
    }

    try {
      const snap = await db.ref("alerts").orderByChild("uid").equalTo(uid).limitToLast(10).once("value");

      if (snap.exists()) {
        hasAlerts = true;
        alertsEmpty.style.display = "none";

        const items = Object.entries(snap.val())
          .map(([id, a]) => ({ _id: id, ...a }))
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        alertsList.innerHTML += items.map(a => {
          const lvl = String(a.level || a.severity || "warn").toLowerCase();
          const cls = lvl === "err" || lvl === "high" ? "err" : (lvl === "ok" ? "ok" : "warn");
          const icon = cls === "err" ? "⛔" : (cls === "ok" ? "✅" : "⚠️");

          return `
            <div class="miniCard">
              <div style="display:flex; gap:10px; align-items:center;">
                <span>${icon}</span>
                <strong>${safe(a.title || a.type || "Alerta de Sistema")}</strong>
              </div>
              <div class="muted" style="margin-top:5px;">${safe(a.message || "")}</div>
              <div class="muted mono" style="font-size:10px;">${fmtTime(a.createdAt)}</div>
            </div>
          `;
        }).join("");
      }
    } catch (err) {
      console.error("Error cargando alertas históricas:", err);
    }

    if (!hasAlerts) {
      alertsEmpty.style.display = "block";
    }
  }

  async function loadInspector(uid, email) {
    INS.uid = uid || "";
    INS.email = email || "";

    insMsg.textContent = "Cargando…";
    profileKV.innerHTML = "";
    ticketsList.innerHTML = "";
    redsList.innerHTML = "";
    summaryCards.innerHTML = "";
    limitsCards.innerHTML = "";
    alertsList.innerHTML = "";
    alertsEmpty.style.display = "none";

    if (!INS.uid && INS.email) {
      INS.uid = await resolveUidByEmail(INS.email);
    }

    if (!INS.uid) {
      insTitle.textContent = "Inspector";
      insSub.textContent = "No se pudo resolver UID (faltan datos en evento).";
      pillUid.textContent = "UID: —";
      insMsg.textContent = "Tip: asegúrate de que tus eventos tengan uid y userEmail.";
      return;
    }

    insTitle.textContent = "Inspector de cliente";
    insSub.textContent = INS.email ? `Email: ${INS.email}` : "Email: —";
    pillUid.textContent = `UID: ${INS.uid}`;

    try {
      const userSnap = await db.ref(`users/${INS.uid}`).once("value");
      const userObj = userSnap.exists() ? (userSnap.val() || {}) : {};

      const tSnap = await db.ref(`users/${INS.uid}/tickets`).limitToLast(200).once("value");
      const tObj = tSnap.exists() ? (tSnap.val() || {}) : {};
      const tickets = Object.values(tObj).map(t => ({
        folio: t.folio || "",
        fecha: t.fecha || "",
        total: Number(t.total || 0),
        mesero: t.mesero || "",
        points: normalizeTicketPoints(t),
        vence: Number(t.vencePuntos || 0),
        createdAt: Number(t.createdAt || 0),
        id: t.id || ""
      })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      const rSnap = await db.ref(`users/${INS.uid}/redemptions`).limitToLast(200).once("value");
      const rObj = rSnap.exists() ? (rSnap.val() || {}) : {};
      const reds = Object.keys(rObj).map(code => ({ code, ...rObj[code] }))
        .map(r => ({
          code: r.code,
          rewardName: r.rewardName || r.rewardId || "",
          rewardId: r.rewardId || "",
          cost: Number(r.cost || 0),
          status: String(r.status || ""),
          createdAt: Number(r.createdAt || 0),
          expiresAt: Number(r.expiresAt || 0),
          redeemedAt: Number(r.redeemedAt || 0),
          redeemedBy: r.redeemedBy || "",
          note: r.note || ""
        }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      const pSnap = await db.ref(`users/${INS.uid}/points`).once("value");
      const pointsNode = pSnap.exists() ? Number(pSnap.val() || 0) : 0;

      const now = Date.now();

      const spent = reds
        .filter(r => ["canjeado", "redeemed", "usado", "consumido"].includes(String(r.status || "").toLowerCase()))
        .reduce((a, r) => a + (Number(r.cost) || 0), 0);

      const reserved = reds
        .filter(r => ["pendiente", "pending"].includes(String(r.status || "").toLowerCase()))
        .filter(r => !r.expiresAt || r.expiresAt > now)
        .reduce((a, r) => a + (Number(r.cost) || 0), 0);

      let activeEarned = 0;
      let expSoon = [];

      tickets.forEach(t => {
        const pts = Number(t.points || 0);
        if (!pts) return;
        const vence = Number(t.vence || 0);
        const active = !vence || vence >= now;

        if (active) {
          activeEarned += pts;
          if (vence) {
            const left = Math.ceil((vence - now) / 86400000);
            if (left <= 14) expSoon.push({ pts, left });
          }
        }
      });

      const calculatedAvailable = Math.max(0, activeEarned - spent - reserved);
      const displayPoints = (pointsNode === 0 && calculatedAvailable > 0) ? calculatedAvailable : pointsNode;

      if (Math.abs(pointsNode - calculatedAvailable) > 0.1) {
        insMsg.innerHTML = `<span class="tag warn">⚠️ Saldo desfasado: DB ${money(pointsNode)} | Calc ${money(calculatedAvailable)}</span>`;
      } else {
        insMsg.textContent = "Listo.";
      }

      const name = userObj.name || userObj.nombre || "";
      const phone = userObj.phone || userObj.telefono || "";
      const createdAt = userObj.createdAt || userObj.created || "";
      const lastLogin = userObj.lastLogin || userObj.lastSeen || "";

      const profileRows = [
        ["Nombre", name || "—"],
        ["Email", INS.email || userObj.email || "—"],
        ["Teléfono", phone || "—"],
        ["Registrado", createdAt ? fmtTime(createdAt) : "—"],
        ["Última actividad", lastLogin ? fmtTime(lastLogin) : "—"],
        ["Points node", money(pointsNode)],
        ["Saldo calc.", money(calculatedAvailable)],
        ["Reservado", money(reserved)],
        ["Gastado", money(spent)]
      ];

      profileKV.innerHTML = profileRows.map(([k, v]) => `
        <div class="k">${safe(k)}</div><div class="v"><b>${safe(v)}</b></div>
      `).join("");

      sumSaldo.textContent = money(displayPoints);
      sumTickets.textContent = String(tickets.length);
      sumCanjes.textContent = String(reds.length);

      summaryCards.innerHTML = `
        <div class="miniCard">
          <div class="miniRow">
            <strong>Disponibles (calc)</strong>
            <span class="pill">${money(calculatedAvailable)}</span>
          </div>
          <div class="muted">Calculado con tickets activos − canjes (gastado/reservado).</div>
        </div>

        <div class="miniCard">
          <div class="miniRow">
            <strong>Vencimientos próximos</strong>
            <span class="pill">${expSoon.length ? `${expSoon.length} ticket(s)` : "—"}</span>
          </div>
          <div class="muted">${
            expSoon.length
              ? `${money(expSoon.reduce((a, x) => a + x.pts, 0))} por vencer en ~${Math.min(...expSoon.map(x => x.left))} día(s).`
              : "Sin vencimientos cercanos."
          }</div>
        </div>

        <div class="miniCard">
          <div class="miniRow">
            <strong>Canjes pendientes</strong>
            <span class="pill">${money(reserved)}</span>
          </div>
          <div class="muted">Pendientes no expirados.</div>
        </div>
      `;

      ticketsList.innerHTML = tickets.length ? tickets.map(t => `
        <div class="miniCard" data-ticket-id="${safe(t.id || t.folio)}">
          <div class="miniRow">
            <strong>Folio ${safe(t.folio || "—")}</strong>
            <span class="pill">${money(t.points || 0)} (5%)</span>
          </div>
          <div class="row muted">
            <span class="chip">Fecha ticket: <b>${safe(t.fecha || "—")}</b></span>
            <span class="chip">Total: <b>${money(t.total || 0)}</b></span>
            <span class="chip">Mesero: <b>${safe(t.mesero || "—")}</b></span>
            <span class="chip">Escaneado: <b>${t.createdAt ? fmtTime(t.createdAt) : "—"}</b></span>
          </div>
          <div class="muted">Vence: <b>${t.vence ? fmtTime(t.vence) : "—"}</b></div>
        </div>
      `).join("") : `<div class="miniCard muted">Sin tickets.</div>`;

      redsList.innerHTML = reds.length ? reds.map(r => {
        const st = String(r.status || "").toLowerCase();
        const cls = st.includes("pend") ? "tag warn" : (st.includes("canj") || st.includes("redeem")) ? "tag ok" : "tag err";

        return `
          <div class="miniCard" data-redeem-id="${safe(r.code || "")}">
            <div class="miniRow">
              <strong>${safe(r.rewardName || "Cortesía")}</strong>
              <span class="${cls}">${safe(r.status || "—")}</span>
            </div>
            <div class="row muted">
              <span class="chip">Código: <b class="mono">${safe(r.code || "")}</b></span>
              <span class="chip">Costo: <b>${money(r.cost || 0)}</b></span>
              <span class="chip">Creado: <b>${r.createdAt ? fmtTime(r.createdAt) : "—"}</b></span>
              <span class="chip">Expira: <b>${r.expiresAt ? fmtTime(r.expiresAt) : "—"}</b></span>
            </div>
            <div class="muted">Canjeado: <b>${r.redeemedAt ? fmtTime(r.redeemedAt) : "—"}</b> • Por: <b class="mono">${safe(r.redeemedBy || "—")}</b></div>
            ${r.note ? `<div class="muted">Nota: <b>${safe(r.note)}</b></div>` : ""}
          </div>
        `;
      }).join("") : `<div class="miniCard muted">Sin canjes.</div>`;

      const { start, end } = startEndOfToday();
      const ticketsToday = tickets.filter(t => t.createdAt >= start && t.createdAt <= end).length;
      const dayLimit = 2;
      const within = ticketsToday <= dayLimit;

      limitsCards.innerHTML = `
        <div class="miniCard">
          <div class="miniRow">
            <strong>Límite de tickets hoy</strong>
            <span class="${within ? "tag ok" : "tag err"}">${within ? "OK" : "EXCEDIDO"}</span>
          </div>
          <div class="muted">Hoy: <b>${ticketsToday}</b> / Límite: <b>${dayLimit}</b></div>
        </div>

        <div class="miniCard">
          <div class="miniRow">
            <strong>Saldo (node)</strong>
            <span class="pill">${money(pointsNode)}</span>
          </div>
          <div class="muted">Este es el valor real que usa tu app en /users/{uid}/points.</div>
        </div>

        <div class="miniCard">
          <div class="miniRow">
            <strong>Saldo (calc)</strong>
            <span class="pill">${money(calculatedAvailable)}</span>
          </div>
          <div class="muted">Sirve para auditoría (tickets activos − canjes).</div>
        </div>
      `;

      await renderAlertsForUser(INS.uid);
      await loadUserHistory(INS.uid);
    } catch (err) {
      console.error(err);
      insMsg.textContent = "Error cargando inspector: " + (err?.message || err);
    }
  }

  function openInspector(uid, email) {
    showOverlay();
    setActiveTab("profile");
    loadInspector(uid, email);
  }

  btnRefreshIns.addEventListener("click", () => {
    if (!INS?.uid) return;
    loadInspector(INS.uid, INS.email);
  });

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-inspect='1']");
    if (!btn) return;

    const uid = btn.getAttribute("data-uid") || "";
    const email = btn.getAttribute("data-email") || "";
    openInspector(uid, email);
  });

  alertsList.addEventListener("click", (e) => {
    const card = e.target.closest(".alertCard");
    if (!card) return;

    const ticketId = card.dataset.ticket;
    const redeemId = card.dataset.redeem;

    if (ticketId) {
      const el = document.querySelector(`[data-ticket-id="${ticketId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("highlight");
        setTimeout(() => el.classList.remove("highlight"), 2000);
      }
    }

    if (redeemId) {
      const el = document.querySelector(`[data-redeem-id="${redeemId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("highlight");
        setTimeout(() => el.classList.remove("highlight"), 2000);
      }
    }
  });

  storeFilter.addEventListener("change", render);
  typeFilter.addEventListener("change", render);
  q.addEventListener("input", render);

  btnClear.addEventListener("click", () => {
    storeFilter.value = "";
    typeFilter.value = "";
    q.value = "";
    render();
  });

  btnToggleView.addEventListener("click", () => {
    viewMode = (viewMode === "cards") ? "table" : "cards";
    btnToggleView.textContent = "Vista: " + (viewMode === "cards" ? "Tarjetas" : "Tabla");
    render();
  });

  async function startLive(user) {
    if (liveRef) liveRef.off();

    liveRef = db.ref("liveEvents").orderByChild("createdAt").limitToLast(LIMIT);

    statusChip.textContent = "Conectando…";
    statusChip.style.background = "rgba(255,255,255,.06)";

    liveRef.on("value", (snap) => {
      const v = snap.val() || {};
      cache = Object.entries(v)
        .map(([id, obj]) => ({ _id: id, ...obj }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      statusChip.textContent = "🟢 En vivo";
      whoami.textContent = `Admin: ${user.email || "—"}`;
      upsertStoresFromCache();
      render();
    }, (error) => {
      console.error("Error RTDB:", error);
      statusChip.textContent = "🔴 Error de Acceso";
    });
  }

  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = "admin-login.html";
      return;
    }

    const ok = await requireAdmin(user);
    if (!ok) {
      alert("No tienes permisos para acceder a este panel.");
      await auth.signOut();
      window.location.href = "admin-login.html";
      return;
    }

    await startLive(user);
  });
})();
