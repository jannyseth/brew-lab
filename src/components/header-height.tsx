"use client";

import { useEffect } from "react";

/** Publishes the header's real height as --header-h, so full-screen pages fit exactly below it. */
export function HeaderHeight() {
  useEffect(() => {
    const header = document.getElementById("site-header");
    if (!header) return;
    const update = () => document.documentElement.style.setProperty("--header-h", `${header.offsetHeight}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);
  return null;
}
