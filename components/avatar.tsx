import { avatarSrc } from "@/lib/avatars";

const sizes = { xs: "size-6", sm: "size-8", md: "size-10", lg: "size-16", xl: "size-24" };

export function Avatar({ avatar, size = "md", className = "" }: { avatar: string; size?: keyof typeof sizes; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny local SVGs, no optimisation needed
    <img src={avatarSrc(avatar)} alt="" className={`${sizes[size]} shrink-0 rounded-full bg-black/5 ${className}`} />
  );
}
