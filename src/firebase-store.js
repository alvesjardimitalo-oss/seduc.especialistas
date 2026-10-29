import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  query,
  collection,
  where,
  limit,
  orderBy,
  startAfter,
  runTransaction,
  serverTimestamp,
  onSnapshot,
  getCountFromServer,
} from "firebase/firestore";
import { emptyState, mutate, localParts } from "../functions/domain.mjs";
const PAGE = 40,
  TTL = 120_000;
export function createStore(firebaseApp, user, onAccessChange, providedDb) {
  const db = providedDb || getFirestore(firebaseApp),
    identity = { uid: user.uid, email: user.email, name: user.displayName };
  let state = emptyState(),
    cache = new Map(),
    cursors = new Map(),
    hasMore = {},
    counts = null,
    countsAt = 0,
    loadedOnce = false,
    queryFilters = {};
  const admin = () => state.user?.role === "superadmin",
    manager = () =>
      admin() || (state.user?.role === "secretaria" && state.user.manageUsers),
    global = () => admin() || state.user?.role === "secretaria";
  const ref = (t, id) => doc(db, t, id),
    unpack = (d) => {
      const { serverAt, ...data } = d.data();
      return { ...data, id: d.id };
    },
    clinical = () => admin() || state.user?.role === "especialista";
  const scoped = [
    "links",
    "students",
    "enrollments",
    "appointments",
    "notes",
    "attendance",
    "referrals",
  ];
  function constraints(t, ignoreFilters = false) {
    const terms = [],
      f = ignoreFilters ? {} : queryFilters[t] || {};
    if (scoped.includes(t)) {
      if (f.schoolId) {
        if (!global() && !state.user.schoolIds.includes(f.schoolId))
          throw Error("Escola fora do seu acesso.");
        terms.push(where("schoolId", "==", f.schoolId));
      } else if (!global()) {
        if (!state.user.schoolIds?.length) return null;
        terms.push(where("schoolId", "in", state.user.schoolIds.slice(0, 30)));
      }
    }
    if (t === "appointments") {
      if (f.from)
        terms.push(
          where("startMs", ">=", +new Date(f.from + "T00:00:00-03:00")),
        );
      if (f.to)
        terms.push(
          where("startMs", "<", +new Date(f.to + "T00:00:00-03:00") + 86400000),
        );
      if (f.status) terms.push(where("status", "==", f.status));
      if (f.professionalId)
        terms.push(where("professionalId", "==", f.professionalId));
    }
    if (t === "professionals" && !manager()) t = "professionals_public";
    return { t, terms };
  }
  async function page(t, more = false, force = false) {
    if (!more && !force && cache.has(t) && Date.now() - cache.get(t) < TTL)
      return;
    const c = constraints(t);
    if (!c) {
      state[t] = [];
      return;
    }
    const cursor = more ? cursors.get(t) : null;
    const orders =
      t === "appointments" && (queryFilters[t]?.from || queryFilters[t]?.to)
        ? [orderBy("startMs"), orderBy("__name__")]
        : [orderBy("__name__")];
    const q = query(
      collection(db, c.t),
      ...c.terms,
      ...orders,
      ...(cursor ? [startAfter(cursor)] : []),
      limit(PAGE),
    );
    const snap = await getDocs(q);
    const rows = snap.docs.map(unpack);
    state[t] = more ? [...(state[t] || []), ...rows] : rows;
    cursors.set(t, snap.docs.at(-1));
    hasMore[t] = snap.size === PAGE;
    cache.set(t, Date.now());
  }
  async function hydrate() {
    const refs = new Map();
    for (const t of [
      "appointments",
      "notes",
      "attendance",
      "links",
      "referrals",
      "_upcoming",
    ])
      for (const row of state[t] || [])
        for (const [key, target] of [
          ["professionalId", "professionals"],
          ["studentId", "students"],
          ["appointmentId", "appointments"],
        ])
          if (row[key] && !state[target].some((x) => x.id === row[key]))
            refs.set(target + "/" + row[key], { t: target, id: row[key] });
    // Only resolve IDs used by the visible page; cache each relationship in memory.
    await Promise.all(
      [...refs.values()].slice(0, 120).map(async ({ t, id }) => {
        const key = t + "/" + id;
        if (cache.has(key)) return;
        try {
          const snap = await getDoc(
            ref(t === "professionals" ? "professionals_public" : t, id),
          );
          if (snap.exists()) state[t].push(unpack(snap));
        } catch (e) {
          if (e.code !== "permission-denied") throw e;
        }
        cache.set(key, Date.now());
      }),
    );
  }
  async function initialize() {
    const userRef = ref("users", user.uid);
    let snap = await getDoc(userRef);
    if (!snap.exists())
      await runTransaction(db, async (tx) => {
        const old = await tx.get(userRef);
        if (!old.exists())
          tx.set(userRef, {
            id: user.uid,
            name: user.displayName || "Usuário",
            email: user.email,
            role: "visualizador",
            status: "Pendente",
            schoolIds: [],
            manageUsers: false,
            canExport: false,
            version: 1,
            createdBy: user.uid,
            createdAt: new Date().toISOString(),
          });
      });
    if (!snap.exists()) snap = await getDoc(userRef);
    state.user = unpack(snap);
    // Exactly one realtime listener, only on access. No collection-wide listeners.
    const unsubscribe = onSnapshot(
      userRef,
      (s) => {
        if (!s.exists()) return;
        const next = unpack(s);
        if (loadedOnce && JSON.stringify(next) !== JSON.stringify(state.user)) {
          state = emptyState();
          cache.clear();
          cursors.clear();
          hasMore = {};
          counts = null;
          state.user = next;
          onAccessChange();
        } else state.user = next;
      },
      () => onAccessChange("Não foi possível verificar sua autorização."),
    );
    return unsubscribe;
  }
  async function stateFor(module = "dashboard", force = false) {
    if (state.user.status !== "Ativo") return { user: state.user };
    const needed = new Set(["schools"]);
    if (module === "dashboard") {
      needed.add("professionals");
    } else if (module === "reports") {
      ["appointments", "professionals", "attendance"].forEach((t) =>
        needed.add(t),
      );
    } else if (module !== "users" || manager()) needed.add(module);
    if (
      ["appointments", "attendance", "referrals", "notes", "links"].includes(
        module,
      )
    ) {
      needed.add("links");
      needed.add("professionals");
    }
    if (module === "notes") needed.add("appointments");
    if (["notes", "referrals"].includes(module) && !clinical())
      needed.delete(module);
    if (!manager()) {
      needed.delete("users");
      needed.delete("blocks");
    }
    if (!admin()) {
      needed.delete("audit");
      needed.delete("versions");
    }
    await Promise.all([...needed].map((t) => page(t, false, force)));
    await hydrate();
    if (module === "dashboard" && (!counts || Date.now() - countsAt > TTL)) {
      const count = async (t, terms, schoolId) => {
        const c = constraints(t, true);
        if (!c) return 0;
        const r = await getCountFromServer(
          query(
            collection(
              db,
              t === "professionals" ? "professionals_public" : c.t,
            ),
            ...(schoolId ? [where("schoolId", "==", schoolId)] : c.terms),
            ...terms,
            limit(10000),
          ),
        );
        return r.data().count;
      };
      const day = new Date().toLocaleDateString("en-CA", {
          timeZone: "America/Sao_Paulo",
        }),
        start = +new Date(day + "T00:00:00-03:00");
      const [students, professionals, appointmentsToday, done, bySchool] =
        await Promise.all([
          count("students", [where("status", "==", "Ativo")]),
          count("professionals", [where("status", "==", "Ativo")]),
          count("appointments", [
            where("startMs", ">=", start),
            where("startMs", "<", start + 86400000),
          ]),
          count("appointments", [where("status", "==", "Realizado")]),
          Promise.all(
            state.schools
              .filter((s) => global() || state.user.schoolIds.includes(s.id))
              .map(async (s) => [
                s.id,
                await count("students", [where("status", "==", "Ativo")], s.id),
              ]),
          ),
        ]);
      counts = {
        students,
        professionals,
        appointmentsToday,
        done,
        bySchool: Object.fromEntries(bySchool),
      };
      countsAt = Date.now();
    }
    if (
      module === "dashboard" &&
      (force ||
        !cache.has("upcoming") ||
        Date.now() - cache.get("upcoming") > TTL)
    ) {
      const c = constraints("appointments", true);
      state._upcoming = c
        ? (
            await getDocs(
              query(
                collection(db, "appointments"),
                ...c.terms,
                where("status", "==", "Agendado"),
                where("startMs", ">=", Date.now()),
                orderBy("startMs"),
                limit(8),
              ),
            )
          ).docs.map(unpack)
        : [];
      cache.set("upcoming", Date.now());
      await hydrate();
    }
    loadedOnce = true;
    return {
      ...state,
      _hasMore: { ...hasMore },
      _loaded: PAGE,
      _counts: counts,
    };
  }
  async function privateRow(t, id) {
    if (t === "professionals" && !manager()) return {};
    if (!["professionals", "students"].includes(t)) return {};
    const snap = await getDoc(ref(t + "_private", id));
    return snap.exists() ? snap.data() : {};
  }
  async function formOptions(t) {
    const need =
      t === "links"
        ? ["users", "professionals", "schools"]
        : t === "appointments" || t === "referrals"
          ? ["links", "students"]
          : t === "notes"
            ? ["appointments"]
            : t === "attendance"
              ? ["links"]
              : [];
    await Promise.all(need.map((x) => page(x)));
    await hydrate();
    return state;
  }
  async function save(payload) {
    const draft = structuredClone({ ...state, user: undefined });
    draft.users = manager() ? [...state.users] : [state.user];
    if (!draft.users.some((x) => x.id === user.uid))
      draft.users.push(state.user);
    // Local domain validation mirrors server rules; rules remain authoritative.
    let old = payload.id
      ? state[payload.table].find((x) => x.id === payload.id)
      : null;
    if (old && ["professionals", "students"].includes(payload.table)) {
      old = { ...old, ...(await privateRow(payload.table, old.id)) };
      draft[payload.table] = draft[payload.table].map((x) =>
        x.id === old.id ? old : x,
      );
    }
    if (payload.table === "links") {
      const p = draft.professionals.find(
        (p) => p.id === payload.data.professionalId,
      );
      if (p) Object.assign(p, await privateRow("professionals", p.id));
    }
    const result = mutate(draft, identity, payload);
    let row = draft[payload.table].find((x) => x.id === result.id);
    if (payload.table === "notes" && !old) {
      row.id = row.appointmentId;
      result.id = row.id;
    }
    const auditId = crypto.randomUUID();
    row = { ...row, auditId, serverAt: serverTimestamp() };
    let privateData = null;
    if (payload.table === "professionals") {
      privateData = {
        email: row.email,
        phone: row.phone,
        birth: row.birth,
        cpf: row.cpf,
        address: row.address,
        remarks: row.remarks,
      };
      for (const k of Object.keys(privateData)) delete row[k];
    }
    if (payload.table === "students") {
      privateData = {
        birth: row.birth,
        guardian: row.guardian,
        phone: row.phone,
        address: row.address,
      };
      for (const k of Object.keys(privateData)) delete row[k];
    }
    if (payload.table === "links") {
      row.workSlots = [];
      for (const interval of row.schedule) {
        if (interval.start % 15 || interval.end % 15)
          throw Error("Jornadas devem usar intervalos de 15 minutos.");
        for (let n = interval.start / 15; n < interval.end / 15; n++)
          row.workSlots.push(interval.day * 96 + n);
      }
    }
    if (payload.table === "appointments") {
      const a = localParts(row.start),
        b = localParts(row.end);
      const duration = (+new Date(row.end) - +new Date(row.start)) / 60000;
      if (a.minute % 15 || b.minute % 15 || duration > 60 || duration < 15)
        throw Error(
          "Use intervalos de 15 minutos e consultas de até 60 minutos.",
        );
      row.startMs = +new Date(row.start);
      row.endMs = +new Date(row.end);
      row.dayKey = a.day;
      row.startSlot = a.minute / 15;
      row.weekday = a.weekday;
      row.slots = Array.from({ length: duration / 15 }, (_, i) =>
        String(row.startSlot + i),
      );
    }
    const writes = new Map();
    const mainKey = payload.table + "/" + row.id;
    writes.set(mainKey, row);
    if (privateData)
      writes.set(payload.table + "_private/" + row.id, {
        ...privateData,
        id: row.id,
        schoolId: row.schoolId || "",
        auditId,
        serverAt: serverTimestamp(),
      });
    if (payload.table === "professionals")
      writes.set("professionals_public/" + row.id, {
        id: row.id,
        name: row.name,
        specialty: row.specialty,
        status: row.status,
        auditId,
        serverAt: serverTimestamp(),
      });
    if (payload.table === "students") {
      if (row.registration.includes("/"))
        throw Error("A matrícula não pode conter barra.");
      row.registrationKey = row.registration.toUpperCase();
      writes.set("registrations/" + row.registrationKey, { studentId: row.id });
      if (!old || old.schoolId !== row.schoolId) {
        for (const e of draft.enrollments.filter((e) => e.studentId === row.id))
          if (
            JSON.stringify(e) !==
            JSON.stringify(state.enrollments.find((x) => x.id === e.id))
          )
            writes.set("enrollments/" + e.id, {
              ...e,
              auditId,
              serverAt: serverTimestamp(),
            });
      }
    }
    if (payload.table === "notes") {
      const a = draft.appointments.find((a) => a.id === row.appointmentId);
      writes.set("appointments/" + a.id, {
        ...a,
        auditId,
        serverAt: serverTimestamp(),
      });
    }
    if (payload.table === "attendance") {
      row.uniqueKey = row.linkId + "_" + row.day;
      writes.set("attendance_keys/" + row.uniqueKey, { attendanceId: row.id });
    }
    if (old)
      writes.set("versions/" + auditId, {
        id: auditId,
        table: payload.table,
        targetId: old.id,
        before: state[payload.table].find((x) => x.id === old.id),
        actorId: user.uid,
        at: new Date().toISOString(),
        serverAt: serverTimestamp(),
      });
    writes.set("audit/" + auditId, {
      id: auditId,
      actorId: user.uid,
      action: old ? "atualizar" : "cadastrar",
      table: payload.table,
      targetId: row.id,
      at: new Date().toISOString(),
      serverAt: serverTimestamp(),
    });
    // Read all required documents before writing; retries serialize reservations.
    await runTransaction(db, async (tx) => {
      if (old) {
        const current = await tx.get(ref(payload.table, row.id));
        if (!current.exists() || current.data().version !== payload.version)
          throw Error("Este registro mudou. Atualize antes de salvar.");
      }
      const guards = [];
      if (payload.table === "appointments")
        for (const [kind, owner] of [
          ["p", row.professionalId],
          ["s", row.studentId],
        ]) {
          const key = `${kind}_${owner}_${row.dayKey}`;
          const snap = await tx.get(ref("calendar_guards", key));
          const guard = snap.exists()
            ? snap.data()
            : {
                kind,
                owner,
                dayKey: row.dayKey,
                bookings: {},
                blockedSlots: [],
              };
          const next = {
            ...guard,
            bookings: { ...guard.bookings },
            appointmentId: row.id,
          };
          for (const slot of row.slots) {
            const occupied = guard.bookings[slot];
            if (occupied && occupied !== row.id)
              throw Error("Conflito de horário. Atualize a agenda.");
            if (["Cancelado", "Remarcado"].includes(row.status))
              delete next.bookings[slot];
            else next.bookings[slot] = row.id;
          }
          guards.push([key, next]);
        }
      if (payload.table === "blocks") {
        const first = localParts(row.start),
          last = localParts(row.end);
        const days =
          Math.ceil((+new Date(last.day) - +new Date(first.day)) / 86400000) +
          1;
        if (days > 31)
          throw Error("Cadastre afastamentos em períodos de até 31 dias.");
        for (let n = 0; n < days; n++) {
          const dayKey = new Date(+new Date(first.day) + n * 86400000)
              .toISOString()
              .slice(0, 10),
            key = `p_${row.professionalId}_${dayKey}`;
          const snap = await tx.get(ref("calendar_guards", key));
          const guard = snap.exists()
            ? snap.data()
            : {
                kind: "p",
                owner: row.professionalId,
                dayKey,
                bookings: {},
                blockedSlots: [],
              };
          const slots = [];
          for (
            let slot = Math.floor((n === 0 ? first.minute : 0) / 15);
            slot < Math.ceil((n === days - 1 ? last.minute : 1440) / 15);
            slot++
          )
            slots.push(String(slot));
          guards.push([
            key,
            {
              ...guard,
              blockedSlots: [...new Set([...guard.blockedSlots, ...slots])],
            },
          ]);
        }
      }
      for (const [key, value] of writes) tx.set(doc(db, key), value);
      for (const [key, value] of guards)
        tx.set(ref("calendar_guards", key), value);
    });
    cache.delete(payload.table);
    if (payload.table === "professionals") cache.delete("professionals");
    if (payload.table === "notes") cache.delete("appointments");
    if (payload.table === "students") cache.delete("enrollments");
    cache.delete("audit");
    cache.delete("upcoming");
    counts = null;
    return result;
  }
  async function history(studentId) {
    const tasks = [
      "appointments",
      "enrollments",
      ...(clinical() ? ["notes"] : []),
    ];
    await Promise.all(
      tasks.map(async (t) => {
        const snap = await getDocs(
          query(
            collection(db, t),
            where("studentId", "==", studentId),
            ...(!global()
              ? [where("schoolId", "in", state.user.schoolIds.slice(0, 30))]
              : []),
            limit(PAGE),
          ),
        );
        const rows = snap.docs.map(unpack);
        state[t] = [
          ...state[t].filter((x) => x.studentId !== studentId),
          ...rows,
        ];
      }),
    );
    await hydrate();
    return state;
  }
  async function report(filters) {
    if (!admin() && !state.user.canExport)
      throw Error("Exportação não autorizada.");
    let rows = state.appointments;
    if (hasMore.appointments)
      throw Error(
        "Carregue as próximas páginas da agenda antes de exportar o período completo.",
      );
    rows = rows.filter(
      (a) =>
        (!filters.schoolId || a.schoolId === filters.schoolId) &&
        (!filters.from || a.dayKey >= filters.from) &&
        (!filters.to || a.dayKey <= filters.to),
    );
    const map = new Map();
    for (const a of rows) {
      const p = state.professionals.find((p) => p.id === a.professionalId),
        key = [a.schoolId, p?.specialty, a.status].join("|");
      const r = map.get(key) || {
        escola: state.schools.find((x) => x.id === a.schoolId)?.name || "",
        especialidade: p?.specialty || "",
        situacao: a.status,
        quantidade: 0,
        horas: 0,
      };
      r.quantidade++;
      r.horas += (a.endMs - a.startMs) / 3600000;
      map.set(key, r);
    }
    return [...map.values()];
  }
  return {
    initialize,
    stateFor,
    save,
    privateRow,
    formOptions,
    history,
    report,
    async applyFilters(t, filters) {
      queryFilters[t] = filters;
      cache.delete(t);
      cursors.delete(t);
      await page(t);
      await hydrate();
      return { ...state, _hasMore: { ...hasMore } };
    },
    async more(t) {
      await page(t, true);
      await hydrate();
      return { ...state, _hasMore: { ...hasMore } };
    },
  };
}
