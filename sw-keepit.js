// sw-keepit.js — minimal service worker so Keepit is installable as a PWA.
//
// Its ONLY job is installability + claiming clients. We deliberately do
// NOT cache anything: Keepit ships as plain HTML/JS with no build step, and
// stale-cached assets would mean users see old versions after a deploy.
// Every request goes straight to the network — caches are managed by the
// browser, not us.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => { /* network passthrough */ });
