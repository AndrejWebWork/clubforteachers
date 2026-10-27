import { api, getToken } from "./api";

function keyBytes(value) {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

export function pushInstallNeeded() {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!ios) return false;
  const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  return !standalone;
}

export function preparePush() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
}

export async function enablePush({ welcome = false } = {}) {
  if (!window.isSecureContext || !("Notification" in window)) return pushInstallNeeded() ? "install" : "unsupported";
  if (pushInstallNeeded()) return "install";
  let permission = Notification.permission;
  if (permission === "default") permission = await Notification.requestPermission();
  if (permission !== "granted") return permission;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
  preparePush();
  const registration = await navigator.serviceWorker.ready;
  const { publicKey } = await api.pushKey();
  if (!publicKey) return "missing-key";
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyBytes(publicKey),
  });
  const token = getToken();
  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      subscription: subscription.toJSON(),
      notices: true,
      calendar: true,
      forum: true,
      welcome,
    }),
  });
  if (!response.ok) return "failed";
  return "granted";
}
