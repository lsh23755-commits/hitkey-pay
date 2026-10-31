// 화면 파일(HTML/CSS/JS)만 캐시한다.
// Supabase(다른 도메인)와 /api/ 요청(Gemini)은 가로채지 않아 항상 인터넷으로 나간다.
const CACHE = "heatkey-ui-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== "GET") return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  const isUi =
    req.mode === "navigate" ||
    req.destination === "script" ||
    req.destination === "style";
  if (!isUi) return;

  // 네트워크 우선, 오프라인이면 캐시된 화면 파일로 응답
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
