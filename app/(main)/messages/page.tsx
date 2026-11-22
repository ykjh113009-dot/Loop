import { MessageCircle } from "lucide-react";
import { getT } from "@/lib/i18n-server";

export const metadata = { title: "Chats" };

// On a computer the right side waits for you to pick a chat; on a phone the list is the page.
async function Pick() {
  const { t } = await getT();
  return (
    <div className="hidden h-full min-h-[420px] flex-col items-center justify-center gap-3 rounded-3xl border border-brand-700/10 bg-white/50 text-center lg:flex" data-chat-empty>
      <span className="flex size-20 items-center justify-center rounded-full bg-sage-soft text-brand-800"><MessageCircle className="size-9" aria-hidden="true" /></span>
      <p className="font-heading text-xl font-semibold text-brand-900">{t("Pick a chat")}</p>
      <p className="max-w-xs text-sm text-black/55">{t("Choose a conversation on the left to read it and reply.")}</p>
    </div>
  );
}

import { Suspense } from "react";
export default function MessagesPage() {
  return <Suspense><Pick /></Suspense>;
}
