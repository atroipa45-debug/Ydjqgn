/* CHOST dashboard add-on
   1) Sidebar = exactly: Dashboard, Users, پنل نمایندگی (owner), API Keys, Templates, Bulk Actions, Settings.
      Everything else (Nodes, Hosts, Cores, Admins, Groups, Roles, Statistics...) is hidden for everyone.
   2) "API Keys" page: 5-minute owner key.
   3) "Settings" page: change the panel password (owner and resellers, each for their own account).
   4) Sidebar "پنل نمایندگی" (owner only): a native-looking page to create and manage reseller panels.
   6) Settings page "ربات فروش": Telegram sales bot token, admin IDs, status and sales numbers.
   5) Login page "Owner access": reset the owner login with a CHOST owner key (CH-XXXX-XXXX-XXXX). */
(function () {
  "use strict";
  var ZWNJ = String.fromCharCode(8204);
  function norm(t) { return String(t || "").split(ZWNJ).join(" ").replace(/[0-9۰-۹]+/g, "").replace(/\s+/g, " ").trim().toLowerCase(); }

  /* ---------- 1) sidebar: whitelist of top-level items + blacklist by link ---------- */
  var KEEP = ["داشبورد", "dashboard", "کاربران", "users", "کلیدهای api", "کلید های api", "api keys",
              "قالب ها", "قالبها", "templates", "عملیات گروهی", "bulk actions", "bulk", "تنظیمات", "settings",
              ].map(norm);   /* "پشتیبانی از ما" (donation) is hidden: the CHOST creator card replaces it */
  var HIDE_TXT = ["نودها", "نود", "nodes", "node", "هاست ها", "هاستها", "میزبان ها", "hosts", "host settings",
                  "هسته ها", "هسته", "پیکربندی هسته", "تنظیمات هسته", "cores", "core", "core settings", "core config",
                  "مدیران", "ادمین ها", "admins", "admin", "گروه ها", "گروهها", "groups", "نقش ها", "roles", "admin roles",
                  "آمار", "statistics", "stats", "usage", "پشتیبانی از ما", "حمایت از ما", "حمایت مالی", "support us", "donate", "sponsor"].map(norm);
  var HIDE_HREF = /\/(nodes?|hosts?|cores?|core-?settings|admins?|admin-roles|roles|groups|statistics|stats|donate|donation|support-us|sponsor)(\/|\?|#|$)/i;
  function label(el) { var t = el.querySelector("span, p") || el; return norm(t.textContent); }
  function hideItem(el) { if (el && el.style.display !== "none") { el.style.display = "none"; el.setAttribute("data-jx", "hidden"); } }
  function sweep() {
    var side = document.querySelector('[data-sidebar="sidebar"], aside, nav'); if (!side) return;
    var top = side.querySelectorAll('[data-sidebar="menu-item"]');
    for (var i = 0; i < top.length; i++) {
      if (top[i].getAttribute("data-ch")) continue;
      var btn = top[i].querySelector('[data-sidebar="menu-button"], a, button'); if (!btn) continue;
      var t = label(btn);
      if (t && KEEP.indexOf(t) === -1 && !KEEP.some(function (k) { return t.indexOf(k) === 0; })) hideItem(top[i]);
    }
    var links = side.querySelectorAll('a, [data-sidebar="menu-sub-button"], [data-sidebar="menu-button"]');
    for (var j = 0; j < links.length; j++) {
      var a = links[j], href = a.getAttribute("href") || "", txt = label(a);
      if (a.closest && a.closest('[data-ch]')) continue;
      if (HIDE_HREF.test(href) || HIDE_TXT.indexOf(txt) > -1) hideItem(a.closest('[data-sidebar="menu-sub-item"], [data-sidebar="menu-item"], li') || a);
    }
  }

  /* ---------- helpers ---------- */
  function findToken() {
    var jwt = /(eyJ[\w-]+\.[\w-]+\.[\w-]+)/, stores = [];
    try { stores.push(localStorage); } catch (e) {}
    try { stores.push(sessionStorage); } catch (e) {}
    for (var s = 0; s < stores.length; s++) for (var i = 0; i < stores[s].length; i++) {
      var m = jwt.exec(String(stores[s].getItem(stores[s].key(i)) || "")); if (m) return m[1];
    }
    var c = jwt.exec(document.cookie || ""); return c ? c[1] : null;
  }
  var OWNER = null, askedFor = null, busy = false;
  function whoAmI() {                       /* once per login token */
    var t = findToken();
    if (!t) { OWNER = null; askedFor = null; return; }
    if (t === askedFor || busy) return;
    busy = true;
    fetch("/api/admin", { headers: { Authorization: "Bearer " + t } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (me) { busy = false; askedFor = t; OWNER = me ? !!(me.role && me.role.is_owner) : null; schedule(); })
      .catch(function () { busy = false; setTimeout(schedule, 30000); });
  }
  function fa(n) { return String(n); }
  function post(url, body, token) {
    var hd = { "Content-Type": "application/json" }; if (token) hd.Authorization = "Bearer " + token;
    return fetch(url, { method: "POST", headers: hd, body: JSON.stringify(body || {}), credentials: "same-origin" })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return [r.status, j]; }); });
  }
  function heading(words, pathRe) {
    var hs = document.querySelectorAll("main h1, main h2, h1, h2");
    for (var i = 0; i < hs.length; i++) if (words.indexOf(norm(hs[i].textContent)) > -1) return hs[i];
    if (pathRe.test(location.pathname + location.hash)) return document.querySelector("main h1, main h2, h1, h2") || null;
    return null;
  }
  function place(box, h) { var anchor = h.closest("header") || h.parentElement || h; if (!anchor.parentNode) return false; anchor.parentNode.insertBefore(box, anchor.nextSibling); return true; }

  /* ---------- 2) owner key card inside "API Keys" ---------- */
  function bcss() { ucss(); if (!document.getElementById("ch-bot-css")) { var st = document.createElement("style"); st.id = "ch-bot-css"; st.textContent = BCSS + KCSS; document.head.appendChild(st); } }
  var KCSS = ".chb .lg.pr{background:var(--ch-pr);color:var(--ch-pf)}" +
    ".chb .kv{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:4px}.chb .kv code{flex:1;min-width:220px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:20px;font-weight:700;letter-spacing:.12em;direction:ltr;text-align:center;padding:12px 14px;border-radius:var(--ch-r);border:1px dashed var(--ch-bd);background:var(--ch-mu);user-select:all}" +
    ".chb .tm{display:flex;align-items:center;gap:10px;margin-top:12px;font-size:12.5px;color:var(--ch-mf)}.chb .tm i{flex:1;height:4px;border-radius:4px;background:var(--ch-mu);overflow:hidden;display:flex}.chb .tm i b{display:block;height:100%;background:var(--ch-pr);transition:width .5s linear}" +
    ".chb .tm.end i b{background:#e5484d}.chb .three{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}@media(max-width:760px){.chb .three{grid-template-columns:minmax(0,1fr)}}" +
    ".chb .sm{font-size:12px;margin-top:6px;display:flex;align-items:center;gap:6px;color:var(--ch-mf)}.chb .sm i{flex:1;height:4px;border-radius:4px;background:var(--ch-mu);overflow:hidden;display:flex}.chb .sm i b{display:block;height:100%;width:0;transition:width .25s,background .25s}";
  var IC_LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
  function pwInput(attr, ph, ac) { return '<div class="pw"><input class="ltr" ' + attr + ' type="password" autocomplete="' + ac + '" spellcheck="false" placeholder="' + ph + '"><button type="button" tabindex="-1" aria-label="نمایش رمز">' + IC.eye + "</button></div>"; }
  function wireEyes(root) { Array.prototype.forEach.call(root.querySelectorAll(".pw button"), function (b) { b.onclick = function () { var i = b.parentNode.querySelector("input"), show = i.type === "password"; i.type = show ? "text" : "password"; b.innerHTML = show ? IC.eyeoff : IC.eye; }; }); }
  function mountKey() {
    var old = document.getElementById("jx-owner-key");
    if (OWNER !== true) { if (old && old.parentNode) old.parentNode.removeChild(old); return; }
    if (old && document.body.contains(old)) return;
    var h = heading(["کلیدهای api", "کلید های api", "api keys", "api key"].map(norm), /api[-_]?keys?/i); if (!h) return;
    bcss();
    var box = document.createElement("section"); box.id = "jx-owner-key"; box.className = "chx chb"; box.dir = "rtl"; themeVars(box);
    box.innerHTML = '<div class="top" style="margin-bottom:14px"><div class="lg pr">' + IC.key + '</div><div class="tt"><b>کلید دسترسی مالک</b><p>یک کلید یک‌بارمصرف با اعتبار 5 دقیقه بسازید. با این کلید در صفحه‌ی ورود و از بخش «دسترسی مالک» می‌توانید نام کاربری و رمز مالک را از نو تنظیم کنید.</p></div>' +
      '<button class="btn pri" type="button" data-k="get">' + IC.key + '<span>دریافت کلید</span></button></div>' +
      '<div data-k="login" style="display:none"><div class="two"><div class="fld"><label>نام کاربری مالک</label><input class="ltr" data-k="u" autocomplete="username" spellcheck="false"></div><div class="fld"><label>رمز عبور مالک</label>' + pwInput('data-k="p"', "", "current-password") + '</div></div>' +
      '<div class="acts"><button class="btn pri" type="button" data-k="ok">تأیید و دریافت کلید</button></div></div>' +
      '<div data-k="out" style="display:none"><div class="kv"><code data-k="code"></code><button class="btn" type="button" data-k="copy">' + IC.copy + '<span>کپی</span></button></div><div class="tm"><i><b data-k="bar"></b></i><span data-k="left"></span></div></div>' +
      '<div class="err" data-k="err"></div>';
    if (!place(box, h)) return;
    wireEyes(box);
    var $k = function (n) { return box.querySelector('[data-k="' + n + '"]'); }, timer, err = $k("err");
    function showErr(m) { err.textContent = m || ""; err.classList.toggle("on", !!m); }
    function request(body, token, btn) {
      showErr(""); btn.disabled = true;
      post("/chost/key", body, token).then(function (x) {
        btn.disabled = false;
        if (x[0] === 200) return show(x[1]);
        if (x[0] === 401 && !body) { $k("login").style.display = ""; $k("u").focus(); return; }
        showErr(x[1].detail || "دریافت کلید ممکن نشد");
      }).catch(function () { btn.disabled = false; showErr("ارتباط با سرور برقرار نشد"); });
    }
    function show(j) {
      $k("login").style.display = "none"; $k("out").style.display = ""; $k("code").textContent = j.key;
      $k("get").lastChild.textContent = "کلید تازه";
      var ttl = (j.ttl || 300) * 1000, end = Date.now() + ttl, tm = box.querySelector(".tm");
      $k("copy").onclick = function () { copyText(j.key).then(function () { toast("کلید کپی شد"); }); };
      clearInterval(timer);
      (function tickK() {
        var r = Math.max(0, end - Date.now()), s = Math.round(r / 1000);
        $k("bar").style.width = (r / ttl * 100) + "%"; tm.classList.toggle("end", s <= 30);
        $k("left").textContent = s ? "اعتبار: " + Math.floor(s / 60) + ":" + ("0" + s % 60).slice(-2) : "منقضی شد. یک کلید تازه دریافت کنید.";
        if (!s) { clearInterval(timer); $k("code").style.opacity = ".4"; } else $k("code").style.opacity = "";
      })();
      timer = setInterval(function () { if (!document.body.contains(box)) return clearInterval(timer); var r = Math.max(0, end - Date.now()), s = Math.round(r / 1000);
        $k("bar").style.width = (r / ttl * 100) + "%"; tm.classList.toggle("end", s <= 30);
        $k("left").textContent = s ? "اعتبار: " + Math.floor(s / 60) + ":" + ("0" + s % 60).slice(-2) : "منقضی شد. یک کلید تازه دریافت کنید.";
        if (!s) { clearInterval(timer); $k("code").style.opacity = ".4"; } }, 500);
    }
    $k("get").onclick = function () { request(null, findToken(), this); };
    $k("ok").onclick = function () { request({ username: $k("u").value.trim(), password: $k("p").value }, null, this); };
    $k("p").onkeydown = function (e) { if (e.key === "Enter") $k("ok").click(); };
  }

  /* ---------- 3) change password card inside "Settings" (owner and resellers, own account) ---------- */
  function mountPass() {
    var old = document.getElementById("jx-pass");
    if (old && document.body.contains(old)) return;
    if (OWNER === null && !findToken()) return;
    var h = heading(["تنظیمات", "settings", "تنظیمات عمومی", "general settings"].map(norm), /settings/i); if (!h) return;
    bcss();
    var box = document.createElement("section"); box.id = "jx-pass"; box.className = "chx chb"; box.dir = "rtl"; themeVars(box);
    box.innerHTML = '<div class="top" style="margin-bottom:14px"><div class="lg pr">' + IC_LOCK + '</div><div class="tt"><b>تغییر رمز عبور</b><p>رمز عبور حساب خود را تغییر دهید. پس از ذخیره، ورودهای بعدی با رمز جدید انجام می‌شود.</p></div></div>' +
      '<div class="three"><div class="fld"><label>رمز فعلی</label>' + pwInput('data-p="cur"', "", "current-password") + '</div>' +
      '<div class="fld"><label>رمز جدید</label>' + pwInput('data-p="new"', "حداقل 4 کاراکتر", "new-password") + '<div class="sm"><i><b data-p="bar"></b></i><span data-p="lvl"></span></div></div>' +
      '<div class="fld"><label>تکرار رمز جدید</label>' + pwInput('data-p="rep"', "", "new-password") + '</div></div>' +
      '<div class="err" data-p="err"></div><div class="acts"><button class="btn pri" type="button" data-p="save">ذخیره‌ی رمز عبور</button></div>';
    if (!place(box, h)) return;
    wireEyes(box);
    var $p = function (n) { return box.querySelector('[data-p="' + n + '"]'); }, err = $p("err");
    var cols = ["#e5484d", "#f5a524", "#30a46c", "#30a46c"], names = ["ضعیف", "متوسط", "خوب", "قوی"];
    $p("new").addEventListener("input", function () { var v = this.value, s = strength(v), b = $p("bar"); b.style.width = (v ? Math.max(1, s) * 25 : 0) + "%"; b.style.background = cols[Math.max(0, s - 1)]; $p("lvl").textContent = v ? names[Math.max(0, s - 1)] : ""; });
    function showErr(m) { err.textContent = m || ""; err.classList.toggle("on", !!m); }
    $p("save").onclick = function () {
      var cur = $p("cur").value, nw = $p("new").value, rp = $p("rep").value, btn = this;
      if (!cur || !nw) return showErr("رمز فعلی و رمز جدید را وارد کنید");
      if (nw.length < 4) return showErr("رمز جدید باید حداقل 4 کاراکتر باشد");
      if (nw !== rp) return showErr("تکرار رمز جدید با رمز جدید یکسان نیست");
      btn.disabled = true; showErr("");
      post("/chost/password", { current: cur, new: nw }, findToken()).then(function (x) {
        btn.disabled = false;
        if (x[0] !== 200) return showErr(x[1].detail || "ذخیره ممکن نشد");
        $p("cur").value = $p("new").value = $p("rep").value = ""; $p("bar").style.width = "0"; $p("lvl").textContent = "";
        toast("رمز عبور با موفقیت تغییر کرد");
      }).catch(function () { btn.disabled = false; showErr("ارتباط با سرور برقرار نشد"); });
    };
    $p("rep").onkeydown = function (e) { if (e.key === "Enter") $p("save").click(); };
  }

  /* ---------- shared: look exactly like the panel (colors, radius, font come from the live theme) ---------- */
  function pick(sel, prop) { var el = document.querySelector(sel); if (!el) return null; var v = getComputedStyle(el)[prop]; return v && v !== "rgba(0, 0, 0, 0)" && v !== "transparent" ? v : null; }
  function themeVars(el) {
    var body = getComputedStyle(document.body), bg = body.backgroundColor, fg = body.color;
    if (!bg || bg === "rgba(0, 0, 0, 0)" || bg === "transparent") bg = getComputedStyle(document.documentElement).backgroundColor;
    if (!bg || bg === "rgba(0, 0, 0, 0)" || bg === "transparent") bg = document.documentElement.classList.contains("dark") ? "#09090b" : "#ffffff";
    var pb = document.querySelector('button[class*="bg-primary"]'), pr = null, pf = null, rad = null;
    if (pb) { var s = getComputedStyle(pb); pr = s.backgroundColor; pf = s.color; rad = s.borderTopLeftRadius; }
    var v = {
      "--ch-bg": bg, "--ch-fg": fg,
      "--ch-card": pick('[class*="bg-card"]', "backgroundColor") || bg,
      "--ch-mf": pick('[class*="text-muted-foreground"]', "color") || "rgba(127,127,127,.95)",
      "--ch-mu": pick('[class*="bg-muted"]', "backgroundColor") || "rgba(127,127,127,.12)",
      "--ch-bd": pick('[class*="border-border"], [class*="border-input"], aside [class*="border"]', "borderTopColor") || "rgba(127,127,127,.25)",
      "--ch-pr": pr && pr !== "rgba(0, 0, 0, 0)" ? pr : fg, "--ch-pf": pf || bg, "--ch-r": rad && rad !== "0px" ? rad : "8px"
    };
    for (var k in v) el.style.setProperty(k, v[k]);
  }
  var UCSS =
    ".chx{font:inherit;color:var(--ch-fg);-webkit-font-smoothing:antialiased}.chx *{box-sizing:border-box}" +
    ".chx .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:36px;padding:0 14px;border-radius:var(--ch-r);font:inherit;font-size:14px;font-weight:500;cursor:pointer;white-space:nowrap;border:1px solid var(--ch-bd);background:transparent;color:inherit;transition:background .15s,opacity .15s}" +
    ".chx .btn:hover{background:var(--ch-mu)}.chx .btn:disabled{opacity:.5;pointer-events:none}.chx .btn svg{width:16px;height:16px;flex:none}" +
    ".chx .btn.pri{background:var(--ch-pr);color:var(--ch-pf);border-color:transparent}.chx .btn.pri:hover{opacity:.9}" +
    ".chx .btn.red{background:#e5484d;color:#fff;border-color:transparent}.chx .btn.ic{width:36px;padding:0}.chx .btn.sm{height:32px;padding:0 10px;font-size:13px}" +
    ".chx input{width:100%;height:36px;padding:0 12px;border-radius:var(--ch-r);border:1px solid var(--ch-bd);background:transparent;color:inherit;font:inherit;font-size:14px;outline:none;transition:box-shadow .15s}" +
    ".chx input:focus{box-shadow:0 0 0 2px var(--ch-bg),0 0 0 4px var(--ch-pr)}.chx input::placeholder{color:var(--ch-mf)}" +
    ".chx label{display:block;font-size:14px;font-weight:500;margin:0 0 6px}.chx .hint{font-size:12.5px;color:var(--ch-mf);margin-top:6px;line-height:1.7}" +
    ".chx .fld{margin-bottom:14px}.chx .mut{color:var(--ch-mf)}.chx .ltr{direction:ltr;unicode-bidi:isolate}" +
    ".chx .err{font-size:13px;color:#e5484d;margin-top:10px;display:none;line-height:1.7}.chx .err.on{display:block}" +
    /* dialog */
    ".chd{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.8);opacity:0;transition:opacity .15s}.chd.on{opacity:1}" +
    ".chd .dl{width:100%;max-width:440px;max-height:calc(100vh - 32px);overflow:auto;background:var(--ch-bg);border:1px solid var(--ch-bd);border-radius:calc(var(--ch-r) + 4px);padding:24px;position:relative;transform:scale(.96);transition:transform .15s;box-shadow:0 20px 50px -12px rgba(0,0,0,.5)}.chd.on .dl{transform:none}" +
    ".chd h2{font-size:18px;font-weight:600;margin:0 0 6px;line-height:1.4}.chd .ds{font-size:14px;color:var(--ch-mf);margin:0 0 20px;line-height:1.8}" +
    ".chd .cl{position:absolute;top:14px;inset-inline-end:14px;width:28px;height:28px;border:0;background:transparent;color:var(--ch-mf);cursor:pointer;border-radius:6px;display:grid;place-items:center}.chd .cl:hover{color:var(--ch-fg);background:var(--ch-mu)}.chd .cl svg{width:16px;height:16px}" +
    ".chd .ft{display:flex;gap:8px;justify-content:flex-end;margin-top:22px;flex-wrap:wrap-reverse}@media(max-width:480px){.chd .ft .btn{flex:1}}" +
    /* page */
    ".chp{padding:16px;max-width:100%}@media(min-width:768px){.chp{padding:24px}}" +
    ".chp .hd{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:20px}.chp h1{font-size:24px;font-weight:700;margin:0;line-height:1.3}.chp .hd p{margin:4px 0 0;font-size:14px;color:var(--ch-mf)}" +
    ".chp .stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:16px}@media(min-width:900px){.chp .stats{grid-template-columns:repeat(4,minmax(0,1fr))}}" +
    ".chp .card{background:var(--ch-card);border:1px solid var(--ch-bd);border-radius:calc(var(--ch-r) + 4px)}" +
    ".chp .stat{padding:16px}.chp .stat .t{display:flex;justify-content:space-between;align-items:center;font-size:13px;font-weight:500;color:var(--ch-mf)}.chp .stat .t svg{width:16px;height:16px}.chp .stat b{display:block;font-size:22px;font-weight:700;margin-top:8px;direction:ltr;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
    ".chp .bar{display:flex;gap:8px;align-items:center;padding:12px;border-bottom:1px solid var(--ch-bd)}.chp .bar .s{position:relative;flex:1;max-width:320px}.chp .bar .s svg{position:absolute;top:10px;inset-inline-start:10px;width:16px;height:16px;color:var(--ch-mf)}.chp .bar .s input{padding-inline-start:34px}" +
    ".chp table{width:100%;border-collapse:collapse;font-size:14px}.chp th{text-align:right;font-weight:500;color:var(--ch-mf);height:42px;padding:0 14px;border-bottom:1px solid var(--ch-bd);white-space:nowrap}" +
    ".chp td{padding:12px 14px;border-bottom:1px solid var(--ch-bd);vertical-align:middle}.chp tr:last-child td{border-bottom:0}.chp tbody tr{transition:background .15s}.chp tbody tr:hover{background:var(--ch-mu)}" +
    ".chp .un{display:flex;align-items:center;gap:10px;min-width:0}.chp .av{width:32px;height:32px;border-radius:999px;display:grid;place-items:center;font-size:12px;font-weight:700;background:var(--ch-mu);flex:none;direction:ltr;text-transform:uppercase}.chp .un b{font-weight:600;direction:ltr;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
    ".chp .bdg{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;padding:2px 10px;border-radius:999px;border:1px solid transparent;white-space:nowrap}.chp .bdg i{width:6px;height:6px;border-radius:50%;background:currentColor}.chp .bdg.on{color:#30a46c;background:rgba(48,164,108,.12)}.chp .bdg.off{color:#e5484d;background:rgba(229,72,77,.12)}" +
    ".chp .use{min-width:150px}.chp .use .n{display:flex;justify-content:space-between;font-size:12.5px;direction:ltr;margin-bottom:6px}.chp .use .n span:last-child{color:var(--ch-mf)}.chp .pg{height:6px;border-radius:99px;background:var(--ch-mu);overflow:hidden}.chp .pg i{display:block;height:100%;border-radius:inherit;background:var(--ch-pr);transition:width .5s}.chp .pg i.hi{background:#e5484d}" +
    ".chp .mob{display:none}@media(max-width:767px){.chp table{display:none}.chp .mob{display:block}}" +
    ".chp .mi{padding:14px;border-bottom:1px solid var(--ch-bd)}.chp .mi:last-child{border-bottom:0}.chp .mi .r{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}" +
    ".chp .empty{padding:48px 16px;text-align:center}.chp .empty .ei{width:48px;height:48px;border-radius:999px;background:var(--ch-mu);display:grid;place-items:center;margin:0 auto 12px}.chp .empty .ei svg{width:22px;height:22px}.chp .empty b{display:block;font-size:16px;margin-bottom:4px}.chp .empty p{margin:0 0 16px;font-size:14px;color:var(--ch-mf)}" +
    ".chp .sk{height:14px;border-radius:6px;background:var(--ch-mu);animation:chpk 1.2s ease-in-out infinite}@keyframes chpk{50%{opacity:.45}}" +
    /* dropdown */
    ".chm{position:fixed;z-index:2147483001;min-width:190px;padding:4px;background:var(--ch-bg);border:1px solid var(--ch-bd);border-radius:var(--ch-r);box-shadow:0 10px 30px -8px rgba(0,0,0,.35);opacity:0;transform:translateY(-4px);transition:opacity .12s,transform .12s}.chm.on{opacity:1;transform:none}" +
    ".chm button{display:flex;align-items:center;gap:10px;width:100%;height:34px;padding:0 10px;border:0;background:transparent;color:inherit;font:inherit;font-size:14px;border-radius:calc(var(--ch-r) - 2px);cursor:pointer;text-align:right}.chm button:hover{background:var(--ch-mu)}.chm button svg{width:16px;height:16px;flex:none;opacity:.8}.chm button.red{color:#e5484d}.chm hr{border:0;border-top:1px solid var(--ch-bd);margin:4px -4px}" +
    /* toast */
    ".cht{position:fixed;z-index:2147483002;bottom:20px;inset-inline-end:20px;max-width:calc(100vw - 40px);display:flex;align-items:center;gap:10px;padding:12px 16px;background:var(--ch-bg);border:1px solid var(--ch-bd);border-radius:var(--ch-r);box-shadow:0 10px 30px -8px rgba(0,0,0,.35);font-size:14px;opacity:0;transform:translateY(8px);transition:.2s}.cht.on{opacity:1;transform:none}.cht svg{width:18px;height:18px;flex:none}.cht.good svg{color:#30a46c}.cht.bad svg{color:#e5484d}" +
    /* owner access (login) */
    ".chk .kbox{position:relative}.chk .kbox input{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:15px;letter-spacing:.06em;text-transform:uppercase;padding-inline-end:84px}" +
    ".chk .kbox .btn{position:absolute;top:3px;inset-inline-end:3px;height:30px;font-size:12.5px;padding:0 10px}" +
    ".chk .pw{position:relative}.chk .pw input{padding-inline-end:40px}.chk .pw button{position:absolute;top:4px;inset-inline-end:4px;width:28px;height:28px;border:0;background:transparent;color:var(--ch-mf);cursor:pointer;display:grid;place-items:center;border-radius:6px}.chk .pw button svg{width:16px;height:16px}" +
    ".chk .two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}@media(max-width:420px){.chk .two{grid-template-columns:minmax(0,1fr)}}" +
    ".chk .stp{display:flex;gap:6px;margin:0 0 18px}.chk .stp i{flex:1;height:3px;border-radius:3px;background:var(--ch-mu);transition:background .3s}.chk .stp i.on{background:var(--ch-pr)}" +
    ".chk details{margin-top:4px;border:1px solid var(--ch-bd);border-radius:var(--ch-r);padding:0 12px}.chk summary{cursor:pointer;font-size:13px;font-weight:500;padding:10px 0;list-style:none;display:flex;justify-content:space-between;align-items:center}.chk summary::-webkit-details-marker{display:none}.chk summary::after{content:'+';color:var(--ch-mf)}.chk details[open] summary::after{content:'-'}" +
    ".chk details ol{margin:0 0 12px;padding-inline-start:18px;font-size:13px;color:var(--ch-mf);line-height:2}.chk details code{font-family:ui-monospace,Consolas,monospace;background:var(--ch-mu);padding:1px 6px;border-radius:4px;direction:ltr;display:inline-block}" +
    ".chk .sm{font-size:12px;margin-top:6px;display:flex;align-items:center;gap:6px;color:var(--ch-mf)}.chk .sm i{flex:1;height:4px;border-radius:4px;background:var(--ch-mu);overflow:hidden;display:flex}.chk .sm i b{display:block;height:100%;width:0;transition:width .25s,background .25s}" +
    ".chk .done{text-align:center;padding:8px 0 4px}.chk .done .ok{width:64px;height:64px;border-radius:999px;margin:0 auto 14px;display:grid;place-items:center;background:rgba(48,164,108,.12);color:#30a46c}.chk .done .ok svg{width:30px;height:30px;stroke-dasharray:30;stroke-dashoffset:30;animation:chkd .5s .1s ease forwards}@keyframes chkd{to{stroke-dashoffset:0}}" +
    ".chk .done b{display:block;font-size:18px;margin-bottom:6px}.chk .done p{margin:0;color:var(--ch-mf);font-size:14px;line-height:1.8}";
  function ucss() { if (!document.getElementById("ch-ui-css")) { var st = document.createElement("style"); st.id = "ch-ui-css"; st.textContent = UCSS; document.head.appendChild(st); } }
  var IC = {
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    more: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    ref: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.4L21 8M21 3v5h-5"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></svg>',
    act: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
    db: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 3v18h18M7 16v-4M12 16V8M17 16v-7"/></svg>',
    addgb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>',
    gauge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m12 14 4-4M3.3 19a10 10 0 1 1 17.4 0"/></svg>',
    key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/></svg>',
    ban: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="m5.7 5.7 12.6 12.6"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4z"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5 10 17 19 7"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeoff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.4 3.3M6.6 6.6C3.9 8.3 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
    paste: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>'
  };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fmtGB(b) { if (!b) return "0 GB"; var g = b / 1073741824; if (g >= 1024) return Math.round(g / 102.4) / 10 + " TB"; return (g >= 100 ? Math.round(g) : Math.round(g * 10) / 10) + " GB"; }
  function copyText(t) { try { if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(t); } catch (e) {}
    var a = document.createElement("textarea"); a.value = t; a.style.position = "fixed"; a.style.opacity = "0"; document.body.appendChild(a); a.select(); try { document.execCommand("copy"); } catch (e) {} document.body.removeChild(a); return Promise.resolve(); }
  var toastT;
  function toast(text, kind) {
    ucss(); var t = document.getElementById("ch-toast");
    if (!t) { t = document.createElement("div"); t.id = "ch-toast"; t.className = "chx cht"; t.dir = "rtl"; document.body.appendChild(t); }
    themeVars(t); t.className = "chx cht " + (kind || "good"); t.innerHTML = (kind === "bad" ? IC.alert : IC.check) + "<span></span>"; t.lastChild.textContent = text;
    requestAnimationFrame(function () { t.classList.add("on"); }); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove("on"); }, 2600);
  }
  /* native-looking dialog. opts: title, desc, html, ok, okClass, cancel, onOk(root) -> Promise<bool close>, onOpen(root) */
  function dialog(opts) {
    ucss();
    var ov = document.createElement("div"); ov.className = "chx chd"; ov.dir = "rtl"; themeVars(ov);
    ov.innerHTML = '<div class="dl ' + (opts.cls || "") + '" role="dialog" aria-modal="true"><button class="cl" type="button" aria-label="بستن">' + IC.x + '</button>' +
      '<h2></h2><p class="ds"></p><div class="bx">' + (opts.html || "") + '</div><div class="err"></div>' +
      '<div class="ft">' + (opts.cancel === false ? "" : '<button class="btn" type="button" data-k="no">' + (opts.cancel || "انصراف") + '</button>') +
      (opts.ok ? '<button class="btn ' + (opts.okClass || "pri") + '" type="button" data-k="ok">' + opts.ok + '</button>' : "") + '</div></div>';
    ov.querySelector("h2").textContent = opts.title || ""; var ds = ov.querySelector(".ds"); if (opts.desc) ds.textContent = opts.desc; else ds.style.display = "none";
    document.body.appendChild(ov); requestAnimationFrame(function () { ov.classList.add("on"); });
    var err = ov.querySelector(".err"), ok = ov.querySelector('[data-k="ok"]');
    var api = { root: ov, error: function (m) { err.textContent = m || ""; err.classList.toggle("on", !!m); }, close: close, ok: ok };
    function close() { ov.classList.remove("on"); document.removeEventListener("keydown", key, true); setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 160); if (opts.onClose) opts.onClose(); }
    function key(e) { if (e.key === "Escape") { e.stopPropagation(); close(); } if (e.key === "Enter" && ok && e.target.tagName === "INPUT") { e.preventDefault(); ok.click(); } }
    document.addEventListener("keydown", key, true);
    ov.addEventListener("mousedown", function (e) { if (e.target === ov) close(); });
    ov.querySelector(".cl").onclick = close; var no = ov.querySelector('[data-k="no"]'); if (no) no.onclick = close;
    if (ok) ok.onclick = function () {
      api.error(""); if (!opts.onOk) return close();
      var label = ok.innerHTML; ok.disabled = true; ok.textContent = "…";
      Promise.resolve(opts.onOk(api)).then(function (r) { ok.disabled = false; ok.innerHTML = label; if (r) close(); })
        .catch(function () { ok.disabled = false; ok.innerHTML = label; api.error("ارتباط با سرور برقرار نشد"); });
    };
    if (opts.onOpen) opts.onOpen(api);
    setTimeout(function () { var f = ov.querySelector("input"); if (f) f.focus(); }, 60);
    return api;
  }
  function menu(anchor, items) {
    ucss(); var old = document.getElementById("ch-menu"); if (old) old.parentNode.removeChild(old);
    var m = document.createElement("div"); m.id = "ch-menu"; m.className = "chx chm"; m.dir = "rtl"; themeVars(m);
    m.innerHTML = items.map(function (it, i) { return it === "-" ? "<hr>" : '<button type="button" data-i="' + i + '" class="' + (it.red ? "red" : "") + '">' + it.icon + "<span>" + it.label + "</span></button>"; }).join("");
    document.body.appendChild(m);
    var r = anchor.getBoundingClientRect(), w = m.offsetWidth, h = m.offsetHeight;
    var left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8), top = r.bottom + 6; if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
    m.style.left = left + "px"; m.style.top = top + "px"; requestAnimationFrame(function () { m.classList.add("on"); });
    function off(e) { if (!m.contains(e.target)) close(); } function close() { document.removeEventListener("mousedown", off, true); window.removeEventListener("scroll", close, true); if (m.parentNode) m.parentNode.removeChild(m); }
    setTimeout(function () { document.addEventListener("mousedown", off, true); window.addEventListener("scroll", close, true); }, 0);
    Array.prototype.forEach.call(m.querySelectorAll("button"), function (b) { b.onclick = function () { close(); items[+b.getAttribute("data-i")].run(); }; });
  }

  /* ---------- 4) sidebar "پنل نمایندگی": a real page inside the panel layout (owner only) ---------- */
  var RS_LABEL = "پنل نمایندگی";
  var RS_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>';
  var PAGE = null;   // {host, hidden:[], path, item}
  function api(path, body) { return post("/chost/resellers" + path, body || {}, findToken()); }
  function resellerPageOpen() { return !!(PAGE && document.body.contains(PAGE.host)); }
  function closeResellerPage() {
    if (!PAGE) return;
    PAGE.hidden.forEach(function (el) { el.style.display = el.getAttribute("data-ch-disp") || ""; el.removeAttribute("data-ch-disp"); el.removeAttribute("data-ch-hid"); });
    if (PAGE.host.parentNode) PAGE.host.parentNode.removeChild(PAGE.host);
    var it = document.getElementById("ch-rs-item"); if (it) { var b = it.querySelector('[data-sidebar="menu-button"], a, button'); if (b) b.setAttribute("data-active", "false"); }
    (PAGE.activeOff || []).forEach(function (b) { if (document.body.contains(b)) b.setAttribute("data-active", "true"); });
    PAGE = null;
  }
  function openResellerPage() {
    if (resellerPageOpen()) return;
    var main = document.querySelector("main"); if (!main) return;
    ucss(); closeSidebar();
    var hidden = [];
    Array.prototype.forEach.call(main.children, function (c) { if (c.id === "ch-rs-page") return; c.setAttribute("data-ch-disp", c.style.display || ""); c.setAttribute("data-ch-hid", "1"); c.style.display = "none"; hidden.push(c); });
    var host = document.createElement("div"); host.id = "ch-rs-page"; host.className = "chx chp"; host.dir = "rtl"; themeVars(host);
    main.appendChild(host);
    var activeOff = [];
    Array.prototype.forEach.call(document.querySelectorAll('[data-sidebar="menu-button"][data-active="true"]'), function (b) { if (!b.closest("#ch-rs-item")) { b.setAttribute("data-active", "false"); activeOff.push(b); } });
    var mine = document.querySelector('#ch-rs-item [data-sidebar="menu-button"], #ch-rs-item a, #ch-rs-item button'); if (mine) mine.setAttribute("data-active", "true");
    PAGE = { host: host, hidden: hidden, path: location.pathname + location.search + location.hash, activeOff: activeOff };
    try { window.scrollTo(0, 0); main.scrollTop = 0; } catch (e) {}
    renderPage(host);
  }
  function closeSidebar() { try { var o = document.querySelector('[data-sidebar="sidebar"][data-mobile="true"]'); if (o) document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); } catch (e) {} }

  function renderPage(host) {
    host.innerHTML =
      '<div class="hd"><div><h1>' + RS_LABEL + '</h1><p>برای هر نماینده یک پنل جدا با سهمیه‌ی حجم بساز. نماینده با همین آدرس وارد می‌شود و فقط کاربران خودش را می‌بیند.</p></div>' +
      '<button class="btn pri" type="button" data-a="new">' + IC.plus + '<span>نماینده‌ی جدید</span></button></div>' +
      '<div class="stats">' +
        '<div class="card stat"><div class="t"><span>نماینده‌ها</span>' + IC.users + '</div><b data-s="n">-</b></div>' +
        '<div class="card stat"><div class="t"><span>فعال</span>' + IC.act + '</div><b data-s="a">-</b></div>' +
        '<div class="card stat"><div class="t"><span>کل سهمیه</span>' + IC.db + '</div><b data-s="q">-</b></div>' +
        '<div class="card stat"><div class="t"><span>کل مصرف</span>' + IC.chart + '</div><b data-s="u">-</b></div></div>' +
      '<div class="card"><div class="bar"><div class="s">' + IC.search + '<input type="search" placeholder="جستجوی نماینده" data-a="q"></div><div style="flex:1"></div><button class="btn ic" type="button" title="بروزرسانی" data-a="ref">' + IC.ref + '</button></div>' +
      '<div data-a="body"></div></div>';
    var body = host.querySelector('[data-a="body"]'), q = host.querySelector('[data-a="q"]'), all = [];
    host.querySelector('[data-a="new"]').onclick = function () { createDialog(load); };
    host.querySelector('[data-a="ref"]').onclick = function () { load(true); };
    q.oninput = function () { draw(); };
    function skeleton() { var r = ""; for (var i = 0; i < 3; i++) r += '<div class="mi"><div class="sk" style="width:' + (40 + i * 15) + '%"></div><div class="sk" style="width:80%;margin-top:10px;height:8px"></div></div>'; body.innerHTML = r; }
    function stat(k, v) { var el = host.querySelector('[data-s="' + k + '"]'); if (el) el.textContent = v; }
    function draw() {
      var term = q.value.trim().toLowerCase(), rs = all.filter(function (r) { return !term || String(r.username).toLowerCase().indexOf(term) > -1; });
      var qq = 0, uu = 0, act = 0; all.forEach(function (r) { qq += r.limit || 0; uu += r.used || 0; if (!r.disabled) act++; });
      stat("n", all.length); stat("a", act); stat("q", fmtGB(qq)); stat("u", fmtGB(uu));
      if (!all.length) { body.innerHTML = '<div class="empty"><div class="ei">' + IC.users + '</div><b>هنوز نماینده‌ای ندارید</b><p>اولین پنل نمایندگی را بسازید و اطلاعات ورود را برای نماینده بفرستید.</p><button class="btn pri" type="button" data-a="new2">' + IC.plus + '<span>نماینده‌ی جدید</span></button></div>';
        body.querySelector('[data-a="new2"]').onclick = function () { createDialog(load); }; return; }
      if (!rs.length) { body.innerHTML = '<div class="empty"><b>نتیجه‌ای پیدا نشد</b><p>نام دیگری را جستجو کنید.</p></div>'; return; }
      function use(r) { var p = r.limit ? Math.min(100, Math.round(r.used / r.limit * 100)) : 0;
        return '<div class="use"><div class="n"><span>' + fmtGB(r.used) + " / " + (r.limit ? fmtGB(r.limit) : "∞") + '</span><span>' + (r.limit ? p + "%" : "") + '</span></div><div class="pg"><i class="' + (p >= 90 ? "hi" : "") + '" style="width:' + (r.limit ? p : 0) + '%"></i></div></div>'; }
      function badge(r) { return '<span class="bdg ' + (r.disabled ? "off" : "on") + '"><i></i>' + (r.disabled ? "غیرفعال" : "فعال") + "</span>"; }
      function who(r) { return '<div class="un"><div class="av">' + esc(String(r.username).slice(0, 2)) + '</div><b>' + esc(r.username) + "</b></div>"; }
      var more = '<button class="btn ic sm" type="button" data-m="1" aria-label="عملیات">' + IC.more + "</button>";
      body.innerHTML = '<table><thead><tr><th>نام کاربری</th><th>وضعیت</th><th>مصرف / سهمیه</th><th>کاربران</th><th style="width:56px"></th></tr></thead><tbody>' +
        rs.map(function (r, i) { return '<tr data-i="' + i + '"><td>' + who(r) + "</td><td>" + badge(r) + "</td><td>" + use(r) + '</td><td class="ltr">' + (r.users || 0) + "</td><td>" + more + "</td></tr>"; }).join("") + "</tbody></table>" +
        '<div class="mob">' + rs.map(function (r, i) { return '<div class="mi" data-i="' + i + '"><div class="r">' + who(r) + '<div style="display:flex;gap:6px;align-items:center">' + badge(r) + more + "</div></div>" + use(r) + "</div>"; }).join("") + "</div>";
      Array.prototype.forEach.call(body.querySelectorAll('[data-m="1"]'), function (b) {
        var r = rs[+b.closest("[data-i]").getAttribute("data-i")];
        b.onclick = function (e) { e.stopPropagation(); rowMenu(b, r, load); };
      });
    }
    function load(manual) {
      if (!all.length) skeleton();
      return api("", {}).then(function (x) {
        if (x[0] !== 200) { body.innerHTML = '<div class="empty"><b>بارگذاری نشد</b><p>' + esc(x[1].detail || "دوباره امتحان کنید") + "</p></div>"; return; }
        all = x[1].resellers || []; draw(); if (manual) toast("لیست بروز شد");
      }).catch(function () { body.innerHTML = '<div class="empty"><b>ارتباط با سرور برقرار نشد</b><p>اتصال اینترنت را بررسی کنید و دوباره امتحان کنید.</p></div>'; });
    }
    load();
  }
  function loginInfo(u, p, gb) { return "پنل نمایندگی CHOST\nآدرس: " + location.origin + "/dashboard/\nنام کاربری: " + u + "\nرمز عبور: " + p + "\nسهمیه: " + (gb ? gb + " GB" : "نامحدود"); }
  function createDialog(done) {
    dialog({ title: "نماینده‌ی جدید", desc: "یک پنل نمایندگی با سهمیه‌ی حجم بسازید. نماینده فقط با قالب‌های آماده کاربر می‌سازد.", ok: "ساخت پنل نمایندگی",
      html: '<div class="fld"><label>نام کاربری</label><input class="ltr" data-f="u" autocomplete="off" spellcheck="false" placeholder="reseller1"><div class="hint">حروف انگلیسی، عدد و _ (3 تا 32 کاراکتر)</div></div>' +
            '<div class="fld"><label>رمز عبور</label><input class="ltr" data-f="p" autocomplete="new-password" spellcheck="false" placeholder="حداقل 4 کاراکتر"></div>' +
            '<div class="fld" style="margin:0"><label>سهمیه‌ی حجم (گیگابایت)</label><input class="ltr" data-f="g" type="number" inputmode="decimal" min="0" step="any" value="50"><div class="hint">0 یعنی نامحدود. وقتی سهمیه تمام شود، کاربران نماینده خودکار متوقف می‌شوند.</div></div>',
      onOk: function (d) {
        var R = d.root, u = R.querySelector('[data-f="u"]').value.trim(), p = R.querySelector('[data-f="p"]').value, gv = R.querySelector('[data-f="g"]').value, g = gv === "" ? 0 : +gv;
        if (!/^[A-Za-z0-9_]{3,32}$/.test(u)) { d.error("نام کاربری فقط حروف انگلیسی، عدد و _ باشد (3 تا 32 کاراکتر)"); return false; }
        if (p.length < 4) { d.error("رمز عبور حداقل 4 کاراکتر باشد"); return false; }
        if (!(g >= 0)) { d.error("سهمیه را درست وارد کنید"); return false; }
        return api("/create", { username: u, password: p, gb: g }).then(function (x) {
          if (x[0] !== 200) { d.error(x[1].detail || "ساخت ممکن نشد"); return false; }
          done(); setTimeout(function () { infoDialog(u, p, g); }, 180); return true;
        });
      } });
  }
  function infoDialog(u, p, g) {
    var info = loginInfo(u, p, g);
    dialog({ title: "پنل نمایندگی ساخته شد", desc: "این اطلاعات را برای نماینده بفرستید. رمز عبور بعداً نمایش داده نمی‌شود.", ok: IC.copy + "<span>کپی اطلاعات ورود</span>", cancel: "بستن",
      html: '<div class="card" style="border:1px solid var(--ch-bd);border-radius:var(--ch-r);padding:14px;background:var(--ch-mu);font-size:13.5px;line-height:2;white-space:pre-wrap;word-break:break-all"></div>',
      onOpen: function (d) { d.root.querySelector(".card").textContent = info; },
      onOk: function () { return copyText(info).then(function () { toast("اطلاعات ورود کپی شد"); return true; }); } });
  }
  function rowMenu(anchor, r, reload) {
    function upd(action, extra, okMsg) { var b = { username: r.username, action: action }; for (var k in extra) b[k] = extra[k];
      return api("/update", b).then(function (x) { if (x[0] !== 200) return x[1].detail || "انجام نشد"; toast(okMsg); reload(); return null; }); }
    function gbDialog(mode) {
      var add = mode === "add_gb";
      dialog({ title: add ? "افزایش سهمیه" : "تنظیم سهمیه", desc: (add ? "حجم اضافه برای " : "سهمیه‌ی جدید برای ") + r.username + (r.limit ? " (فعلی: " + fmtGB(r.limit) + ")" : " (فعلی: نامحدود)"), ok: "ذخیره",
        html: '<div class="fld" style="margin:0"><label>' + (add ? "حجم اضافه (گیگابایت)" : "سهمیه (گیگابایت)") + '</label><input class="ltr" data-f="g" type="number" inputmode="decimal" min="0" step="any" placeholder="' + (add ? "مثلاً 50" : "0 = نامحدود") + '">' + (add ? "" : '<div class="hint">0 یعنی نامحدود.</div>') + "</div>",
        onOk: function (d) { var v = d.root.querySelector('[data-f="g"]').value, n = v === "" ? NaN : +v;
          if (!(n >= 0) || (add && !(n > 0))) { d.error("مقدار را درست وارد کنید"); return false; }
          return upd(mode, { gb: n }, "سهمیه ذخیره شد").then(function (e) { if (e) { d.error(e); return false; } return true; }); } });
    }
    var items = [];
    if (r.limit) items.push({ icon: IC.addgb, label: "افزایش سهمیه", run: function () { gbDialog("add_gb"); } });
    items.push({ icon: IC.gauge, label: "تنظیم سهمیه", run: function () { gbDialog("set_gb"); } });
    items.push({ icon: IC.key, label: "تغییر رمز عبور", run: function () {
      dialog({ title: "تغییر رمز عبور", desc: "رمز جدید برای " + r.username, ok: "ذخیره",
        html: '<div class="fld" style="margin:0"><label>رمز جدید</label><input class="ltr" data-f="p" autocomplete="new-password" spellcheck="false" placeholder="حداقل 4 کاراکتر"></div>',
        onOk: function (d) { var p = d.root.querySelector('[data-f="p"]').value; if (p.length < 4) { d.error("رمز عبور حداقل 4 کاراکتر باشد"); return false; }
          return upd("password", { password: p }, "رمز عبور عوض شد").then(function (e) { if (e) { d.error(e); return false; } setTimeout(function () { infoDialog(r.username, p, r.limit ? Math.round(r.limit / 1073741824 * 10) / 10 : 0); }, 180); return true; }); } });
    } });
    items.push({ icon: IC.copy, label: "کپی آدرس پنل", run: function () { copyText(location.origin + "/dashboard/").then(function () { toast("آدرس پنل کپی شد"); }); } });
    items.push(r.disabled ? { icon: IC.play, label: "فعال کردن", run: function () { upd("enable", {}, "نماینده فعال شد").then(function (e) { if (e) toast(e, "bad"); }); } }
                          : { icon: IC.ban, label: "غیرفعال کردن", run: function () { upd("disable", {}, "نماینده غیرفعال شد").then(function (e) { if (e) toast(e, "bad"); }); } });
    items.push("-");
    items.push({ icon: IC.trash, label: "حذف نماینده", red: true, run: function () {
      dialog({ title: "حذف " + r.username + "؟", desc: "این نماینده حذف می‌شود و دیگر نمی‌تواند وارد پنل شود. این کار برگشت‌پذیر نیست.", ok: "حذف", okClass: "red",
        onOk: function (d) { return upd("delete", {}, "نماینده حذف شد").then(function (e) { if (e) { d.error(e); return false; } return true; }); } });
    } });
    menu(anchor, items);
  }
  function mountResellers() {
    var mine = document.getElementById("ch-rs-item");
    if (OWNER !== true) { if (mine && mine.parentNode) mine.parentNode.removeChild(mine); closeResellerPage(); return; }
    if (PAGE) {   // left the page through the router (back button, link, logo): give the panel its content back
      var main = document.querySelector("main");
      if (!main || !main.contains(PAGE.host) || PAGE.path !== location.pathname + location.search + location.hash) closeResellerPage();
    }
    if (mine && document.body.contains(mine)) return;
    var side = document.querySelector('[data-sidebar="sidebar"], aside, nav'); if (!side) return;
    var items = side.querySelectorAll('[data-sidebar="menu-item"]'), ref = null;
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === "ch-rs-item" || items[i].style.display === "none") continue;
      var t = label(items[i].querySelector('[data-sidebar="menu-button"], a, button') || items[i]);
      if (t === norm("کاربران") || t === "users") { ref = items[i]; break; }
    }
    if (!ref) return;
    var clone = ref.cloneNode(true); clone.id = "ch-rs-item"; clone.setAttribute("data-ch", "rs");
    Array.prototype.forEach.call(clone.querySelectorAll('[data-sidebar="menu-sub"], [data-sidebar="menu-action"], [data-sidebar="menu-badge"], ul ul'), function (n) { n.parentNode.removeChild(n); });
    var btn = clone.querySelector('[data-sidebar="menu-button"], a, button') || clone;
    btn.removeAttribute("href"); btn.removeAttribute("aria-current"); btn.removeAttribute("data-state"); btn.setAttribute("data-active", resellerPageOpen() ? "true" : "false");
    btn.setAttribute("role", "button"); btn.setAttribute("tabindex", "0");
    var svgs = btn.querySelectorAll("svg");
    if (svgs.length) { var tmp = document.createElement("div"); tmp.innerHTML = RS_ICON; var ns = tmp.firstChild; ns.setAttribute("class", svgs[0].getAttribute("class") || ""); svgs[0].parentNode.replaceChild(ns, svgs[0]);
      for (var k = 1; k < svgs.length; k++) if (svgs[k].parentNode) svgs[k].parentNode.removeChild(svgs[k]); }
    var lab = btn.querySelector("span, p");
    if (lab) lab.textContent = RS_LABEL; else btn.appendChild(document.createTextNode(RS_LABEL));
    function go(e) { e.preventDefault(); e.stopPropagation(); openResellerPage(); }
    btn.addEventListener("click", go, true);
    btn.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") go(e); });
    if (ref.parentNode) ref.parentNode.insertBefore(clone, ref.nextSibling);
  }
  /* any other sidebar item closes the reseller page (also when it points to the page you were on) */
  document.addEventListener("click", function (e) {
    if (!PAGE) return; var t = e.target && e.target.closest ? e.target.closest('[data-sidebar="menu-button"], [data-sidebar="menu-sub-button"], aside a, nav a') : null;
    if (t && !t.closest("#ch-rs-item")) closeResellerPage();
  }, true);

  /* ---------- 5) login page: "Owner access" with the CHOST owner key ---------- */
  var OWN_WORDS = ["دسترسی مالک", "owner access", "ورود مالک", "بازیابی دسترسی", "forgot password", "فراموشی رمز"].map(norm);
  function fmtKey(v) { var s = String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); if (s.indexOf("CH") === 0) s = s.slice(2); s = s.slice(0, 12); var p = []; for (var i = 0; i < s.length; i += 4) p.push(s.slice(i, i + 4)); return p.length ? "CH-" + p.join("-") : ""; }
  function strength(p) { var s = 0; if (p.length >= 4) s++; if (p.length >= 8) s++; if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++; if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++; return s; }
  function ownerDialog() {
    var pwField = function (f, ph) { return '<div class="pw"><input class="ltr" data-f="' + f + '" type="password" autocomplete="new-password" spellcheck="false" placeholder="' + ph + '"><button type="button" tabindex="-1" aria-label="نمایش رمز">' + IC.eye + "</button></div>"; };
    dialog({ cls: "chk", title: "دسترسی مالک", desc: "با کلید مالک، نام کاربری و رمز پنل را از نو تنظیم کنید. هر کلید 5 دقیقه اعتبار دارد و فقط یک بار کار می‌کند.", ok: "ثبت و ادامه",
      html: '<div class="stp"><i class="on"></i><i></i><i></i></div>' +
        '<div class="fld"><label>کلید مالک</label><div class="kbox"><input class="ltr" data-f="k" autocomplete="one-time-code" spellcheck="false" placeholder="CH-XXXX-XXXX-XXXX" maxlength="17"><button class="btn sm" type="button" data-f="paste">' + IC.paste + "<span>چسباندن</span></button></div></div>" +
        '<div class="fld"><label>نام کاربری</label><input class="ltr" data-f="u" autocomplete="username" spellcheck="false" value="admin"></div>' +
        '<div class="two"><div class="fld"><label>رمز جدید</label>' + pwField("p", "حداقل 4 کاراکتر") + '<div class="sm"><i><b data-f="bar"></b></i><span data-f="lvl"></span></div></div><div class="fld"><label>تکرار رمز</label>' + pwField("p2", "دوباره وارد کنید") + "</div></div>" +
        '<details><summary>کلید مالک را از کجا بگیرم؟</summary><ol><li>اگر وارد پنل هستید: بخش <b>کلیدهای API</b>، «دریافت کلید».</li><li>اگر وارد نمی‌شوید: سرویس را در Railway ری‌استارت کنید و در لاگ‌ها خط <code>OWNER KEY</code> را پیدا کنید.</li></ol></details>',
      onOpen: function (d) {
        var R = d.root, k = R.querySelector('[data-f="k"]'), p = R.querySelector('[data-f="p"]'), p2 = R.querySelector('[data-f="p2"]'), steps = R.querySelectorAll(".stp i");
        function prog() { var s = [fmtKey(k.value).length === 17, R.querySelector('[data-f="u"]').value.trim().length >= 3, p.value.length >= 4 && p.value === p2.value]; steps[1].classList.toggle("on", s[0]); steps[2].classList.toggle("on", s[0] && s[1] && s[2]); }
        k.addEventListener("input", function () { var c = k.selectionStart === k.value.length; k.value = fmtKey(k.value); if (c) k.selectionStart = k.selectionEnd = k.value.length; prog(); });
        R.querySelector('[data-f="paste"]').onclick = function () { try { navigator.clipboard.readText().then(function (t) { k.value = fmtKey(t); prog(); R.querySelector('[data-f="u"]').focus(); }).catch(function () { k.focus(); }); } catch (e) { k.focus(); } };
        var cols = ["#e5484d", "#f5a524", "#30a46c", "#30a46c"], names = ["ضعیف", "متوسط", "خوب", "قوی"];
        p.addEventListener("input", function () { var s = strength(p.value), b = R.querySelector('[data-f="bar"]'); b.style.width = (p.value ? Math.max(1, s) * 25 : 0) + "%"; b.style.background = cols[Math.max(0, s - 1)]; R.querySelector('[data-f="lvl"]').textContent = p.value ? names[Math.max(0, s - 1)] : ""; prog(); });
        p2.addEventListener("input", prog); R.querySelector('[data-f="u"]').addEventListener("input", prog);
        Array.prototype.forEach.call(R.querySelectorAll(".pw button"), function (b) { b.onclick = function () { var i = b.previousSibling, show = i.type === "password"; i.type = show ? "text" : "password"; b.innerHTML = show ? IC.eyeoff : IC.eye; }; });
      },
      onOk: function (d) {
        var R = d.root, key = fmtKey(R.querySelector('[data-f="k"]').value), u = R.querySelector('[data-f="u"]').value.trim(), p = R.querySelector('[data-f="p"]').value, p2 = R.querySelector('[data-f="p2"]').value;
        if (key.length !== 17) { d.error("کلید مالک کامل نیست (شکلش این‌طوری است: CH-XXXX-XXXX-XXXX)"); return false; }
        if (!/^[A-Za-z0-9_]{3,32}$/.test(u)) { d.error("نام کاربری فقط حروف انگلیسی، عدد و _ باشد (3 تا 32 کاراکتر)"); return false; }
        if (p.length < 4) { d.error("رمز جدید حداقل 4 کاراکتر باشد"); return false; }
        if (p !== p2) { d.error("تکرار رمز با رمز جدید یکی نیست"); return false; }
        return post("/chost/recover", { key: key, username: u, password: p }).then(function (x) {
          if (x[0] !== 200) { d.error(x[1].detail || "ثبت ممکن نشد"); return false; }
          d.close(); setTimeout(function () { ownerDone(u); }, 180); return false;
        });
      } });
  }
  function ownerDone(u) {
    dialog({ cls: "chk", title: "", ok: "ورود به پنل", cancel: false,
      html: '<div class="done"><div class="ok">' + IC.check + '</div><b>رمز پنل تنظیم شد</b><p>از این به بعد با نام کاربری <b class="ltr" style="display:inline;font-size:inherit"></b> و رمز جدید وارد شوید.</p></div>',
      onOpen: function (d) { d.root.querySelector("h2").style.display = "none"; d.root.querySelector(".done p b").textContent = u; },
      onOk: function () {
        var f = document.querySelector('input[name="username"], input[autocomplete="username"], form input[type="text"]');
        if (f) { var set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(f, u); f.dispatchEvent(new Event("input", { bubbles: true }));
          var pw = document.querySelector('form input[type="password"]'); if (pw) setTimeout(function () { pw.focus(); }, 200); }
        return true;
      } });
  }
  function onLoginPage() { return !findToken() && !!document.querySelector('input[type="password"]') && !document.querySelector('[data-sidebar="sidebar"]'); }
  function mountOwner() {
    if (!onLoginPage()) return;
    var cands = document.querySelectorAll("button, a, [role=button]"), hit = false;
    for (var i = 0; i < cands.length; i++) {
      var el = cands[i]; if (el.closest(".chd")) continue;
      if (OWN_WORDS.indexOf(norm(el.textContent)) > -1) { hit = true; if (!el.getAttribute("data-ch-own")) { el.setAttribute("data-ch-own", "1"); el.addEventListener("click", function (e) { e.preventDefault(); e.stopImmediatePropagation(); ownerDialog(); }, true); } }
    }
    if (hit || document.getElementById("ch-own-link")) return;
    var form = document.querySelector('form input[type="password"]'); form = form && form.closest("form"); if (!form) return;
    ucss(); var w = document.createElement("div"); w.id = "ch-own-link"; w.className = "chx"; w.dir = "rtl"; themeVars(w);
    w.style.cssText = "text-align:center;margin-top:14px;font-size:13px";
    w.innerHTML = '<a role="button" tabindex="0" style="cursor:pointer;color:var(--ch-mf);text-decoration:underline;text-underline-offset:4px">دسترسی مالک</a>';
    w.firstChild.onclick = ownerDialog; w.firstChild.onkeydown = function (e) { if (e.key === "Enter") ownerDialog(); };
    form.parentNode.insertBefore(w, form.nextSibling);
  }


  /* ---------- 6) Settings page: "ربات فروش" card (owner only) ---------- */
  var BCSS = ".chb{margin:0 0 16px;padding:20px;background:var(--ch-card);border:1px solid var(--ch-bd);border-radius:calc(var(--ch-r) + 4px)}" +
    ".chb .top{display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap;margin-bottom:18px}" +
    ".chb .lg{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;background:#229ed9;color:#fff;flex:none}.chb .lg svg{width:22px;height:22px}" +
    ".chb .tt{flex:1;min-width:200px}.chb .tt b{display:block;font-size:16px;font-weight:600}.chb .tt p{margin:3px 0 0;font-size:13.5px;color:var(--ch-mf);line-height:1.7}" +
    ".chb .pill{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;padding:4px 11px;border-radius:999px;white-space:nowrap}" +
    ".chb .pill i{width:7px;height:7px;border-radius:50%;background:currentColor}" +
    ".chb .pill.on{color:#30a46c;background:rgba(48,164,108,.12)}.chb .pill.off{color:var(--ch-mf);background:var(--ch-mu)}.chb .pill.bad{color:#e5484d;background:rgba(229,72,77,.12)}" +
    ".chb .kp{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:18px}@media(max-width:700px){.chb .kp{grid-template-columns:repeat(2,minmax(0,1fr))}}" +
    ".chb .kp div{border:1px solid var(--ch-bd);border-radius:var(--ch-r);padding:10px 12px;min-width:0}.chb .kp span{font-size:12px;color:var(--ch-mf)}" +
    ".chb .kp b{display:block;font-size:17px;font-weight:700;margin-top:2px;direction:ltr;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
    ".chb .sw{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border:1px solid var(--ch-bd);border-radius:var(--ch-r);margin-bottom:14px}" +
    ".chb .sw b{font-size:14px;font-weight:500}.chb .sw small{display:block;font-size:12.5px;color:var(--ch-mf);margin-top:2px}" +
    ".chb .tg{position:relative;width:42px;height:24px;border-radius:999px;background:var(--ch-mu);border:1px solid var(--ch-bd);cursor:pointer;flex:none;transition:background .2s}" +
    ".chb .tg::after{content:'';position:absolute;top:2px;right:2px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:transform .2s}" +
    ".chb .tg.on{background:var(--ch-pr);border-color:transparent}.chb .tg.on::after{transform:translateX(-18px)}" +
    ".chb .two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}@media(max-width:640px){.chb .two{grid-template-columns:minmax(0,1fr)}}" +
    ".chb .pw{position:relative}.chb .pw input{padding-inline-end:40px}.chb .pw button{position:absolute;top:4px;inset-inline-end:4px;width:28px;height:28px;border:0;background:transparent;color:var(--ch-mf);cursor:pointer;display:grid;place-items:center;border-radius:6px}.chb .pw button svg{width:16px;height:16px}" +
    ".chb .acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}.chb .acts .sp{flex:1}" +
    ".chb .note{margin-top:14px;font-size:12.5px;color:var(--ch-mf);line-height:1.9;border-top:1px dashed var(--ch-bd);padding-top:12px}";
  var TG_ICON = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.9 4.3 18.7 19.4c-.2 1.1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.4-5 9.1-8.2c.4-.4-.1-.6-.6-.2L6.2 13 1.4 11.5c-1-.3-1-1 .2-1.5L20.6 2.8c.9-.3 1.6.2 1.3 1.5Z"/></svg>';
  var botTimer = null;
  function mountBot() {
    var old = document.getElementById("ch-bot");
    if (OWNER !== true) { if (old && old.parentNode) old.parentNode.removeChild(old); return; }
    if (old && document.body.contains(old)) return;
    var h = heading(["تنظیمات", "settings", "تنظیمات عمومی", "general settings"].map(norm), /settings/i); if (!h) return;
    bcss();
    var box = document.createElement("section"); box.id = "ch-bot"; box.className = "chx chb"; box.dir = "rtl"; themeVars(box);
    box.innerHTML =
      '<div class="top"><div class="lg">' + TG_ICON + '</div><div class="tt"><b>ربات فروش تلگرام</b><p>فروش خودکار اشتراک در تلگرام: کاربر پلن را انتخاب می‌کند، مبلغ را کارت‌به‌کارت می‌کند و رسید را می‌فرستد. پس از تأیید شما، اشتراک به‌صورت خودکار ساخته و برای کاربر ارسال می‌شود. پلن‌ها، قیمت‌ها و شماره کارت از داخل ربات با دستور /admin مدیریت می‌شوند.</p></div><span class="pill off" data-b="pill"><i></i><span>خاموش</span></span></div>' +
      '<div class="kp"><div><span>فروش امروز</span><b data-k="sales_today">0</b></div><div><span>درآمد امروز</span><b data-k="revenue_today">0</b></div><div><span>کل فروش</span><b data-k="sales">0</b></div><div><span>رسید در انتظار</span><b data-k="pending">0</b></div></div>' +
      '<div class="sw"><div><b>فعال بودن ربات</b><small>در حالت خاموش، ربات به هیچ پیامی پاسخ نمی‌دهد.</small></div><button class="tg" type="button" role="switch" aria-checked="false" data-b="en"></button></div>' +
      '<div class="two"><div class="fld"><label>توکن ربات</label><div class="pw"><input class="ltr" data-b="tok" type="password" autocomplete="off" spellcheck="false" placeholder="123456789:AA…"><button type="button" tabindex="-1" aria-label="نمایش">' + IC.eye + '</button></div><div class="hint">از ربات @BotFather دریافت کنید.</div></div>' +
      '<div class="fld"><label>آیدی عددی ادمین</label><input class="ltr" data-b="adm" inputmode="numeric" autocomplete="off" spellcheck="false" placeholder="123456789"><div class="hint">از ربات @userinfobot دریافت کنید. چند ادمین را با کاما جدا کنید.</div></div></div>' +
      '<div class="err" data-b="err"></div>' +
      '<div class="acts"><button class="btn pri" type="button" data-b="save">ذخیره</button><button class="btn" type="button" data-b="test">ارسال پیام آزمایشی</button><span class="sp"></span><a class="btn" data-b="open" target="_blank" rel="noopener" style="display:none">' + TG_ICON + '<span>باز کردن ربات</span></a></div>' +
      '<div class="note">پس از ذخیره، ربات را در تلگرام Start کنید و دستور /admin را بفرستید. منوی مدیریت شامل پلن‌ها و قیمت‌ها، اطلاعات پرداخت، کدهای تخفیف، اکانت تست رایگان، متن‌ها، کانال و عضویت اجباری، رسیدهای در انتظار، پیام همگانی، بکاپ کامل و باز و بسته کردن فروش است. یادآوری تمدید و بکاپ روزانه به‌صورت خودکار انجام می‌شوند.</div>';
    if (!place(box, h)) return;
    var $b = function (k) { return box.querySelector('[data-b="' + k + '"]'); }, en = $b("en"), tok = $b("tok"), adm = $b("adm"), err = $b("err");
    function setEn(v) { en.classList.toggle("on", v); en.setAttribute("aria-checked", v ? "true" : "false"); }
    en.onclick = function () { setEn(!en.classList.contains("on")); };
    box.querySelector(".pw button").onclick = function () { var show = tok.type === "password"; tok.type = show ? "text" : "password"; this.innerHTML = show ? IC.eyeoff : IC.eye; };
    function showErr(m) { err.textContent = m || ""; err.classList.toggle("on", !!m); }
    function paint(v, fill) {
      var pill = $b("pill"), cls = v.running ? "on" : (v.enabled && v.error ? "bad" : "off");
      pill.className = "pill " + cls; pill.lastChild.textContent = v.running ? "آنلاین" + (v.username ? " · @" + v.username : "") : (v.enabled ? (v.error ? "خطا" : "در حال اتصال…") : "خاموش");
      if (v.enabled && v.error && !v.running) showErr(v.error);
      var s = v.stats || {};
      ["sales_today", "sales", "pending"].forEach(function (k) { box.querySelector('[data-k="' + k + '"]').textContent = s[k] || 0; });
      box.querySelector('[data-k="revenue_today"]').textContent = (s.revenue_today || 0).toLocaleString("en-US");
      var op = $b("open"); if (v.username) { op.href = "https://t.me/" + v.username; op.style.display = ""; } else op.style.display = "none";
      if (fill) { setEn(!!v.enabled); tok.value = v.token_mask || ""; adm.value = (v.admins || []).join(", "); }
    }
    function load(fill) { return post("/chost/bot", {}, findToken()).then(function (x) { if (x[0] === 200) paint(x[1], fill); }).catch(function () {}); }
    $b("save").onclick = function () {
      var b = this; showErr(""); b.disabled = true; b.textContent = "…";
      post("/chost/bot/save", { enabled: en.classList.contains("on"), token: tok.value.trim(), admins: adm.value }, findToken()).then(function (x) {
        b.disabled = false; b.textContent = "ذخیره";
        if (x[0] !== 200) return showErr(x[1].detail || "ذخیره نشد");
        paint(x[1], true); toast(x[1].enabled ? "تنظیمات ذخیره شد. ربات تا چند ثانیه‌ی دیگر آنلاین می‌شود" : "تنظیمات ذخیره شد. ربات خاموش است");
        setTimeout(function () { load(false); }, 6000);
      }).catch(function () { b.disabled = false; b.textContent = "ذخیره"; showErr("ارتباط با سرور برقرار نشد"); });
    };
    $b("test").onclick = function () {
      var b = this; showErr(""); b.disabled = true;
      post("/chost/bot/test", {}, findToken()).then(function (x) { b.disabled = false; if (x[0] !== 200) return showErr(x[1].detail || "ارسال نشد"); toast("پیام آزمایشی برای " + x[1].sent + " ادمین ارسال شد"); })
        .catch(function () { b.disabled = false; showErr("ارتباط با سرور برقرار نشد"); });
    };
    load(true);
    clearInterval(botTimer);
    botTimer = setInterval(function () { if (!document.body.contains(box)) { clearInterval(botTimer); return; } load(false); }, 15000);
  }


  /* ---------- 7) replace PasarGuard's "support / donate" popup with the panel creator card ---------- */
  var CREATOR = { name: "CHOST", channel: "CHOST543" };
  var DONATE_RE = /حمایت مالی|حمایت کنید|حمایت از ما|دونیت|کمک مالی|donat|support us|sponsor|buy me a coffee|crypto|tether|usdt/i;
  function closeNative(dlg) {
    try { dlg.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, bubbles: true })); } catch (e) {}
    setTimeout(function () {
      if (!document.body.contains(dlg)) return;
      var root = dlg.parentElement; dlg.style.display = "none";
      if (root) Array.prototype.forEach.call(root.children, function (c) { if (c !== dlg && /fixed/.test(getComputedStyle(c).position) && !c.closest(".chx")) c.style.display = "none"; });
      document.body.style.pointerEvents = ""; document.body.style.overflow = ""; document.body.removeAttribute("data-scroll-locked");
    }, 250);
  }
  function creatorCard() {
    try { if (sessionStorage.getItem("ch-creator-shown")) return; sessionStorage.setItem("ch-creator-shown", "1"); } catch (e) {}
    var link = "https://t.me/" + CREATOR.channel;
    dialog({ cls: "chk", title: "", ok: TG_ICON + "<span>عضویت در کانال</span>", cancel: "بستن",
      html: '<div class="done" style="padding-top:4px"><div class="ok" style="background:linear-gradient(135deg,#f5dc9c,#a47c32);color:#0b0b0b;width:72px;height:72px;border-radius:20px">' +
        '<svg viewBox="0 0 32 32" style="width:38px;height:38px;stroke-dasharray:none;animation:none"><path d="M16 3C9.6 3 5.5 7.8 5.5 14v14l3.5-2.5 3.5 2.5 3.5-2.5 3.5 2.5 3.5-2.5 3.5 2.5V14C26.5 7.8 22.4 3 16 3Z" fill="#0b0b0b"/><path d="M10.5 14.5c.8-1.3 2.6-1.3 3.4 0M18.1 14.5c.8-1.3 2.6-1.3 3.4 0" stroke="#f5dc9c" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg></div>' +
        '<b>سازنده پنل: <span class="ltr" style="letter-spacing:3px"></span></b><p>این پنل اختصاصی توسط <b class="ltr" style="display:inline;font-size:inherit"></b> ساخته و پشتیبانی می‌شود.<br>برای اطلاع از آپدیت‌ها، آموزش‌ها و پشتیبانی، عضو کانال رسمی شوید.</p>' +
        '<p style="margin-top:12px"><a class="ltr" target="_blank" rel="noopener" style="font-weight:700;color:inherit;text-decoration:none;padding:6px 14px;border:1px solid var(--ch-bd);border-radius:999px;display:inline-block"></a></p></div>',
      onOpen: function (d) {
        d.root.querySelector("h2").style.display = "none";
        var spans = d.root.querySelectorAll(".done .ltr"); spans[0].textContent = CREATOR.name; spans[1].textContent = CREATOR.name;
        var a = d.root.querySelector(".done a"); a.href = link; a.textContent = "@" + CREATOR.channel;
      },
      onOk: function () { window.open(link, "_blank", "noopener"); return true; } });
  }
  function killDonate() {
    var ds = document.querySelectorAll('[role="dialog"], [role="alertdialog"]');
    for (var i = 0; i < ds.length; i++) {
      var d = ds[i]; if (d.closest(".chx") || d.getAttribute("data-ch-killed")) continue;
      if (DONATE_RE.test(d.textContent || "")) { d.setAttribute("data-ch-killed", "1"); closeNative(d); if (findToken()) setTimeout(creatorCard, 350); }
    }
  }
  var creatorQueued = false;
  function greet() {   /* once per login session, right after the dashboard is ready */
    if (creatorQueued || !findToken() || !document.querySelector('[data-sidebar="sidebar"], aside')) return;
    try { if (sessionStorage.getItem("ch-creator-shown")) return; } catch (e) { return; }
    creatorQueued = true; setTimeout(function () { creatorQueued = false; if (!document.querySelector(".chd")) creatorCard(); }, 1200);
  }

  /* ---------- run + keep up with page changes ---------- */
  var queued = false;
  function brand() { if (document.title.indexOf("CHOST") !== 0) document.title = "CHOST Panel"; }
  function tick() { try { brand(); killDonate(); greet(); whoAmI(); sweep(); mountResellers(); mountOwner(); mountKey(); mountBot(); mountPass(); } catch (e) { /* never break the panel */ } }
  function schedule() { if (queued) return; queued = true; requestAnimationFrame(function () { queued = false; tick(); }); }
  function start() { tick(); new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true }); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
