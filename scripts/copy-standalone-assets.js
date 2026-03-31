/**
 * Next.js standalone no siempre deja `.next/static` dentro de `.next/standalone/.next/`
 * (p. ej. si el paso de trazado falla con ENOENT). Sin esos archivos, `/_next/static/*` da 404
 * y el cliente no hidrata: pantalla en blanco.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`[copy-standalone-assets] skip missing: ${src}`);
    return;
  }
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

copyDir(path.join(root, ".next/static"), path.join(root, ".next/standalone/.next/static"));
copyDir(path.join(root, "public"), path.join(root, ".next/standalone/public"));
console.log("[copy-standalone-assets] static + public → .next/standalone");
