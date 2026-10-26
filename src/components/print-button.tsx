"use client";

import { buttonSecondary } from "./ui";

export function PrintButton({ label = "Print or save as PDF" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={`${buttonSecondary} print:hidden`}>
      {label}
    </button>
  );
}
