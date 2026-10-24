// Small hand-picked icons (inline SVG, so no extra downloads).
type IconProps = { className?: string };

const paths: Record<string, string> = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
  clubs: "M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6m0 2c-2.7 0-6 1.3-6 3.5V19h12v-2.5C14 14.3 10.7 13 8 13m8 0c-.4 0-.8 0-1.2.1 1.3.9 2.2 2 2.2 3.4V19h5v-2.5c0-2.2-3.3-3.5-6-3.5",
  calendar: "M7 2v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2zM5 9h14v10H5z",
  chat: "M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H8l-4 4V5a1 1 0 0 1 1-1",
  bell: "M12 22a2.5 2.5 0 0 0 2.5-2.5h-5A2.5 2.5 0 0 0 12 22m7-6V11a7 7 0 0 0-5-6.7V3.5a2 2 0 1 0-4 0v.8A7 7 0 0 0 5 11v5l-2 2v1h18v-1z",
  search: "M10 3a7 7 0 1 0 4.2 12.6l5.1 5.1 1.4-1.4-5.1-5.1A7 7 0 0 0 10 3m0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10",
  shield: "M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5z",
  chart: "M4 20V10h3v10zm6 0V4h3v16zm6 0v-7h3v7z",
  flag: "M5 3h2v18H5zm3 1h10l-2 4 2 4H8z",
  plus: "M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7z",
  image: "M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1m1 2v9l4-4 3 3 3-3 4 4V6zm10 1.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3",
  send: "M3 20.5 21 12 3 3.5v6.6L15 12 3 13.9z",
  back: "M15.4 4.6 14 3.2 5.2 12l8.8 8.8 1.4-1.4L8 12z",
  pin: "M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7m0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5",
  clock: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20m1 5h-2v6l5 3 1-1.7-4-2.3z",
  users: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8m0 2c-3.3 0-8 1.7-8 4.5V21h16v-2.5c0-2.8-4.7-4.5-8-4.5",
  check: "M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z",
  dots: "M5 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4m7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4m7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4",
  megaphone: "M3 10v4a1 1 0 0 0 1 1h2l4 5h2l-2-5h1l8 4V5l-8 4H4a1 1 0 0 0-1 1",
  settings: "M19.4 13a7.5 7.5 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3h-4l-.4 2.9a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.5 7.5 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.4 7.4 0 0 0 1.7 1L11 21h4l.4-2.9a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7",
};

export type IconName = keyof typeof paths;

export function Icon({ name, className = "size-5" }: IconProps & { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d={paths[name]} />
    </svg>
  );
}
