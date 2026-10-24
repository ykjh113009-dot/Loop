"use client";

import { useEffect } from "react";
import { markAllNotificationsRead } from "@/app/actions/notifications";

// Marks notifications as read once the student has opened the page.
export function MarkRead() {
  useEffect(() => {
    markAllNotificationsRead();
  }, []);
  return null;
}
