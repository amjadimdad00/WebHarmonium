const CACHE_NAME = "web-harmonium";
const ASSETS = [
  "/index.html",
  "/style.css",
  "/app.js",
  "/harmonium-sample.wav",
  "/reverb.wav",
];

// Install event: cache all files
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(ASSETS.map((asset) => cache.add(asset)));
    }),
  );
});

// Fetch event: respond with cached files if available
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedRes) => {
      return cachedRes || fetch(event.request);
    }),
  );
});

// Activate event: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
});
