import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  limit,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { createStore } from "../src/firebase-store.js";
const env = await initializeTestEnvironment({
  projectId: "demo-seduc",
  firestore: { rules: await readFile("firestore.rules", "utf8") },
});
await env.clearFirestore();
const profiles = {
  root: {
    id: "root",
    name: "Admin teste",
    email: "root@example.invalid",
    role: "superadmin",
    status: "Ativo",
    schoolIds: [],
    manageUsers: true,
    canExport: true,
    version: 1,
    createdBy: "root",
    createdAt: "2026-01-01",
  },
  a: {
    id: "a",
    name: "Teste A",
    email: "a@example.invalid",
    role: "especialista",
    status: "Ativo",
    schoolIds: ["school-a"],
    manageUsers: false,
    canExport: false,
    version: 1,
    createdBy: "root",
    createdAt: "2026-01-01",
  },
  b: {
    id: "b",
    name: "Teste B",
    email: "b@example.invalid",
    role: "especialista",
    status: "Ativo",
    schoolIds: ["school-b"],
    manageUsers: false,
    canExport: false,
    version: 1,
    createdBy: "root",
    createdAt: "2026-01-01",
  },
};
const ctx = (id) =>
  env
    .authenticatedContext(id, {
      email: id + "@example.invalid",
      email_verified: true,
    })
    .firestore();
const stops = [];
let tests = 0;
const step = async (name, fn) => {
  await fn();
  tests++;
  console.log("PASS " + name);
};
try {
  await env.withSecurityRulesDisabled(async (c) => {
    for (const [id, p] of Object.entries(profiles))
      await setDoc(doc(c.firestore(), "users", id), p);
  });
  const root = ctx("root"),
    a = ctx("a"),
    b = ctx("b");
  const store = createStore(
    null,
    { uid: "root", email: "root@example.invalid", displayName: "Admin teste" },
    () => {},
    root,
  );
  stops.push(await store.initialize());
  await store.stateFor("schools");
  let schoolA, schoolB, professional, student, link, appointment;
  await step("admin creates a school with atomic audit", async () => {
    schoolA = await store.save({
      table: "schools",
      data: { name: "Escola A teste", status: "Ativo" },
    });
    await store.stateFor("schools");
    assert.ok(
      (
        await getDoc(
          doc(
            root,
            "audit",
            (await getDoc(doc(root, "schools", schoolA.id))).data().auditId,
          ),
        )
      ).exists(),
    );
  });
  await env.withSecurityRulesDisabled(async (c) => {
    for (const [id, school] of [
      ["a", schoolA.id],
      ["b", "school-b"],
    ])
      await updateDoc(doc(c.firestore(), "users", id), { schoolIds: [school] });
  });
  await step("anonymous cannot read", async () => {
    await assertFails(
      getDoc(
        doc(env.unauthenticatedContext().firestore(), "schools", schoolA.id),
      ),
    );
  });
  await step("school B cannot read student A", async () => {
    await store.stateFor("professionals");
    professional = await store.save({
      table: "professionals",
      data: {
        name: "Especialista teste",
        email: "a@example.invalid",
        specialty: "Psicopedagogia",
        status: "Ativo",
      },
    });
    await store.stateFor("students");
    student = await store.save({
      table: "students",
      data: {
        name: "Aluno fictício",
        registration: "TEST-001",
        schoolId: schoolA.id,
        status: "Ativo",
      },
    });
    await assertFails(getDoc(doc(b, "students", student.id)));
    await assertSucceeds(getDoc(doc(a, "students", student.id)));
  });
  await step(
    "private student data is unavailable to another school",
    async () => {
      await assertFails(getDoc(doc(b, "students_private", student.id)));
    },
  );
  await step("admin creates professional working schedule", async () => {
    await store.formOptions("links");
    link = await store.save({
      table: "links",
      data: {
        professionalId: professional.id,
        userId: "a",
        schoolId: schoolA.id,
        job: "Especialista",
        specialty: "Psicopedagogia",
        weeklyHours: 40,
        start: "2020-01-01",
        end: "",
        status: "Ativo",
        schedule: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
          day,
          start: 420,
          end: 1020,
        })),
      },
    });
  });
  const specialist = createStore(
    null,
    { uid: "a", email: "a@example.invalid", displayName: "Teste A" },
    () => {},
    a,
  );
  stops.push(await specialist.initialize());
  await specialist.stateFor("appointments");
  await specialist.formOptions("appointments");
  const data = {
    schoolId: schoolA.id,
    studentId: student.id,
    linkId: link.id,
    start: "2030-11-04T10:00:00.000Z",
    end: "2030-11-04T11:00:00.000Z",
    modality: "Presencial",
    status: "Agendado",
  };
  await step(
    "transaction creates appointment and both reservation guards",
    async () => {
      appointment = await specialist.save({ table: "appointments", data });
      assert.equal(
        (await getDoc(doc(a, "appointments", appointment.id))).data().status,
        "Agendado",
      );
    },
  );
  await step(
    "server rejects a competing booking from a stale client",
    async () => {
      await assert.rejects(specialist.save({ table: "appointments", data }));
    },
  );
  await step("notes mark attendance completed atomically", async () => {
    await specialist.stateFor("notes");
    await specialist.formOptions("notes");
    await specialist.save({
      table: "notes",
      data: { appointmentId: appointment.id, text: "Observação fictícia" },
    });
    assert.equal(
      (await getDoc(doc(a, "appointments", appointment.id))).data().status,
      "Realizado",
    );
  });
  await step(
    "note edit keeps immutable version and requires author",
    async () => {
      const s = await specialist.stateFor("notes");
      const n = s.notes[0];
      await specialist.save({
        table: "notes",
        id: n.id,
        version: n.version,
        data: {
          appointmentId: appointment.id,
          text: "Evolução corrigida",
          reason: "Correção fictícia",
        },
      });
      await assertFails(updateDoc(doc(b, "notes", n.id), { text: "Indevido" }));
    },
  );
  await step(
    "cancellation releases both guards and enables a new reservation",
    async () => {
      const s = await specialist.stateFor("appointments");
      const old = s.appointments.find((x) => x.id === appointment.id);
      await specialist.save({
        table: "appointments",
        id: old.id,
        version: old.version,
        data: { ...data, status: "Cancelado", reason: "Teste de remarcação" },
      });
      await specialist.stateFor("appointments");
      appointment = await specialist.save({ table: "appointments", data });
    },
  );
  await step("functional attendance remains independent", async () => {
    await specialist.stateFor("attendance");
    await specialist.save({
      table: "attendance",
      data: {
        linkId: link.id,
        day: "2030-11-04",
        entry: "07:00",
        exit: "17:00",
        status: "Presente",
      },
    });
  });
  await step("manager blocks prevent new appointments", async () => {
    await store.stateFor("blocks");
    await store.save({
      table: "blocks",
      data: {
        professionalId: professional.id,
        start: "2030-11-05T10:00:00.000Z",
        end: "2030-11-05T11:00:00.000Z",
        reason: "Afastamento fictício",
      },
    });
    await assert.rejects(
      specialist.save({
        table: "appointments",
        data: {
          ...data,
          start: "2030-11-05T10:00:00.000Z",
          end: "2030-11-05T11:00:00.000Z",
        },
      }),
    );
  });
  await step(
    "schema pollution and counter bypass fail at database",
    async () => {
      await assertFails(
        updateDoc(doc(a, "students", student.id), { isAdmin: true }),
      );
      await assertFails(
        updateDoc(
          doc(a, "calendar_guards", `p_${professional.id}_2030-11-04`),
          { bookings: { 28: "other" } },
        ),
      );
    },
  );
  await step("pending user cannot list students or self-promote", async () => {
    const p = ctx("new");
    const pending = createStore(
      null,
      { uid: "new", email: "new@example.invalid", displayName: "Pendente" },
      () => {},
      p,
    );
    stops.push(await pending.initialize());
    assert.equal((await pending.stateFor("students")).user.status, "Pendente");
    await assertFails(getDocs(query(collection(p, "students"), limit(40))));
    await assertFails(
      updateDoc(doc(p, "users", "new"), {
        role: "superadmin",
        status: "Ativo",
      }),
    );
  });
  await step("student delete and audit rewrite forbidden", async () => {
    await assertFails(deleteDoc(doc(root, "students", student.id)));
    const audits = await getDocs(query(collection(root, "audit"), limit(40)));
    await assertFails(updateDoc(audits.docs[0].ref, { action: "alterado" }));
  });
  await step("aggregation and scoped paginated queries", async () => {
    const result = await store.stateFor("dashboard");
    assert.equal(result._counts.students, 1);
    await assertSucceeds(
      getDocs(
        query(
          collection(a, "students"),
          where("schoolId", "in", [schoolA.id]),
          limit(40),
        ),
      ),
    );
  });
  console.log("FIRESTORE INTEGRATION: " + tests + " passed");
} finally {
  for (const stop of stops) stop?.();
  await env.cleanup();
}
