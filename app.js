/* Popcorn Diary — vanilla JS + Supabase */
(() => {
"use strict";

const PLATFORMS = ["Netflix","Disney+ Hotstar","Prime Video","HBO Max","Viu","iQIYI","WeTV","YouTube","MONOMAX","TrueID","Apple TV+","Bilibili","อื่นๆ"];
const CINEMAS = ["Major Cineplex","SF Cinema","SF World Cinema","Paragon Cineplex","Quartier CineArt","Icon Cineconic","House Samyan","Doc Club & Pub","Bangkok Screening Room"];
const BUCKET = "posters";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));

/* ---------- setup ---------- */
const cfg = window.POPCORN_CONFIG || {};
const configured = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_URL.includes("YOUR-") && !cfg.SUPABASE_ANON_KEY.includes("YOUR-");
if (!configured || !window.supabase) { $("#setupView").hidden = false; return; }

const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

let user = null, entries = [], loading = true;
const signed = {};               // poster_path -> signed URL
const F = { type: "all", where: "all", q: "", sort: "recent" };

/* ---------- helpers ---------- */
const pad = (n) => String(n).padStart(2, "0");
function today() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function nowTime() { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function parseDate(e) {
  if (!e.date) return null;
  const [y, m, d] = e.date.split("-").map(Number);
  const [h, mi] = (e.time || "00:00").split(":").map(Number);
  return new Date(y, m - 1, d, h || 0, mi || 0);
}
const sortKey = (e) => (e.date || "") + "T" + (e.time || "");
function fmtDate(e) { const d = parseDate(e); return d ? d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" }) : "–"; }
function fmtDateLong(e) { const d = parseDate(e); return d ? d.toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "–"; }
const fmtTime = (e) => (e.time ? e.time + " น." : "");
const monthKey = (e) => (e.date ? e.date.slice(0, 7) : "0000-00");
function monthLabel(k) {
  if (k === "0000-00") return "ไม่ระบุวันที่";
  const [y, m] = k.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("th-TH", { month: "long", year: "numeric" });
}
function hue(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 6; }
function stars(r) { r = Math.round(r || 0); return `<span class="stars" aria-label="${r} จาก 5 ดาว">${"★".repeat(r)}<span class="off">${"★".repeat(5 - r)}</span></span>`; }
const placeLabel = (e) => (e.where === "cinema" ? e.cinema || "โรงหนัง" : e.platform || "ออนไลน์");
const posterSrc = (e) => (e.poster_path ? signed[e.poster_path] || "" : "");

function posterHTML(e) {
  const src = posterSrc(e);
  const ph = `<div class="ph pc${hue(e.title)}"><i>${e.type === "series" ? "SERIES" : "MOVIE"}</i><strong>${esc(e.title)}</strong></div>`;
  const img = src ? `<img class="pimg" src="${esc(src)}" alt="โปสเตอร์ ${esc(e.title)}" loading="lazy" onerror="this.remove()">` : "";
  return `<div class="poster">${ph}${img}<span class="tag">${e.type === "series" ? "ซีรีส์" : "หนัง"}</span></div>`;
}
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 2600); }
function note(text) { const n = $("#note"); n.hidden = !text; n.textContent = text || ""; }

/* row <-> entry */
const fromRow = (r) => ({
  id: r.id, title: r.title, type: r.type, episode: r.episode || "", where: r.watch_where,
  platform: r.platform || "", cinema: r.cinema || "", seat: r.seat || "",
  date: r.watched_date || "", time: r.watched_time ? r.watched_time.slice(0, 5) : "",
  rating: r.rating || 0, review: r.review || "", poster_path: r.poster_path || null,
});

/* ---------- data ---------- */
async function load() {
  const { data, error } = await sb.from("movies").select("*")
    .order("watched_date", { ascending: false, nullsFirst: false });
  loading = false;
  if (error) { note("โหลดข้อมูลไม่ได้ ตรวจการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่"); render(); return; }
  note("");
  entries = data.map(fromRow);
  await signPosters();
  render();
}
async function signPosters() {
  const paths = entries.map((e) => e.poster_path).filter((p) => p && !signed[p]);
  if (!paths.length) return;
  const { data } = await sb.storage.from(BUCKET).createSignedUrls(paths, 60 * 60 * 24 * 7);
  (data || []).forEach((x) => { if (x.signedUrl && x.path) signed[x.path] = x.signedUrl; });
}

/* ---------- render ---------- */
function filtered() {
  const q = F.q.trim().toLowerCase();
  const list = entries.filter((e) =>
    (F.type === "all" || e.type === F.type) &&
    (F.where === "all" || e.where === F.where) &&
    (!q || [e.title, e.platform, e.cinema, e.review, e.episode].some((v) => String(v || "").toLowerCase().includes(q))));
  if (F.sort === "rating") list.sort((a, b) => (b.rating || 0) - (a.rating || 0) || sortKey(b).localeCompare(sortKey(a)));
  else if (F.sort === "title") list.sort((a, b) => String(a.title).localeCompare(String(b.title), "th"));
  else list.sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
  return list;
}
function renderStats() {
  const n = entries.length, mk = today().slice(0, 7);
  const month = entries.filter((e) => monthKey(e) === mk).length;
  const rated = entries.filter((e) => e.rating);
  const avg = rated.length ? (rated.reduce((s, e) => s + e.rating, 0) / rated.length).toFixed(1) : "–";
  const cin = entries.filter((e) => e.where === "cinema").length;
  const counts = {};
  entries.filter((e) => e.where === "online" && e.platform).forEach((e) => (counts[e.platform] = (counts[e.platform] || 0) + 1));
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  $("#stats").innerHTML = `
   <div class="stat s1"><small>ดูไปแล้ว</small><b>${n}</b><small>เรื่อง</small></div>
   <div class="stat s2"><small>เดือนนี้</small><b>${month}</b><small>เรื่อง</small></div>
   <div class="stat s3"><small>คะแนนเฉลี่ย</small><b>${avg}${avg !== "–" ? " ★" : ""}</b><small>จาก ${rated.length} เรื่องที่ให้คะแนน</small></div>
   <div class="stat s4"><small>โรงหนัง / ออนไลน์</small><b>${cin} / ${n - cin}</b><small>${top ? "ดูบ่อยสุด: " + esc(top[0]) : "ยังไม่มีแพลตฟอร์มประจำ"}</small></div>`;
}
function cardHTML(e) {
  return `<button class="card" type="button" data-id="${esc(e.id)}">${posterHTML(e)}
    <span class="c-title">${esc(e.title)}</span>
    <span class="c-meta">${stars(e.rating)}</span>
    <span class="c-meta"><span class="chip ${e.where === "cinema" ? "cin" : "on"}">${e.where === "cinema" ? "🎟" : "▶"} ${esc(placeLabel(e))}</span>${esc(fmtDate(e))}</span>
  </button>`;
}
function render() {
  renderStats();
  const L = $("#list");
  L.removeAttribute("style");
  if (loading) { L.innerHTML = `<div class="empty"><h2>กำลังเปิดสมุด...</h2><p>กำลังโหลดเรื่องที่บันทึกไว้</p></div>`; return; }
  if (!entries.length) {
    L.innerHTML = `<div class="empty"><h2>ยังไม่มีเรื่องที่บันทึกไว้</h2><p>ดูหนังหรือซีรีส์เรื่องไหนมา กด “บันทึกเรื่องใหม่” แล้วใส่โปสเตอร์ คะแนน กับรีวิวได้เลย</p><button class="btn btn-pink" type="button" data-add>＋ บันทึกเรื่องแรก</button></div>`;
    return;
  }
  const list = filtered();
  if (!list.length) { L.innerHTML = `<div class="empty"><h2>ไม่พบเรื่องที่ตรงกับตัวกรอง</h2><p>ลองเปลี่ยนคำค้นหรือเลือก “ทั้งหมด”</p></div>`; return; }
  if (F.sort === "recent") {
    const groups = new Map();
    list.forEach((e) => { const k = monthKey(e); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(e); });
    L.innerHTML = [...groups].map(([k, arr]) =>
      `<section class="shelf"><div class="shelf-head"><h2>${esc(monthLabel(k))}</h2><span>${arr.length} เรื่อง</span></div><div class="grid">${arr.map(cardHTML).join("")}</div></section>`).join("");
    L.style.cssText = "display:flex;flex-direction:column;gap:28px";
  } else {
    L.innerHTML = `<div class="grid">${list.map(cardHTML).join("")}</div>`;
  }
}

/* ---------- toolbar ---------- */
function bindSeg(id, key) {
  $(id).addEventListener("click", (ev) => {
    const b = ev.target.closest("button"); if (!b) return;
    F[key] = b.dataset.v;
    $(id).querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b));
    render();
  });
}
bindSeg("#fType", "type"); bindSeg("#fWhere", "where");
$("#q").addEventListener("input", (e) => { F.q = e.target.value; render(); });
$("#sort").addEventListener("change", (e) => { F.sort = e.target.value; render(); });
$("#list").addEventListener("click", (ev) => {
  if (ev.target.closest("[data-add]")) return openForm();
  const c = ev.target.closest(".card"); if (c) openView(c.dataset.id);
});

/* ---------- form ---------- */
const formDlg = $("#formDlg"), form = $("#form");
let editing = null, rating = 0, pending = null, removePoster = false;
$("#fPlat").innerHTML = PLATFORMS.map((p) => `<option>${esc(p)}</option>`).join("");
$("#cinemas").innerHTML = CINEMAS.map((c) => `<option value="${esc(c)}">`).join("");
const setPick = (id, v) => $(id).querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === v));
const getPick = (id) => $(id).querySelector('[aria-pressed="true"]').dataset.v;
function syncForm() {
  const w = getPick("#pWhere");
  $("#onWrap").hidden = w !== "online";
  $("#cinWrap").hidden = w !== "cinema";
  $("#platOtherWrap").hidden = !(w === "online" && $("#fPlat").value === "อื่นๆ");
  $("#epWrap").hidden = getPick("#pType") !== "series";
}
["#pType", "#pWhere"].forEach((id) => $(id).addEventListener("click", (ev) => {
  const b = ev.target.closest("button"); if (!b) return; setPick(id, b.dataset.v); syncForm();
}));
$("#fPlat").addEventListener("change", syncForm);
function drawRate() {
  $("#rate").innerHTML = [1, 2, 3, 4, 5].map((i) => `<button type="button" data-v="${i}" class="${i <= rating ? "on" : ""}" aria-label="${i} ดาว">★</button>`).join("") +
    `<span>${rating ? rating + " / 5" : "ยังไม่ให้คะแนน"}</span>`;
}
$("#rate").addEventListener("click", (ev) => { const b = ev.target.closest("button"); if (!b) return; const v = +b.dataset.v; rating = rating === v ? 0 : v; drawRate(); });
function showPrev(src) { $("#pPrev").innerHTML = src ? `<img src="${esc(src)}" alt="">` : "ยังไม่มีรูป"; $("#pRemove").hidden = !src; }
$("#fPoster").addEventListener("change", async (ev) => {
  const f = ev.target.files[0]; ev.target.value = ""; if (!f) return;
  try { const blob = await shrink(f, 720, 0.85); pending = { blob, url: URL.createObjectURL(blob) }; removePoster = false; showPrev(pending.url); }
  catch { toast("อ่านไฟล์รูปนี้ไม่ได้ ลองใช้ไฟล์ JPG หรือ PNG"); }
});
$("#pRemove").addEventListener("click", () => { pending = null; removePoster = true; showPrev(""); });
function shrink(file, maxW, q) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, maxW / img.width);
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => (b ? res(b) : rej()), "image/jpeg", q);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}

function openForm(e) {
  editing = e || null; pending = null; removePoster = false; $("#formErr").hidden = true;
  $("#formTitle").textContent = e ? "แก้ไขบันทึก" : "บันทึกเรื่องใหม่";
  $("#fTitle").value = e?.title || ""; $("#fEp").value = e?.episode || "";
  $("#fDate").value = e ? e.date : today(); $("#fTime").value = e ? e.time : nowTime();
  setPick("#pType", e?.type || "movie"); setPick("#pWhere", e?.where || "online");
  const known = PLATFORMS.includes(e?.platform);
  $("#fPlat").value = e?.platform ? (known ? e.platform : "อื่นๆ") : "Netflix";
  $("#fPlatOther").value = e?.platform && !known ? e.platform : "";
  $("#fCinema").value = e?.cinema || ""; $("#fSeat").value = e?.seat || "";
  rating = e?.rating || 0; drawRate(); $("#fReview").value = e?.review || "";
  showPrev(e ? posterSrc(e) : ""); syncForm();
  formDlg.showModal(); $("#fTitle").focus();
}
$("#addBtn").addEventListener("click", () => openForm());
document.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));
[formDlg, $("#viewDlg")].forEach((d) => d.addEventListener("click", (ev) => { if (ev.target === d) d.close(); }));

form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const title = $("#fTitle").value.trim(), err = $("#formErr");
  if (!title) { err.textContent = "ใส่ชื่อเรื่องก่อนนะ"; err.hidden = false; $("#fTitle").focus(); return; }
  const where = getPick("#pWhere"), type = getPick("#pType");
  let platform = $("#fPlat").value;
  if (platform === "อื่นๆ") platform = $("#fPlatOther").value.trim() || "อื่นๆ";
  const row = {
    title, type, rating,
    episode: type === "series" ? $("#fEp").value.trim() || null : null,
    watch_where: where,
    platform: where === "online" ? platform : null,
    cinema: where === "cinema" ? $("#fCinema").value.trim() || null : null,
    seat: where === "cinema" ? $("#fSeat").value.trim() || null : null,
    watched_date: $("#fDate").value || null,
    watched_time: $("#fTime").value || null,
    review: $("#fReview").value.trim() || null,
    poster_path: editing?.poster_path || null,
    updated_at: new Date().toISOString(),
  };
  const btn = $("#saveBtn"); btn.disabled = true; btn.textContent = "กำลังบันทึก...";
  const oldPath = editing?.poster_path || null;
  try {
    if (removePoster) row.poster_path = null;
    if (pending) {
      const path = `${user.id}/${crypto.randomUUID()}.jpg`;
      const { error } = await sb.storage.from(BUCKET).upload(path, pending.blob, { contentType: "image/jpeg", upsert: false });
      if (error) throw error;
      row.poster_path = path; signed[path] = pending.url;
    }
    const q = editing ? sb.from("movies").update(row).eq("id", editing.id) : sb.from("movies").insert(row);
    const { error } = await q;
    if (error) throw error;
    if (oldPath && oldPath !== row.poster_path) sb.storage.from(BUCKET).remove([oldPath]);
    formDlg.close();
    toast(editing ? "บันทึกการแก้ไขแล้ว" : `เพิ่ม “${title}” แล้ว`);
    await load();
  } catch (e) {
    console.error(e);
    err.textContent = "บันทึกไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง";
    err.hidden = false;
  } finally { btn.disabled = false; btn.textContent = "บันทึก"; }
});

/* ---------- detail ---------- */
function openView(id) {
  const e = entries.find((x) => x.id === id); if (!e) return;
  const rows = [["วันที่", fmtDateLong(e)], fmtTime(e) && ["เวลา", fmtTime(e)],
    [e.where === "cinema" ? "โรงหนัง" : "แพลตฟอร์ม", placeLabel(e)], e.seat && ["ที่นั่ง", e.seat], e.episode && ["ซีซั่น / ตอน", e.episode]].filter(Boolean);
  const v = $("#viewBody");
  v.innerHTML = `<div class="detail">${posterHTML(e)}
    <div class="info">
      <div class="dlg-head" style="align-items:flex-start"><h2>${esc(e.title)}</h2><button class="x" type="button" data-x aria-label="ปิด">×</button></div>
      <div class="c-meta"><span class="chip ${e.where === "cinema" ? "cin" : "on"}">${e.where === "cinema" ? "🎟 ดูที่โรง" : "▶ ดูออนไลน์"}</span>${stars(e.rating)}</div>
      <dl class="ticket">${rows.map(([k, val]) => `<dt>${esc(k)}</dt><dd>${esc(val)}</dd>`).join("")}</dl>
      <p class="review ${e.review ? "" : "none"}">${e.review ? esc(e.review) : "ยังไม่ได้เขียนรีวิว"}</p>
      <div class="dlg-foot"><button class="btn btn-danger" type="button" data-del>ลบ</button><div class="r"><button class="btn btn-pink" type="button" data-edit>แก้ไข</button></div></div>
    </div></div>`;
  v.querySelector("[data-x]").onclick = () => $("#viewDlg").close();
  v.querySelector("[data-edit]").onclick = () => { $("#viewDlg").close(); openForm(e); };
  const del = v.querySelector("[data-del]");
  del.onclick = async () => {
    if (!del.dataset.armed) {
      del.dataset.armed = "1"; del.textContent = "กดอีกครั้งเพื่อยืนยันการลบ";
      setTimeout(() => { if (del.isConnected) { delete del.dataset.armed; del.textContent = "ลบ"; } }, 4000);
      return;
    }
    del.disabled = true;
    const { error } = await sb.from("movies").delete().eq("id", e.id);
    if (error) { del.disabled = false; toast("ลบไม่สำเร็จ ลองอีกครั้ง"); return; }
    if (e.poster_path) sb.storage.from(BUCKET).remove([e.poster_path]);
    $("#viewDlg").close(); toast(`ลบ “${e.title}” แล้ว`);
    entries = entries.filter((x) => x.id !== e.id); render();
  };
  $("#viewDlg").showModal();
}

/* ---------- auth ---------- */
function showAuthMsg(errText, okText) {
  $("#authErr").hidden = !errText; $("#authErr").textContent = errText || "";
  $("#authOk").hidden = !okText; $("#authOk").textContent = okText || "";
}
function authErrorText(error) {
  const m = (error && error.message) || "";
  if (/Invalid login/i.test(m)) return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
  if (/Email not confirmed/i.test(m)) return "ยังไม่ได้ยืนยันอีเมล เปิดลิงก์ในอีเมลก่อน แล้วค่อยเข้าสู่ระบบ";
  if (/already registered/i.test(m)) return "อีเมลนี้สมัครไว้แล้ว ลองเข้าสู่ระบบแทน";
  if (/Password/i.test(m)) return "รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร";
  return "ทำรายการไม่สำเร็จ ลองอีกครั้ง";
}
function creds() {
  const email = $("#aEmail").value.trim(), password = $("#aPass").value;
  if (!email || password.length < 6) { showAuthMsg("ใส่อีเมล และรหัสผ่านอย่างน้อย 6 ตัวอักษร"); return null; }
  return { email, password };
}
$("#authForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const c = creds(); if (!c) return;
  $("#signInBtn").disabled = true;
  const { error } = await sb.auth.signInWithPassword(c);
  $("#signInBtn").disabled = false;
  if (error) showAuthMsg(authErrorText(error));
});
$("#signUpBtn").addEventListener("click", async () => {
  const c = creds(); if (!c) return;
  $("#signUpBtn").disabled = true;
  const { data, error } = await sb.auth.signUp({ ...c, options: { emailRedirectTo: location.href.split("#")[0] } });
  $("#signUpBtn").disabled = false;
  if (error) return showAuthMsg(authErrorText(error));
  if (!data.session) showAuthMsg("", "สมัครแล้ว เปิดอีเมลเพื่อกดยืนยัน จากนั้นกลับมาเข้าสู่ระบบ");
});
$("#signOutBtn").addEventListener("click", () => sb.auth.signOut());

function applySession(session) {
  const next = session?.user || null;
  const changed = next?.id !== user?.id;
  user = next;
  $("#authView").hidden = !!user;
  $("#appView").hidden = !user;
  if (!user) { entries = []; return; }
  $("#who").textContent = user.email || "";
  // setTimeout: อย่าเรียก Supabase ตรงๆ ใน onAuthStateChange (อาจค้างได้)
  if (changed) { loading = true; render(); setTimeout(load, 0); }
}
sb.auth.onAuthStateChange((_ev, session) => applySession(session));
sb.auth.getSession().then(({ data }) => applySession(data.session));

// โหลดใหม่เมื่อกลับมาที่แอป (เช่น บันทึกจาก Mac แล้วเปิดมือถือ)
document.addEventListener("visibilitychange", () => { if (!document.hidden && user) load(); });
})();
