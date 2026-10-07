self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Клуб на наставници", {
      body: data.body || "Има ново известување во клубот.",
      icon: "/icon-512.png",
      data: { url: data.url || "/oglasi" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/oglasi", self.location.origin).href;
  event.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const current = open.find((client) => new URL(client.url).origin === self.location.origin);
    if (current) {
      await current.focus();
      if ("navigate" in current) await current.navigate(target);
      return;
    }
    await self.clients.openWindow(target);
  })());
});
