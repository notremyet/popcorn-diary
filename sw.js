// Service worker: เก็บไฟล์หน้าแอปไว้ให้เปิดได้เร็ว (ข้อมูลหนังยังโหลดจาก Supabase ทุกครั้ง)
// เปลี่ยนเลขเวอร์ชันทุกครั้งที่แก้ไฟล์ เพื่อให้มือถือโหลดของใหม่
const CACHE = "popcorn-v1";
const SHELL = [
  "./", "index.html", "style.css", "app.js", "config.js", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png", "icons/favicon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // ไม่แคชคำขอไป Supabase (ข้อมูลและรูปโปสเตอร์)
  if (url.hostname.endsWith("supabase.co")) return;
  const cacheable = url.origin === location.origin ||
    url.hostname === "cdn.jsdelivr.net" || url.hostname.endsWith("gstatic.com") || url.hostname === "fonts.googleapis.com";
  if (!cacheable) return;
  // network first: ได้ไฟล์ใหม่เมื่อมีเน็ต และใช้ของในแคชเมื่อออฟไลน์
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match("index.html")))
  );
});
