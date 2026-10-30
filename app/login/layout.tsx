import { Bricolage_Grotesque, Figtree } from "next/font/google";
import "./login.css";

// Fonts for the sign-in page only. The rest of the app keeps its system fonts.
const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = Figtree({ subsets: ["latin"], variable: "--font-body", display: "swap" });

export default function LoginLayout({ children }: LayoutProps<"/login">) {
  return <div className={`${display.variable} ${body.variable}`}>{children}</div>;
}
