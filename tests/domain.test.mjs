import { test } from "node:test";
import assert from "node:assert/strict";
import {
  demoState,
  mutate,
  view,
  report,
  localParts,
} from "../functions/domain.mjs";
const root = { uid: "demo-admin", email: "admin@example.invalid" };
function fixture() {
  const s = demoState();
  const schoolId = s.schools[0].id,
    otherSchool = s.schools[1].id;
  for (const [id, school] of [
    ["a", schoolId],
    ["b", schoolId],
    ["c", otherSchool],
  ]) {
    s.users.push({
      id,
      name: id,
      email: id + "@example.invalid",
      status: "Ativo",
      role: "especialista",
      schoolIds: [school],
      canExport: false,
      manageUsers: false,
      version: 1,
    });
    const p = mutate(s, root, {
      table: "professionals",
      data: {
        name: id,
        email: id + "@example.invalid",
        specialty: "Psicopedagogia",
        status: "Ativo",
      },
    });
    mutate(s, root, {
      table: "links",
      data: {
        professionalId: p.id,
        userId: id,
        schoolId: school,
        job: "Especialista",
        specialty: "Psicopedagogia",
        start: "2020-01-01",
        end: "",
        weeklyHours: 40,
        status: "Ativo",
        schedule: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
          day,
          start: 420,
          end: 1020,
        })),
      },
    });
  }
  const student = mutate(s, root, {
    table: "students",
    data: {
      name: "Aluno fictício",
      registration: "DEMO-001",
      schoolId,
      status: "Ativo",
    },
  });
  const link = s.links.find((x) => x.userId === "a");
  const appointment = {
    schoolId,
    studentId: student.id,
    linkId: link.id,
    start: "2030-11-04T10:00:00.000Z",
    end: "2030-11-04T11:00:00.000Z",
    modality: "Presencial",
    status: "Agendado",
  };
  return { s, schoolId, otherSchool, student, appointment };
}
const save = (s, who, table, data, old) =>
  mutate(
    s,
    { uid: who, email: who + "@example.invalid" },
    { table, data, ...(old ? { id: old.id, version: old.version } : {}) },
  );
test("first login stays pending and never reveals records", () => {
  const { s } = fixture();
  const result = view(s, { uid: "new", email: "new@example.invalid" });
  assert.equal(result.user.status, "Pendente");
  assert.deepEqual(Object.keys(result), ["user"]);
  assert.throws(
    () => save(s, "new", "schools", { name: "x", status: "Ativo" }),
    /pendente/,
  );
});
test("school B specialist cannot read or modify school A", () => {
  const { s, appointment } = fixture();
  const a = save(s, "a", "appointments", appointment);
  assert.equal(view(s, { uid: "c" }).appointments.length, 0);
  assert.equal(view(s, { uid: "c" }).students.length, 0);
  assert.throws(() => save(s, "c", "appointments", appointment), /acesso/);
  assert.ok(a.id);
});
test("authorized specialists share notes; only author can edit", () => {
  const { s, appointment } = fixture();
  const a = save(s, "a", "appointments", appointment);
  const n = save(s, "a", "notes", {
    appointmentId: a.id,
    text: "Evolução fictícia",
  });
  assert.equal(view(s, { uid: "b" }).notes.length, 1);
  const old = s.notes.find((x) => x.id === n.id);
  assert.throws(
    () =>
      save(
        s,
        "b",
        "notes",
        { appointmentId: a.id, text: "Mudança", reason: "Teste" },
        old,
      ),
    /autora/,
  );
  save(
    s,
    "a",
    "notes",
    { appointmentId: a.id, text: "Outra evolução", reason: "Correção" },
    old,
  );
  assert.equal(s.versions.at(-1).before.text, "Evolução fictícia");
});
test("prevents overlapping appointments, including different schools and students", () => {
  const { s, appointment } = fixture();
  save(s, "a", "appointments", appointment);
  assert.throws(() => save(s, "a", "appointments", appointment), /Conflito/);
  const second = save(s, "demo-admin", "students", {
    name: "Outro fictício",
    registration: "DEMO-002",
    schoolId: appointment.schoolId,
    status: "Ativo",
  });
  assert.throws(
    () =>
      save(s, "a", "appointments", { ...appointment, studentId: second.id }),
    /Conflito/,
  );
});
test("validates working hours, leaves and pending professionals", () => {
  const { s, appointment } = fixture();
  assert.throws(
    () =>
      save(s, "a", "appointments", {
        ...appointment,
        start: "2030-11-04T09:00:00Z",
        end: "2030-11-04T10:00:00Z",
      }),
    /jornada/,
  );
  save(s, "demo-admin", "blocks", {
    professionalId: s.links[0].professionalId,
    start: "2030-11-04T09:00:00.000Z",
    end: "2030-11-04T12:00:00.000Z",
    reason: "Férias",
  });
  assert.throws(() => save(s, "a", "appointments", appointment), /bloqueio/);
  s.blocks = [];
  s.professionals[0].status = "Pendente";
  assert.throws(() => save(s, "a", "appointments", appointment), /ativo/);
});
test("archives preserve clinical history and stop new appointments", () => {
  const { s, appointment } = fixture();
  save(s, "a", "appointments", appointment);
  const old = s.students[0];
  save(
    s,
    "demo-admin",
    "students",
    {
      name: old.name,
      registration: old.registration,
      schoolId: old.schoolId,
      status: "Arquivado",
      reason: "Encerramento",
    },
    old,
  );
  assert.equal(s.appointments.length, 1);
  assert.throws(() => save(s, "a", "appointments", appointment), /ativa/);
});
test("cannot self promote or modify own authorization", () => {
  const { s } = fixture();
  const target = s.users.find((x) => x.id === "a");
  assert.throws(
    () =>
      save(
        s,
        "a",
        "users",
        {
          name: "a",
          role: "superadmin",
          status: "Ativo",
          schoolIds: [],
          manageUsers: true,
          canExport: true,
        },
        target,
      ),
    /Somente/,
  );
  assert.throws(
    () =>
      save(
        s,
        "demo-admin",
        "users",
        {
          name: "root",
          role: "superadmin",
          status: "Ativo",
          schoolIds: [],
          manageUsers: true,
          canExport: true,
        },
        s.users[0],
      ),
    /próprio/,
  );
});
test("delegated secretary cannot grant admin or another delegation", () => {
  const { s } = fixture();
  s.users.push({
    id: "sec",
    status: "Ativo",
    role: "secretaria",
    manageUsers: true,
    schoolIds: [],
  });
  const target = s.users.find((x) => x.id === "a");
  assert.throws(
    () =>
      save(
        s,
        "sec",
        "users",
        {
          name: "a",
          role: "superadmin",
          status: "Ativo",
          schoolIds: [],
          manageUsers: false,
          canExport: false,
        },
        target,
      ),
    /nível/,
  );
  assert.throws(
    () =>
      save(
        s,
        "sec",
        "users",
        {
          name: "a",
          role: "secretaria",
          status: "Ativo",
          schoolIds: [],
          manageUsers: true,
          canExport: false,
        },
        target,
      ),
    /nível/,
  );
});
test("revocation is immediate on next request", () => {
  const { s } = fixture();
  s.users.find((x) => x.id === "a").status = "Inativo";
  assert.deepEqual(Object.keys(view(s, { uid: "a" })), ["user"]);
  assert.throws(() => save(s, "a", "students", {}), /desativado/);
});
test("strict schemas reject extra fields, oversized notes and invalid dates", () => {
  const { s, appointment } = fixture();
  assert.throws(
    () =>
      save(s, "a", "students", {
        name: "x",
        registration: "x",
        schoolId: appointment.schoolId,
        status: "Ativo",
        isAdmin: true,
      }),
    /Campo não permitido/,
  );
  assert.throws(
    () =>
      save(s, "a", "students", {
        name: "x",
        registration: "x",
        schoolId: appointment.schoolId,
        status: "Ativo",
        birth: "2025-02-30",
      }),
    /Data inválida/,
  );
  const a = save(s, "a", "appointments", appointment);
  assert.throws(
    () =>
      save(s, "a", "notes", { appointmentId: a.id, text: "x".repeat(1001) }),
    /texto/,
  );
});
test("optimistic version guard prevents overwriting another session", () => {
  const { s } = fixture();
  const old = structuredClone(s.students[0]);
  const data = {
    name: old.name,
    registration: old.registration,
    schoolId: old.schoolId,
    status: "Ativo",
  };
  save(s, "a", "students", data, old);
  assert.throws(() => save(s, "a", "students", data, old), /registro mudou/);
});
test("reports exclude student identity and clinical text; export is authorized", () => {
  const { s, appointment } = fixture();
  save(s, "a", "appointments", appointment);
  assert.throws(() => report(s, { uid: "a" }), /não autorizada/);
  const rows = report(s, root);
  assert.equal(rows[0].quantidade, 1);
  assert.equal(rows[0].horas, 1);
  assert.ok(!JSON.stringify(rows).includes("Aluno fictício"));
});
test("attendance is independent of clinical completion and deduplicated", () => {
  const { s, appointment } = fixture();
  const a = save(s, "a", "appointments", appointment);
  save(s, "a", "notes", { appointmentId: a.id, text: "Registro fictício" });
  assert.equal(s.attendance.length, 0);
  const d = {
    linkId: appointment.linkId,
    day: "2030-11-04",
    entry: "07:00",
    exit: "17:00",
    status: "Presente",
  };
  save(s, "a", "attendance", d);
  assert.throws(() => save(s, "a", "attendance", d), /já registrada/);
});
test("transfers preserve original enrollment and require admin", () => {
  const { s, otherSchool } = fixture(),
    old = s.students[0],
    data = {
      name: old.name,
      registration: old.registration,
      schoolId: otherSchool,
      status: "Ativo",
    };
  assert.throws(() => save(s, "a", "students", data, old), /acesso/);
  save(s, "demo-admin", "students", data, old);
  assert.equal(s.enrollments.length, 2);
  assert.ok(s.enrollments[0].end);
  assert.equal(view(s, { uid: "a" }).students.length, 0);
});
test("Sao Paulo dates and weekdays are independent of host timezone", () => {
  assert.deepEqual(localParts("2030-11-04T02:30:00Z"), {
    day: "2030-11-03",
    minute: 1410,
    weekday: 0,
  });
});
