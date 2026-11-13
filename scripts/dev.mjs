import { spawn } from "node:child_process";
const children = [
  spawn(process.execPath, ["scripts/local-server.mjs"], { stdio: "inherit" }),
  spawn(process.execPath, ["node_modules/vite/bin/vite.js"], {
    stdio: "inherit",
  }),
];
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    children.forEach((p) => p.kill());
    process.exit();
  });
