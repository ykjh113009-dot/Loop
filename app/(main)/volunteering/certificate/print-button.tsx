"use client";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn-primary w-full print:hidden">
      📄 Download as PDF / Print
    </button>
  );
}
