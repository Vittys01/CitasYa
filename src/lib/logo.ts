/**
 * Logo loader for PDF generation.
 * Reads the logo PNG from /public/logo.png and caches it in memory.
 */

import fs from "fs";
import path from "path";

let cachedLogo: Uint8Array | null = null;

export function getLogoBytes(): Uint8Array | null {
  if (cachedLogo) return cachedLogo;
  try {
    const logoPath = path.join(process.cwd(), "public", "logo.png");
    cachedLogo = new Uint8Array(fs.readFileSync(logoPath));
    return cachedLogo;
  } catch {
    return null;
  }
}
