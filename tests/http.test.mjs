import { test } from "node:test";
import assert from "node:assert/strict";
import { createApi } from "../functions/http.mjs";
import { demoState } from "../functions/domain.mjs";
test("HTTP auth, pending request, save, report and unknown route", async () => {
  let state = demoState();
  const app = createApi({
    repository: {
      async run(fn) {
        const draft = structuredClone(state);
        const result = fn(draft);
        state = draft;
        return result;
      },
    },
    authenticate: async (req) => {
      const id = req.headers.authorization;
      if (!id) throw Error();
      return { uid: id, email: "fake@example.invalid" };
    },
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  try {
    assert.equal((await fetch(base + "/state")).status, 401);
    const pending = await fetch(base + "/state", {
      headers: { Authorization: "new" },
    }).then((r) => r.json());
    assert.equal(pending.user.status, "Pendente");
    const response = await fetch(base + "/save", {
      method: "POST",
      headers: {
        Authorization: "demo-admin",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        table: "schools",
        data: { name: "Escola fictícia", status: "Ativo" },
      }),
    });
    assert.equal(response.status, 200);
    assert.equal(state.schools.length, 6);
    assert.equal(
      (
        await fetch(base + "/unknown", {
          headers: { Authorization: "demo-admin" },
        })
      ).status,
      404,
    );
  } finally {
    await new Promise((r) => server.close(r));
  }
});
