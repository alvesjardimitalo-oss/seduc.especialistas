import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import { resolve } from "node:path";
import express from "../functions/node_modules/express/index.js";
import { createApi } from "../functions/http.mjs";
import { demoState } from "../functions/domain.mjs";
const path = resolve(".local/demo.json");
await mkdir(resolve(".local"), { recursive: true });
let state;
try {
  state = JSON.parse(await readFile(path, "utf8"));
} catch (e) {
  if (e.code !== "ENOENT") throw e;
  state = demoState();
}
let queue = Promise.resolve();
const repository = {
  run(action) {
    const task = queue.then(async () => {
      const draft = structuredClone(state);
      const result = action(draft);
      await writeFile(path + ".tmp", JSON.stringify(draft));
      await rename(path + ".tmp", path);
      state = draft;
      return result;
    });
    queue = task.catch(() => {});
    return task;
  },
};
// Only loopback. This demo server is never exported as a Cloud Function.
const app = createApi({
  repository,
  demo: true,
  authenticate: async () => ({
    uid: "demo-admin",
    name: "Demonstração",
    email: "admin@example.invalid",
  }),
});
app.use(express.static(resolve("dist")));
app.get("/{*path}", (_req, res) => res.sendFile(resolve("dist/index.html")));
app.listen(3001, "127.0.0.1", () =>
  console.log(
    "SEDUC DEMONSTRAÇÃO: http://127.0.0.1:3001 — use apenas dados fictícios.",
  ),
);
