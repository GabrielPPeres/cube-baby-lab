import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const app = fileURLToPath(new URL("../app", import.meta.url));
const dist = fileURLToPath(new URL("../dist", import.meta.url));
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(`${app}/index.html`, `${dist}/index.html`);
await cp(`${app}/styles.css`, `${dist}/styles.css`);
await cp(`${app}/main.ts`, `${dist}/main.js`);
await cp(`${app}/model.ts`, `${dist}/model.js`);
console.log(`Built static lab app at ${dist}`);
