/* Baladi service worker.
   Two jobs, and deliberately no more than two.

   1. It is what lets Android and desktop browsers offer "Install", which is how
      Baladi gets onto a home screen in one press instead of three.
   2. It keeps the app opening where there is no signal. Most of a collector's
      round is out of coverage, and a household on the edge of the village is
      not much better off.

   Network first, cache second. A refreshed deployment is picked up the moment
   the phone can reach the server, so nobody is ever looking at last month's
   tariff because a cache held on to it. The cache only answers when the network
   does not. */
var CACHE = "baladi-v1";
var SHELL = ["./", "./index.html", "./manifest.webmanifest",
             "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png"];

self.addEventListener("install", function(ev){
  self.skipWaiting();
  ev.waitUntil(caches.open(CACHE).then(function(c){
    /* one missing file must not fail the whole install */
    return Promise.all(SHELL.map(function(u){ return c.add(u).catch(function(){}); }));
  }));
});

self.addEventListener("activate", function(ev){
  ev.waitUntil(
    caches.keys().then(function(ks){
      return Promise.all(ks.map(function(k){ return k===CACHE ? null : caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(ev){
  var req = ev.request;
  if(req.method !== "GET") return;
  var url;
  try{ url = new URL(req.url); }catch(e){ return; }
  if(url.origin !== self.location.origin) return;   /* fonts and the database are not ours to cache */

  ev.respondWith(
    fetch(req).then(function(res){
      if(res && res.ok){
        var copy = res.clone();
        caches.open(CACHE).then(function(c){ c.put(req, copy).catch(function(){}); });
      }
      return res;
    }).catch(function(){
      return caches.match(req).then(function(hit){
        if(hit) return hit;
        /* a page asked for while offline gets the app itself, which knows how to
           say that it is offline far better than the browser does */
        if(req.mode === "navigate") return caches.match("./index.html");
        return Response.error();
      });
    })
  );
});
