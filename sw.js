/* AWSM GAMES — push service worker (new-game alerts) */
self.addEventListener('install', function(){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });

self.addEventListener('push', function(event){
  var data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch (e) { data = { body: event.data && event.data.text() }; }
  var title = data.title || 'AWSM GAMES';
  var opts = {
    body: data.body || 'A new game just landed — come play!',
    tag: 'awsm-new-game',
    renotify: true,
    vibrate: [80, 40, 80],
    data: { url: data.url || './' }
  };
  if (data.icon) opts.icon = data.icon;
  if (data.badge) opts.badge = data.badge;
  event.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener('notificationclick', function(event){
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list){
      for (var i = 0; i < list.length; i++){
        if (list[i].url.indexOf(url) !== -1 && 'focus' in list[i]) return list[i].focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
