import Link from "next/link";

// Shows post text with #hashtags and @mentions as links.
export function RichText({ text }: { text: string }) {
  const parts = text.split(/([#@][\p{L}\p{N}_]{2,40})/gu);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("#")) {
          return <Link key={i} href={`/community?tag=${encodeURIComponent(part.slice(1).toLowerCase())}`} className="font-medium text-brand-700 hover:underline">{part}</Link>;
        }
        if (part.startsWith("@") && /^@[a-z0-9_]+$/i.test(part)) {
          return <Link key={i} href={`/u/${part.slice(1).toLowerCase()}`} className="font-medium text-brand-700 hover:underline">{part}</Link>;
        }
        return part;
      })}
    </>
  );
}
