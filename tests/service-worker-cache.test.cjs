const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {test} = require('node:test');

const root = path.join(__dirname, '..');
const serviceWorkerSource = fs.readFileSync(
  path.join(root, 'service-worker.js'),
  'utf8'
);

function fakeResponse(name, options = {}){
  const response = {
    name,
    ok:options.ok !== false,
    status:options.status || 200,
    clone(){
      const copy = fakeResponse(`${name}:cached-copy`, options);
      response.clones.push(copy);
      return copy;
    },
    clones:[]
  };
  return response;
}

function createHarness({networkResponse, networkError, cachedResponse}){
  const listeners = new Map();
  const calls = [];
  const cachePuts = [];
  const cache = {
    async addAll(){},
    async put(request, response){
      calls.push(['put', request.url]);
      cachePuts.push({request, response});
    }
  };
  const caches = {
    async open(name){
      calls.push(['open', name]);
      return cache;
    },
    async match(request, options){
      calls.push(['match', request.url, options]);
      return cachedResponse;
    },
    async keys(){ return []; },
    async delete(){ return true; }
  };
  const context = vm.createContext({
    URL,
    Promise,
    caches,
    fetch:async request => {
      calls.push(['fetch', request.url]);
      if(networkError) throw networkError;
      return networkResponse;
    },
    self:{
      location:{origin:'https://example.test'},
      addEventListener(type, listener){ listeners.set(type, listener); },
      skipWaiting(){ return Promise.resolve(); },
      clients:{claim(){ return Promise.resolve(); }}
    }
  });

  vm.runInContext(serviceWorkerSource, context);

  async function dispatchFetch(request){
    let responsePromise = null;
    listeners.get('fetch')({
      request,
      respondWith(value){ responsePromise = Promise.resolve(value); }
    });
    assert.ok(responsePromise, 'the service worker should handle the request');
    const response = await responsePromise;
    // Let a deliberately non-blocking cache write finish before assertions.
    await new Promise(resolve => setImmediate(resolve));
    return response;
  }

  return {calls, cachePuts, dispatchFetch};
}

function documentRequest(url){
  return {
    method:'GET',
    url,
    mode:'navigate',
    destination:'document'
  };
}

test('document navigation uses the network first and refreshes its cached copy', async () => {
  const stale = fakeResponse('stale-cache');
  const fresh = fakeResponse('fresh-network');
  const request = documentRequest(
    'https://example.test/CampusWay/wayframe/navigation-demo.html?building=main'
  );
  const harness = createHarness({
    networkResponse:fresh,
    cachedResponse:stale
  });

  const response = await harness.dispatchFetch(request);

  assert.equal(response, fresh);
  assert.equal(harness.calls[0][0], 'fetch');
  assert.equal(
    harness.calls.some(call => call[0] === 'match'),
    false,
    'a successful navigation should not be answered by a stale cache entry'
  );
  assert.equal(fresh.clones.length, 1);
  assert.equal(harness.cachePuts.length, 1);
  assert.equal(harness.cachePuts[0].request, request);
  assert.equal(harness.cachePuts[0].response, fresh.clones[0]);
});

test('offline document navigation falls back to the cached page ignoring its query', async () => {
  const cached = fakeResponse('offline-cache');
  const request = documentRequest(
    'https://example.test/CampusWay/index.html?resumeJourney=1'
  );
  const harness = createHarness({
    networkError:new Error('offline'),
    cachedResponse:cached
  });

  const response = await harness.dispatchFetch(request);

  assert.equal(response, cached);
  assert.deepEqual(
    harness.calls.map(call => call[0]),
    ['fetch', 'match']
  );
  assert.equal(harness.calls[1][1], request.url);
  assert.equal(harness.calls[1][2]?.ignoreSearch, true);
  assert.equal(harness.cachePuts.length, 0);
});
