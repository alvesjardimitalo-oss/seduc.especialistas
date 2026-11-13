import { TABLES, DomainError } from "./domain.mjs";
// Atomic query reads serialize scheduling and enrollment uniqueness checks.
// This initial municipal deployment is bounded to 2,000 docs per collection.
// Refuses to run on truncated data; never silently skips conflict checks.
export class FirestoreRepository {
  constructor(db) {
    this.db = db;
  }
  async run(action) {
    return this.db.runTransaction(async (tx) => {
      const state = {},
        original = {};
      for (const table of TABLES) {
        const snap = await tx.get(this.db.collection(table).limit(2001));
        if (snap.size > 2000)
          throw new DomainError(
            "Limite operacional atingido. A administração deve migrar para consultas paginadas antes de continuar.",
            503,
          );
        state[table] = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
        original[table] = new Map(
          state[table].map((d) => [d.id, JSON.stringify(d)]),
        );
      }
      const result = action(state);
      let writes = 0;
      for (const table of TABLES)
        for (const doc of state[table])
          if (original[table].get(doc.id) !== JSON.stringify(doc)) {
            if (++writes > 400)
              throw new DomainError(
                "Operação excede o limite de alterações.",
                400,
              );
            tx.set(this.db.collection(table).doc(doc.id), doc);
          }
      return result;
    });
  }
}
