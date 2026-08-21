// Service Worker de Web Push (KAN-257) — port 1:1 de `matchouse/src/dashboard/sw.js`, sin
// cambios de comportamiento. Vive en `public/` (no en `src/`) porque el navegador lo pide como
// un archivo estático en la raíz del origen (`/sw.js`) — el bundler de Next.js nunca lo procesa,
// corre tal cual en su propio contexto de Service Worker.

self.addEventListener("push", function (event) {
  if (event.data) {
    try {
      const data = event.data.json();
      const options = {
        body: data.body,
        icon: "/logo-icon",
        badge: "/logo-icon",
        vibrate: [100, 50, 100],
        data: data.data || {},
        tag: data.tag || "brokaza-notification",
        actions: [{ action: "open", title: "Tocá para ver" }],
      };
      event.waitUntil(self.registration.showNotification(data.title || "Brokaza", options));
    } catch (e) {
      console.error("Error al decodificar JSON del push:", e);
      event.waitUntil(
        self.registration.showNotification("Brokaza", {
          body: event.data.text(),
        }),
      );
    }
  }
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const urlToOpen = event.notification.data.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(urlToOpen) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    }),
  );
});
