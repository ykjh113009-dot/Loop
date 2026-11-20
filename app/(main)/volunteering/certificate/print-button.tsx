"use client";
import { Glyph } from "@/components/glyph";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn-primary w-full print:hidden">
      <Glyph e="📄" /> Download as PDF / Print
    </button>
  );
}
