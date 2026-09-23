const CACHE_NAME = 'campusway-v5-steps';

const APP_FILES = [
  './',
  './index.html',
  './manifest.json',

  './app/vendor/leaflet.css',
  './app/vendor/leaflet.js',
  './app/vendor/images/cw2.png',

  './app/prototype/data.js',
  './app/prototype/outdoor-routing.js',
  './app/prototype/madriga-graph.js',
  './app/prototype/main-graph.js',
  './app/prototype/rabin-graph.js',
  './app/prototype/student-graph.js',
  './app/prototype/indoor.js',

  './buildings/madriga/madriga-indoor-graph.json',
    './buildings/main/main-indoor-graph.json',
    './buildings/rabin/rabin-indoor-graph.json',
    './buildings/student/student-indoor-graph.json',

  './wayframe/navigation-demo.html',
  './wayframe/step-detector.js',
  './wayframe/sensor-test.html'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_FILES))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(
        names
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      )
    )
  );
});

self.addEventListener('fetch', event => {

  // Only handle normal GET requests.
  if(event.request.method !== 'GET'){
    return;
  }

  event.respondWith(
    caches.match(event.request, {
  ignoreSearch: true
})
      .then(cached => {

        if(cached){
          return cached;
        }

        return fetch(event.request);
      })
  );
});

