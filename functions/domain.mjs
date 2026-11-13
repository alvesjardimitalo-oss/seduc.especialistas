export const TABLES = [
  "users",
  "schools",
  "professionals",
  "links",
  "students",
  "enrollments",
  "appointments",
  "notes",
  "attendance",
  "blocks",
  "referrals",
  "audit",
  "versions",
];
export const ROLES = [
  "superadmin",
  "secretaria",
  "direcao",
  "especialista",
  "visualizador",
];
export class DomainError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export const fail = (ok, message, status = 400) => {
  if (!ok) throw new DomainError(message, status);
};
export const emptyState = () => Object.fromEntries(TABLES.map((t) => [t, []]));
const id = () => crypto.randomUUID();
const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
export function localParts(iso) {
  const d = new Date(iso);
  fail(Number.isFinite(+d), "Data inválida.");
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    minute: +parts.hour * 60 + +parts.minute,
    weekday: new Date(
      `${parts.year}-${parts.month}-${parts.day}T12:00:00Z`,
    ).getUTCDay(),
  };
}
const text = (v, max = 200, required = false) => {
  fail(
    typeof v === "string" &&
      v.length <= max &&
      (!required || v.trim().length > 0),
    "Campo de texto ausente ou inválido.",
  );
  return v.trim();
};
const date = (v) => {
  text(v, 10, true);
  fail(
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
      new Date(`${v}T12:00:00Z`).toISOString().slice(0, 10) === v,
    "Data inválida.",
  );
  return v;
};
const optionalDate = (v) => (v ? date(v) : "");
const ref = (s, t, key) => {
  fail(typeof key === "string" && key.length < 150, "Referência inválida.");
  const row = s[t].find((r) => r.id === key);
  fail(row, "Registro não encontrado.", 404);
  return row;
};
const enumValue = (v, values) => {
  fail(values.includes(v), "Opção inválida.");
  return v;
};
const email = (v) => {
  v = text(v, 200);
  fail(!v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "E-mail inválido.");
  return v.toLowerCase();
};
const bool = (v) => {
  fail(typeof v === "boolean", "Valor booleano inválido.");
  return v;
};
const strings = (v) => {
  fail(
    Array.isArray(v) &&
      v.length <= 50 &&
      v.every((x) => typeof x === "string" && x.length > 0 && x.length < 150),
    "Lista inválida.",
  );
  return [...new Set(v)];
};
const pick = (o, keys) => {
  fail(o && typeof o === "object" && !Array.isArray(o), "Dados inválidos.");
  fail(
    Object.keys(o).every((k) => keys.includes(k)),
    "Campo não permitido.",
  );
  return o;
};
const admin = (u) => u.role === "superadmin";
export const manager = (u) =>
  admin(u) || (u.role === "secretaria" && u.manageUsers);
const scope = (u, school) =>
  admin(u) || u.role === "secretaria" || u.schoolIds.includes(school);
const activeLink = (s, u, school, day = today()) =>
  s.links.some(
    (l) =>
      l.userId === u.id &&
      l.schoolId === school &&
      l.status === "Ativo" &&
      l.start <= day &&
      (!l.end || l.end >= day),
  );
const schoolAccess = (s, u, school) =>
  scope(u, school) && (u.role !== "especialista" || activeLink(s, u, school));
const allowedSchool = (s, u, school) =>
  fail(schoolAccess(s, u, school), "Você não tem acesso a esta escola.", 403);
const clinical = (u) => admin(u) || u.role === "especialista";
const writer = (s, u, school) => {
  allowedSchool(s, u, school);
  fail(clinical(u), "Seu perfil não permite essa operação.", 403);
};
const cancelStatuses = ["Cancelado", "Remarcado"];
const metadata = ["id", "createdAt", "updatedAt", "createdBy", "version"];

function validate(s, u, table, d, old) {
  switch (table) {
    case "schools": {
      fail(manager(u), "Somente a administração pode cadastrar escolas.", 403);
      pick(d, [
        "name",
        "inep",
        "address",
        "phone",
        "email",
        "director",
        "status",
        "remarks",
      ]);
      return {
        name: text(d.name, 200, true),
        inep: text(d.inep || "", 20),
        address: text(d.address || "", 400),
        phone: text(d.phone || "", 30),
        email: email(d.email || ""),
        director: text(d.director || "", 200),
        status: enumValue(d.status, ["Ativo", "Inativo"]),
        remarks: text(d.remarks || "", 1000),
      };
    }
    case "professionals": {
      fail(
        manager(u),
        "Somente a administração pode cadastrar profissionais.",
        403,
      );
      pick(d, [
        "name",
        "email",
        "phone",
        "specialty",
        "status",
        "birth",
        "cpf",
        "address",
        "remarks",
      ]);
      const r = {
        name: text(d.name, 200, true),
        email: email(d.email || ""),
        phone: text(d.phone || "", 30),
        specialty: text(d.specialty, 100, true),
        status: enumValue(d.status, [
          "Pendente",
          "Ativo",
          "Afastado",
          "Inativo",
        ]),
        birth: optionalDate(d.birth || ""),
        cpf: text(d.cpf || "", 14),
        address: text(d.address || "", 400),
        remarks: text(d.remarks || "", 1000),
      };
      fail(
        !r.email ||
          !s.professionals.some((p) => p.id !== old?.id && p.email === r.email),
        "Já existe um profissional com esse e-mail.",
        409,
      );
      return r;
    }
    case "users": {
      fail(
        manager(u) && old,
        "Somente usuários existentes podem ser aprovados.",
        403,
      );
      fail(old.id !== u.id, "Não é permitido alterar o próprio acesso.", 403);
      pick(d, [
        "name",
        "role",
        "status",
        "schoolIds",
        "manageUsers",
        "canExport",
      ]);
      const role = enumValue(d.role, ROLES);
      fail(
        admin(u) ||
          (!d.manageUsers &&
            role !== "superadmin" &&
            old.role !== "superadmin" &&
            !old.manageUsers),
        "Não é permitido conceder ou alterar esse nível de acesso.",
        403,
      );
      const schoolIds = strings(d.schoolIds);
      schoolIds.forEach((x) => ref(s, "schools", x));
      return {
        name: text(d.name, 200, true),
        email: old.email,
        role,
        status: enumValue(d.status, ["Pendente", "Ativo", "Inativo"]),
        schoolIds,
        manageUsers: bool(d.manageUsers),
        canExport: bool(d.canExport),
      };
    }
    case "links": {
      fail(manager(u), "Somente a administração pode gerenciar vínculos.", 403);
      pick(d, [
        "professionalId",
        "userId",
        "schoolId",
        "job",
        "specialty",
        "start",
        "end",
        "status",
        "weeklyHours",
        "schedule",
      ]);
      const p = ref(s, "professionals", d.professionalId);
      ref(s, "schools", d.schoolId);
      if (d.userId) {
        const target = ref(s, "users", d.userId);
        fail(
          target.email === p.email && p.email,
          "A conta deve corresponder ao e-mail do profissional.",
        );
      }
      fail(
        Array.isArray(d.schedule) && d.schedule.length <= 21,
        "Jornada inválida.",
      );
      const schedule = d.schedule.map((x) => {
        pick(x, ["day", "start", "end"]);
        fail(
          Number.isInteger(x.day) &&
            x.day >= 0 &&
            x.day <= 6 &&
            Number.isInteger(x.start) &&
            Number.isInteger(x.end) &&
            x.start >= 0 &&
            x.end <= 1440 &&
            x.start < x.end,
          "Intervalo de jornada inválido.",
        );
        return x;
      });
      for (let i = 0; i < schedule.length; i++)
        for (let j = i + 1; j < schedule.length; j++)
          fail(
            schedule[i].day !== schedule[j].day ||
              schedule[i].start >= schedule[j].end ||
              schedule[i].end <= schedule[j].start,
            "Jornadas sobrepostas.",
          );
      fail(
        Number.isFinite(d.weeklyHours) &&
          d.weeklyHours >= 0 &&
          d.weeklyHours <= 80,
        "Carga horária inválida.",
      );
      const start = date(d.start),
        end = optionalDate(d.end || "");
      fail(!end || end >= start, "O fim deve ser posterior ao início.");
      const status = enumValue(d.status, [
        "Pendente",
        "Ativo",
        "Afastado",
        "Encerrado",
      ]);
      fail(
        status !== "Ativo" ||
          (p.status === "Ativo" && d.userId && schedule.length > 0),
        "Para ativar, confirme profissional, usuário e jornada.",
      );
      // Historical links cannot be reassigned; close the old link and create another.
      if (old)
        fail(
          ["professionalId", "schoolId", "userId"].every(
            (k) => old[k] === d[k],
          ),
          "Crie outro vínculo para mudar profissional, usuário ou escola.",
        );
      return {
        ...d,
        userId: text(d.userId || "", 150),
        job: text(d.job, 150, true),
        specialty: text(d.specialty, 100, true),
        start,
        end,
        status,
        schedule,
      };
    }
    case "students": {
      pick(d, [
        "name",
        "registration",
        "schoolId",
        "birth",
        "guardian",
        "phone",
        "address",
        "status",
        "reason",
      ]);
      writer(s, u, d.schoolId);
      if (old) allowedSchool(s, u, old.schoolId);
      ref(s, "schools", d.schoolId);
      const registration = text(d.registration, 60, true);
      fail(
        !s.students.some(
          (a) => a.id !== old?.id && a.registration === registration,
        ),
        "Matrícula já cadastrada. Consulte a administração para transferência.",
        409,
      );
      if (old)
        fail(old.registration === registration, "A matrícula é imutável.");
      if (old && old.schoolId !== d.schoolId)
        fail(admin(u), "Transferência requer superadministrador.", 403);
      const status = enumValue(d.status, ["Ativo", "Arquivado"]);
      const reason = text(d.reason || "", 500);
      fail(
        status !== "Arquivado" || reason,
        "Informe o motivo do arquivamento.",
      );
      return {
        ...d,
        name: text(d.name, 200, true),
        registration,
        birth: optionalDate(d.birth || ""),
        guardian: text(d.guardian || "", 200),
        phone: text(d.phone || "", 30),
        address: text(d.address || "", 400),
        status,
        reason,
      };
    }
    case "appointments": {
      pick(d, [
        "schoolId",
        "studentId",
        "linkId",
        "start",
        "end",
        "modality",
        "status",
        "reason",
      ]);
      writer(s, u, d.schoolId);
      const link = ref(s, "links", d.linkId),
        student = ref(s, "students", d.studentId),
        p = ref(s, "professionals", link.professionalId);
      fail(
        admin(u) || link.userId === u.id,
        "Agende apenas no seu vínculo.",
        403,
      );
      if (old) {
        fail(
          admin(u) || old.authorId === u.id,
          "Somente o autor pode alterar.",
          403,
        );
        fail(
          ["schoolId", "studentId", "linkId", "start", "end"].every(
            (k) => d[k] === old[k],
          ),
          "Para mudar horário ou vínculo, marque como remarcado e crie outro agendamento.",
        );
      }
      fail(
        link.schoolId === d.schoolId &&
          student.schoolId === d.schoolId &&
          student.status === "Ativo",
        "Aluno e vínculo devem pertencer à mesma escola ativa.",
      );
      const start = text(d.start, 40, true),
        end = text(d.end, 40, true);
      fail(
        /(Z|[+-]\d{2}:\d{2})$/.test(start) && /(Z|[+-]\d{2}:\d{2})$/.test(end),
        "Informe o fuso horário.",
      );
      const a = localParts(start),
        b = localParts(end);
      fail(
        +new Date(end) > +new Date(start) &&
          a.day === b.day &&
          +new Date(end) - +new Date(start) <= 8 * 3600000,
        "Intervalo inválido (máximo 8 horas no mesmo dia).",
      );
      const status = enumValue(d.status, [
        "Agendado",
        "Realizado",
        "Cancelado",
        "Remarcado",
        "Falta do aluno",
        "Falta do profissional",
      ]);
      const reason = text(d.reason || "", 500);
      fail(
        !cancelStatuses.includes(status) || reason,
        "Informe a justificativa.",
      );
      if (!old || !cancelStatuses.includes(status)) {
        fail(
          link.status === "Ativo" &&
            p.status === "Ativo" &&
            link.start <= a.day &&
            (!link.end || link.end >= a.day),
          "Vínculo ou profissional não está ativo nessa data.",
        );
        fail(
          link.schedule.some(
            (x) =>
              x.day === a.weekday && x.start <= a.minute && x.end >= b.minute,
          ),
          "Horário fora da jornada vigente.",
        );
        fail(
          !s.blocks.some(
            (x) => x.professionalId === p.id && x.start < end && x.end > start,
          ),
          "Profissional afastado ou com bloqueio nesse intervalo.",
          409,
        );
        fail(
          !s.appointments.some(
            (x) =>
              x.id !== old?.id &&
              !cancelStatuses.includes(x.status) &&
              (x.professionalId === p.id || x.studentId === student.id) &&
              +new Date(x.start) < +new Date(end) &&
              +new Date(x.end) > +new Date(start),
          ),
          "Conflito de horário do aluno ou profissional.",
          409,
        );
      }
      return {
        schoolId: d.schoolId,
        studentId: student.id,
        linkId: link.id,
        professionalId: p.id,
        authorId: old?.authorId || link.userId,
        start,
        end,
        status,
        reason,
        modality: text(d.modality, 100, true),
      };
    }
    case "notes": {
      pick(d, ["appointmentId", "text", "referral", "returnDate", "reason"]);
      const a = ref(s, "appointments", d.appointmentId);
      writer(s, u, a.schoolId);
      fail(
        admin(u) || a.authorId === u.id,
        "Somente a autora pode registrar ou editar o atendimento.",
        403,
      );
      if (old)
        fail(
          old.appointmentId === a.id && text(d.reason || "", 500, true),
          "Informe o motivo da alteração.",
        );
      fail(
        !s.notes.some((n) => n.appointmentId === a.id && n.id !== old?.id),
        "Atendimento já registrado; edite a evolução existente.",
        409,
      );
      fail(
        !cancelStatuses.includes(a.status),
        "Não é possível registrar atendimento cancelado.",
      );
      return {
        appointmentId: a.id,
        schoolId: a.schoolId,
        studentId: a.studentId,
        authorId: a.authorId,
        text: text(d.text, 1000, true),
        referral: text(d.referral || "", 1000),
        returnDate: optionalDate(d.returnDate || ""),
        reason: text(d.reason || "", 500),
      };
    }
    case "attendance": {
      pick(d, ["linkId", "day", "entry", "exit", "status", "reason"]);
      const l = ref(s, "links", d.linkId);
      writer(s, u, l.schoolId);
      fail(
        admin(u) || l.userId === u.id,
        "Registre apenas sua frequência.",
        403,
      );
      if (old)
        fail(
          old.linkId === d.linkId && old.day === d.day,
          "Vínculo e dia são imutáveis.",
        );
      const day = date(d.day);
      fail(
        l.start <= day && (!l.end || l.end >= day) && l.status === "Ativo",
        "Vínculo não está vigente.",
      );
      fail(
        !s.attendance.some(
          (a) => a.id !== old?.id && a.linkId === l.id && a.day === day,
        ),
        "Frequência desse dia já registrada.",
        409,
      );
      const status = enumValue(d.status, [
        "Presente",
        "Ausente",
        "Justificado",
      ]);
      const entry = text(d.entry || "", 5),
        exit = text(d.exit || "", 5),
        reason = text(d.reason || "", 500);
      if (status === "Presente")
        fail(
          /^([01]\d|2[0-3]):[0-5]\d$/.test(entry) &&
            /^([01]\d|2[0-3]):[0-5]\d$/.test(exit) &&
            exit > entry,
          "Entrada e saída inválidas.",
        );
      else fail(reason, "Justifique a ausência.");
      return {
        linkId: l.id,
        schoolId: l.schoolId,
        professionalId: l.professionalId,
        authorId: l.userId,
        day,
        entry,
        exit,
        status,
        reason,
      };
    }
    case "blocks": {
      fail(manager(u), "Somente administração gerencia bloqueios.", 403);
      pick(d, ["professionalId", "start", "end", "reason"]);
      ref(s, "professionals", d.professionalId);
      localParts(d.start);
      localParts(d.end);
      fail(+new Date(d.end) > +new Date(d.start), "Intervalo inválido.");
      return {
        professionalId: d.professionalId,
        start: d.start,
        end: d.end,
        reason: text(d.reason, 500, true),
      };
    }
    case "referrals": {
      pick(d, ["studentId", "schoolId", "description", "due", "status"]);
      writer(s, u, d.schoolId);
      const student = ref(s, "students", d.studentId);
      fail(student.schoolId === d.schoolId, "Escola inválida.");
      if (old)
        fail(
          admin(u) || old.authorId === u.id,
          "Somente o autor pode editar.",
          403,
        );
      return {
        studentId: student.id,
        schoolId: d.schoolId,
        description: text(d.description, 1000, true),
        due: optionalDate(d.due || ""),
        status: enumValue(d.status, ["Pendente", "Em andamento", "Concluído"]),
        authorId: old?.authorId || u.id,
      };
    }
    default:
      throw new DomainError("Operação não permitida.", 403);
  }
}

export function session(s, identity) {
  fail(identity?.uid, "Entre para continuar.", 401);
  let u = s.users.find((x) => x.id === identity.uid);
  if (!u) {
    u = {
      id: identity.uid,
      name: text(identity.name || "Usuário", 200, true),
      email: email(identity.email || ""),
      role: "visualizador",
      status: "Pendente",
      schoolIds: [],
      manageUsers: false,
      canExport: false,
      version: 1,
      createdAt: new Date().toISOString(),
    };
    s.users.push(u);
    audit(s, u, "solicitar_acesso", "users", u.id);
  }
  return u;
}
export function audit(s, u, action, table, targetId) {
  s.audit.push({
    id: id(),
    actorId: u.id,
    action,
    table,
    targetId,
    at: new Date().toISOString(),
  });
}
export function mutate(s, identity, { table, data, id: targetId, version }) {
  const u = session(s, identity);
  fail(u.status === "Ativo", "Acesso pendente ou desativado.", 403);
  fail(TABLES.includes(table), "Módulo inválido.");
  const old = targetId ? ref(s, table, targetId) : undefined;
  if (old)
    fail(
      old.version === version,
      "Este registro mudou. Atualize a página antes de salvar.",
      409,
    );
  const clean = validate(s, u, table, data, old);
  const now = new Date().toISOString();
  const row = {
    ...clean,
    id: old?.id || id(),
    version: (old?.version || 0) + 1,
    createdAt: old?.createdAt || now,
    createdBy: old?.createdBy || u.id,
    updatedAt: now,
  };
  if (old) {
    s.versions.push({
      id: id(),
      table,
      targetId: old.id,
      before: structuredClone(old),
      actorId: u.id,
      at: now,
    });
    s[table][s[table].indexOf(old)] = row;
  } else s[table].push(row);
  if (table === "students" && (!old || old.schoolId !== row.schoolId)) {
    s.enrollments
      .filter((e) => e.studentId === row.id && !e.end)
      .forEach((e) => {
        e.end = today();
      });
    s.enrollments.push({
      id: id(),
      studentId: row.id,
      schoolId: row.schoolId,
      start: today(),
      end: "",
      createdBy: u.id,
    });
  }
  if (table === "notes") {
    const a = ref(s, "appointments", row.appointmentId);
    a.status = "Realizado";
    a.updatedAt = now;
    a.version++;
  }
  audit(s, u, old ? "atualizar" : "cadastrar", table, row.id);
  return { id: row.id, version: row.version };
}

export function view(s, identity) {
  const u = session(s, identity);
  const result = { user: u };
  if (u.status !== "Ativo") return result;
  const visible = (school) => schoolAccess(s, u, school);
  result.schools = s.schools.filter((x) => scope(u, x.id));
  result.links = s.links.filter((x) => visible(x.schoolId));
  result.professionals = s.professionals
    .filter(
      (p) => manager(u) || result.links.some((l) => l.professionalId === p.id),
    )
    .map((p) =>
      manager(u)
        ? p
        : { id: p.id, name: p.name, specialty: p.specialty, status: p.status },
    );
  result.students = s.students
    .filter((x) => visible(x.schoolId))
    .map((x) =>
      ["visualizador", "secretaria"].includes(u.role)
        ? Object.fromEntries(
            ["id", "name", "registration", "schoolId", "status"].map((k) => [
              k,
              x[k],
            ]),
          )
        : x,
    );
  for (const t of ["appointments", "attendance", "enrollments"])
    result[t] = s[t].filter((x) => visible(x.schoolId));
  result.notes = clinical(u) ? s.notes.filter((x) => visible(x.schoolId)) : [];
  result.referrals = clinical(u)
    ? s.referrals.filter((x) => visible(x.schoolId))
    : [];
  result.blocks = manager(u) ? s.blocks : [];
  result.users = manager(u) ? s.users : [];
  result.audit = admin(u) ? s.audit.slice(-300).reverse() : [];
  result.versions = admin(u) ? s.versions.slice(-100).reverse() : [];
  return result;
}

export function report(s, identity, filters = {}) {
  const u = session(s, identity);
  fail(
    u.status === "Ativo" && (u.canExport || admin(u)),
    "Exportação não autorizada.",
    403,
  );
  const v = view(s, identity);
  const rows = v.appointments.filter(
    (a) =>
      (!filters.schoolId || a.schoolId === filters.schoolId) &&
      (!filters.from || a.start.slice(0, 10) >= filters.from) &&
      (!filters.to || a.start.slice(0, 10) <= filters.to),
  );
  const totals = new Map();
  for (const a of rows) {
    const p = s.professionals.find((x) => x.id === a.professionalId);
    const key = [a.schoolId, p?.specialty || "", a.status].join("|");
    const r = totals.get(key) || {
      escola: s.schools.find((x) => x.id === a.schoolId)?.name || "",
      especialidade: p?.specialty || "",
      situacao: a.status,
      quantidade: 0,
      horas: 0,
    };
    r.quantidade++;
    r.horas += (+new Date(a.end) - +new Date(a.start)) / 3600000;
    totals.set(key, r);
  }
  audit(s, u, "exportar_relatorio", "appointments", "agregado");
  return [...totals.values()];
}

export function initialSchools(s) {
  const names = [
    "Escola Municipal Doutor João de Souza Lima",
    "Escola Municipal Professora Terezinha Sarmento de Oliveira",
    "Creche Municipal Wilma Glória Nunes Mourão",
    "Escola Municipal Prefeito José Pedro da Silva",
    "Escola Municipal Monteiro Lobato",
  ];
  names.forEach((name, i) => {
    if (!s.schools.some((x) => x.name === name))
      s.schools.push({
        id: `escola-${i + 1}`,
        name,
        inep: "",
        address: "",
        phone: "",
        email: "",
        director: "",
        status: "Ativo",
        remarks: "",
        version: 1,
        createdAt: new Date().toISOString(),
        createdBy: "implantacao",
      });
  });
}
export function demoState() {
  const s = emptyState();
  initialSchools(s);
  s.users.push({
    id: "demo-admin",
    name: "Administração · demonstração",
    email: "admin@example.invalid",
    role: "superadmin",
    status: "Ativo",
    schoolIds: [],
    manageUsers: true,
    canExport: true,
    version: 1,
  });
  return s;
}
