import express from "express";
import { mutate, view, report, DomainError } from "./domain.mjs";
export function createApi({ repository, authenticate, demo = false }) {
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    res.set("X-Content-Type-Options", "nosniff");
    next();
  });
  app.get("/api/health", (_req, res) =>
    res.json({ ok: true, mode: demo ? "demo" : "firebase" }),
  );
  app.use(express.json({ limit: "32kb" }));
  app.use("/api", async (req, res, next) => {
    try {
      req.identity = await authenticate(req);
      next();
    } catch {
      res.status(401).json({ error: "Sessão inválida. Entre novamente." });
    }
  });
  app.get("/api/state", async (req, res, next) => {
    try {
      res.json(await repository.run((s) => view(s, req.identity)));
    } catch (e) {
      next(e);
    }
  });
  app.post("/api/save", async (req, res, next) => {
    try {
      res.json(await repository.run((s) => mutate(s, req.identity, req.body)));
    } catch (e) {
      next(e);
    }
  });
  app.post("/api/report", async (req, res, next) => {
    try {
      res.json(await repository.run((s) => report(s, req.identity, req.body)));
    } catch (e) {
      next(e);
    }
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "Operação não encontrada." }),
  );
  app.use((err, _req, res, _next) => {
    if (!(err instanceof DomainError))
      console.error("SEDUC API:", err.code || err.name);
    res
      .status(err.status || 500)
      .json({
        error:
          err instanceof DomainError
            ? err.message
            : err.type === "entity.parse.failed"
              ? "JSON inválido."
              : "Não foi possível concluir. Tente novamente ou contate a administração.",
      });
  });
  return app;
}
