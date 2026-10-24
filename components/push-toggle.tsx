"use client";

import { useEffect, useState } from "react";
import { removePushSubscription, savePushSubscription } from "@/app/actions/notifications";

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function base64ToBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

type PushState = "loading" | "unsupported" | "off" | "on" | "blocked";

async function detect(): Promise<PushState> {
  if (!KEY || !("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    return (await reg.pushManager.getSubscription()) ? "on" : "off";
  } catch {
    return "unsupported";
  }
}

// Lets a student turn on alerts on their phone (needs the site added to the
// home screen on iPhones).
export function PushToggle() {
  const [state, setState] = useState<PushState>("loading");

  useEffect(() => {
    detect().then(setState);
  }, []);

  async function turnOn() {
    setState("loading");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(KEY!) });
      const json = sub.toJSON();
      await savePushSubscription({ endpoint: sub.endpoint, p256dh: json.keys!.p256dh, auth: json.keys!.auth });
      setState("on");
    } catch {
      setState(Notification.permission === "denied" ? "blocked" : "off");
    }
  }

  async function turnOff() {
    setState("loading");
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await removePushSubscription(sub.endpoint);
      await sub.unsubscribe();
    }
    setState("off");
  }

  if (state === "unsupported" || state === "loading") return null;
  return (
    <div className="card flex items-center gap-3 p-4">
      <span className="text-2xl">📲</span>
      <div className="flex-1 text-sm">
        <p className="font-semibold">Alerts on this phone</p>
        <p className="text-black/55">
          {state === "on" ? "On. You'll get reminders and news." : state === "blocked" ? "Blocked in your browser settings." : "Get event reminders even when the app is closed."}
        </p>
      </div>
      {state === "off" && <button onClick={turnOn} className="btn-primary px-3 py-2">Turn on</button>}
      {state === "on" && <button onClick={turnOff} className="btn-secondary px-3 py-2">Turn off</button>}
    </div>
  );
}
