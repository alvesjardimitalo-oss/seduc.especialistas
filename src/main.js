import "./style.css";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import { createStore } from "./firebase-store.js";
import {
  createIcons,
  LayoutDashboard,
  School,
  Users,
  GraduationCap,
  CalendarDays,
  ClipboardList,
  Clock,
  ChartNoAxesCombined,
  ShieldCheck,
  History,
  ArrowUpRight,
  Plus,
  Search,
  ChevronRight,
  LogOut,
  Menu,
  X,
  Link,
  CalendarOff,
  HeartHandshake,
  Check,
  RefreshCw,
  Download,
  Printer,
  NotebookPen,
} from "lucide";
const icons = {
  LayoutDashboard,
  School,
  Users,
  GraduationCap,
  CalendarDays,
  ClipboardList,
  Clock,
  ChartNoAxesCombined,
  ShieldCheck,
  History,
  ArrowUpRight,
  Plus,
  Search,
  ChevronRight,
  LogOut,
  Menu,
  X,
  Link,
  CalendarOff,
  HeartHandshake,
  Check,
  RefreshCw,
  Download,
  Printer,
  NotebookPen,
};
const app = document.querySelector("#app");
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const icon = (name) => `<i data-lucide="${name}" aria-hidden="true"></i>`;
const labelRole = {
  superadmin: "Superadministrador",
  secretaria: "Secretaria de Educação",
  direcao: "Direção escolar",
  especialista: "Especialista",
  visualizador: "Visualizador",
};
const nav = [
  ["dashboard", "Visão geral", "layout-dashboard"],
  ["schools", "Escolas", "school"],
  ["professionals", "Profissionais", "users"],
  ["staff", "Servidores escolares", "users"],
  ["links", "Vínculos e jornadas", "link"],
  ["students", "Alunos", "graduation-cap"],
  ["appointments", "Agenda", "calendar-days"],
  ["notes", "Atendimentos", "clipboard-list"],
  ["attendance", "Frequência", "clock"],
  ["referrals", "Encaminhamentos", "heart-handshake"],
  ["reports", "Relatórios", "chart-no-axes-combined"],
  ["users", "Usuários e permissões", "shield-check"],
  ["blocks", "Afastamentos", "calendar-off"],
  ["audit", "Auditoria", "history"],
];
let state = {},
  page = "dashboard",
  search = "",
  schoolFilter = "",
  from = "",
  to = "",
  statusFilter = "",
  professionalFilter = "",
  specialtyFilter = "",
  demo = false,
  auth = null,
  currentUser = null,
  store = null,
  unsubscribe = null;
const admin = () => state.user?.role === "superadmin";
const manager = () =>
  admin() || (state.user?.role === "secretaria" && state.user?.manageUsers);
const clinical = () => admin() || state.user?.role === "especialista";
const canCreate = (t) =>
  t === "users"
    ? false
    : ["schools", "professionals", "links", "blocks"].includes(t)
      ? manager()
      : [
            "students",
            "appointments",
            "notes",
            "attendance",
            "referrals",
          ].includes(t)
        ? clinical()
        : false;
const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const fmt = (d, time = false) =>
  d
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        ...(time ? { timeStyle: "short" } : {}),
        timeZone: "America/Sao_Paulo",
      }).format(new Date(d.length === 10 ? d + "T12:00:00Z" : d))
    : "—";
const name = (t, id) => state[t]?.find((x) => x.id === id)?.name || "—";
const shortSchool = (id) =>
  name("schools", id)
    .replace("Escola Municipal ", "E.M. ")
    .replace("Creche Municipal ", "C.M. ");
const pill = (v) =>
  `<span class="badge ${["Ativo", "Realizado", "Presente", "Concluído"].includes(v) ? "green" : ["Inativo", "Arquivado", "Cancelado", "Ausente", "Falta do aluno", "Falta do profissional"].includes(v) ? "red" : "amber"}">${esc(v)}</span>`;
const button = (text, action, cls = "primary", ico = "plus") =>
  `<button class="${cls}" data-action="${action}">${icon(ico)}${esc(text)}</button>`;
function toast(message, error = false) {
  const el = document.querySelector("#toast");
  el.textContent = message;
  el.className = error ? "visible error" : "visible";
  setTimeout(() => (el.className = ""), 6000);
}
async function api(path, body) {
  if (store) {
    if (path === "state") return store.stateFor(page);
    if (path === "save") return store.save(body);
    if (path === "report") return store.report(body);
  }
  const headers = { "Content-Type": "application/json" };
  if (currentUser)
    headers.Authorization = `Bearer ${await currentUser.getIdToken()}`;
  const res = await fetch("/api/" + path, {
    method: body ? "POST" : "GET",
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Falha de conexão.");
  return data;
}
const friendly = (e) =>
  e.code === "failed-precondition"
    ? "As consultas estão sendo preparadas no Firebase. Aguarde um pouco e tente novamente."
    : e.code === "permission-denied"
      ? "Seu acesso não permite esta operação. Verifique a escola selecionada ou consulte a administração."
      : e.message;
async function load() {
  try {
    state = await api("state");
    render();
  } catch (e) {
    toast(friendly(e), true);
    if (!state.user) login(friendly(e));
  }
}
function login(error = "") {
  app.innerHTML = `<div class="login"><section class="login-brand"><div class="brand-mark">S<span>✦</span></div><p class="eyebrow">SECRETARIA MUNICIPAL DE EDUCAÇÃO</p><h1>Cuidar de cada aluno.<br>Conectar toda a rede.</h1><p>Um espaço para organizar o acompanhamento especializado, aproximar profissionais e apoiar trajetórias de aprendizagem.</p><div class="login-foot">SEDUC <span>/</span> Especialistas</div></section><section class="login-form"><div><span class="badge amber">ACESSO INSTITUCIONAL</span><h2>Bem-vindo ao SEDUC.</h2><p>Entre com sua conta Google. O acesso aos dados depende da aprovação da administração.</p>${error ? `<p class="form-error">${esc(error)}</p>` : ""}<button class="primary wide" id="google">Entrar com Google ${icon("arrow-up-right")}</button><small>Seus dados ficam disponíveis apenas para os perfis autorizados da rede.</small></div></section></div>`;
  createIcons({ icons });
  document.querySelector("#google").onclick = async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e) {
      toast("Não foi possível entrar: " + e.message, true);
    }
  };
}
function render() {
  if (!state.user) return;
  if (state.user.status !== "Ativo") {
    app.innerHTML = `<div class="pending"><div class="brand-mark">S<span>✦</span></div><h1>${state.user.status === "Pendente" ? "Solicitação recebida" : "Acesso desativado"}</h1><p>${esc(state.user.name)}, a administração precisa liberar seu acesso ao SEDUC Especialistas.</p><p>Nenhum cadastro está disponível enquanto seu acesso estiver pendente.</p>${button("Verificar aprovação", "refresh", "primary", "refresh-cw")}${button("Sair", "logout", "ghost", "log-out")}</div>`;
    bind();
    return;
  }
  const visibleNav = nav.filter(
    ([key]) =>
      !(["users", "blocks", "staff"].includes(key) && !manager()) &&
      !(key === "audit" && !admin()) &&
      !(key === "referrals" && !clinical()),
  );
  if (!visibleNav.some(([key]) => key === page)) page = "dashboard";
  const title = nav.find(([key]) => key === page)?.[1];
  app.innerHTML = `<div class="shell"><aside id="sidebar"><a class="brand" href="#dashboard"><div class="brand-mark">S<span>✦</span></div><div>SEDUC<strong>Especialistas</strong></div></a><div class="nav-caption">ACOMPANHAMENTO EDUCACIONAL</div><nav>${visibleNav.map(([key, text, ico]) => `<a href="#${key}" class="${page === key ? "active" : ""}">${icon(ico)}<span>${text}</span>${page === key ? '<span class="nav-dot"></span>' : ""}</a>`).join("")}</nav><div class="sidebar-bottom">${icon("shield-check")}<span>Rede municipal<br><small>Acesso institucional protegido</small></span></div></aside><div class="workspace"><header><button class="icon-btn mobile-menu" data-action="menu" aria-label="Abrir menu">${icon("menu")}</button><div class="breadcrumb">SEDUC <span>/</span> <strong>${title}</strong></div><div class="user"><span class="avatar">${esc(state.user.name.slice(0, 2).toUpperCase())}</span><div>${esc(state.user.name)}<small>${labelRole[state.user.role]}</small></div><button class="icon-btn" data-action="logout" aria-label="Sair">${icon("log-out")}</button></div></header>${demo ? '<div class="demo-bar">AMBIENTE DE DEMONSTRAÇÃO · Dados locais fictícios. Não insira informações reais.</div>' : ""}<main><div class="page-heading"><div><p class="eyebrow">REDE MUNICIPAL · EDUCAÇÃO INCLUSIVA</p><h1>${title}<span class="heading-dot">.</span></h1><p class="subtitle">${subtitles[page] || "Informações integradas para um acompanhamento mais próximo."}</p></div><div class="actions">${button("Atualizar", "refresh", "ghost", "refresh-cw")}${canCreate(page) ? button(page === "appointments" ? "Agendar consulta" : "Novo cadastro", "new") : page === "dashboard" && clinical() ? button("Novo atendimento", "new-immediate") : ""}</div></div>${page === "dashboard" ? dashboard() : page === "reports" ? reports() : modulePage()}</main><footer>SEDUC Especialistas <span>Gestão com cuidado. Educação com propósito.</span></footer></div></div><dialog id="editor"></dialog>`;
  bind();
  if (
    state._hasMore?.[page] ||
    (page === "reports" && state._hasMore?.appointments)
  ) {
    const target = page === "reports" ? "appointments" : page;
    document
      .querySelector("main")
      .insertAdjacentHTML(
        "beforeend",
        '<div class="pagination"><p>Exibindo registros já carregados. A busca e os filtros se aplicam a esta seleção.</p><button class="ghost" id="load-more">Carregar mais 40 registros</button></div>',
      );
    document.querySelector("#load-more").onclick = async () => {
      try {
        state = { ...state, ...(await store.more(target)) };
        render();
      } catch (e) {
        toast(friendly(e), true);
      }
    };
  }
}
const subtitles = {
  dashboard: "Cada atendimento faz parte de uma trajetória.",
  schools: "As instituições que fazem parte da nossa rede.",
  professionals: "Especialidades e pessoas que transformam a aprendizagem.",
  students: "Uma trajetória única, um acompanhamento integrado.",
  appointments: "Organize os encontros e respeite cada jornada.",
  notes: "Registros de cuidado, evolução e próximos passos.",
  attendance: "Frequência funcional independente dos atendimentos.",
  links: "Escolas, profissionais e jornadas com vigência definida.",
  reports: "Informação para planejar, acompanhar e decidir.",
  users: "Aprovação de acesso, responsabilidades e abrangência.",
  audit: "Histórico de operações para acompanhamento da administração.",
  blocks: "Afastamentos e períodos indisponíveis para agendamento.",
};
function filtered(rows) {
  return rows.filter((x) => {
    const d = x.start?.slice(0, 10) || x.day || x.createdAt?.slice(0, 10) || "";
    return (
      (!schoolFilter || (x.schoolId || x.id) === schoolFilter) &&
      (!search ||
        JSON.stringify([
          x.name,
          x.registration,
          x.specialty,
          x.status,
          name("students", x.studentId),
          name("professionals", x.professionalId),
        ])
          .toLowerCase()
          .includes(search.toLowerCase())) &&
      (!from || d >= from) &&
      (!to || d <= to) &&
      (!statusFilter || x.status === statusFilter) &&
      (!professionalFilter || x.professionalId === professionalFilter) &&
      (!specialtyFilter ||
        (state.professionals || []).find((p) => p.id === x.professionalId)
          ?.specialty === specialtyFilter)
    );
  });
}
function filters(extra = false) {
  return `<div class="filters"><div class="search-field">${icon("search")}<input id="search" aria-label="Buscar registros" placeholder="Buscar por nome, matrícula ou situação..." value="${esc(search)}"></div><select id="school-filter" aria-label="Filtrar por escola"><option value="">Todas as escolas</option>${options("schools", schoolFilter)}</select>${extra ? `<input type="date" id="from" aria-label="Data inicial" value="${from}"><input type="date" id="to" aria-label="Data final" value="${to}"><select id="status-filter" aria-label="Situação"><option value="">Todas as situações</option>${["Agendado", "Realizado", "Cancelado", "Remarcado", "Falta do aluno", "Falta do profissional"].map((v) => `<option ${v === statusFilter ? "selected" : ""}>${v}</option>`).join("")}</select><select id="professional-filter" aria-label="Profissional"><option value="">Todos os profissionais</option>${options("professionals", professionalFilter)}</select><select id="specialty-filter" aria-label="Especialidade"><option value="">Todas as especialidades</option>${[...new Set((state.professionals || []).map((p) => p.specialty))].map((v) => `<option ${v === specialtyFilter ? "selected" : ""}>${esc(v)}</option>`).join("")}</select>` : ""}</div>`;
}
function dashboard() {
  const appointments = state.appointments || [],
    active = (state.students || []).filter((x) => x.status === "Ativo"),
    todayAppointments = appointments.filter(
      (x) => x.start.slice(0, 10) === today(),
    ),
    future = (state._upcoming || appointments)
      .filter(
        (x) => x.status === "Agendado" && x.start >= new Date().toISOString(),
      )
      .sort((a, b) => a.start.localeCompare(b.start));
  return `<section class="welcome"><div><span class="welcome-tag">UM OLHAR PARA TODA A REDE</span><h2>Acompanhamento que<br>faz a diferença.</h2><p>Escolas e especialistas conectados para apoiar<br>o desenvolvimento de cada aluno.</p><div class="welcome-actions">${clinical() ? button("Agendar consulta", "new-appointment", "light", "calendar-days") : ""}<a href="#reports">Ver relatórios ${icon("arrow-up-right")}</a></div></div><div class="welcome-art" aria-hidden="true"><div class="orb one"></div><div class="orb two"></div><div class="orbit"><div class="art-tile a">${icon("graduation-cap")}</div><div class="art-tile b">${icon("heart-handshake")}</div><div class="art-tile c">${icon("school")}</div><div class="center-flower">✦</div></div></div><span class="welcome-date">${new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date())}</span></section><section class="stats">${[
    [
      "Alunos acompanhados",
      state._counts?.students ?? active.length,
      "graduation-cap",
      "Cadastros ativos na rede",
    ],
    [
      "Atendimentos hoje",
      state._counts?.appointmentsToday ?? todayAppointments.length,
      "calendar-days",
      "Agenda do dia",
    ],
    [
      "Profissionais ativos",
      state._counts?.professionals ??
        (state.professionals || []).filter((x) => x.status === "Ativo").length,
      "users",
      "Especialistas em atuação",
    ],
    [
      "Atendimentos realizados",
      state._counts?.done ??
        appointments.filter((x) => x.status === "Realizado").length,
      "clipboard-list",
      "Registros de acompanhamento",
    ],
  ]
    .map(
      ([t, n, i, b], idx) =>
        `<article class="stat"><div><span>${t}</span><div class="stat-icon s${idx}">${icon(i)}</div></div><strong>${n.toString().padStart(2, "0")}</strong><small>${b}</small></article>`,
    )
    .join(
      "",
    )}</section><div class="dashboard-grid"><section class="panel"><div class="panel-heading"><div><h2>Próximos atendimentos</h2><p>Os próximos encontros da sua rede</p></div><a href="#appointments">Ver agenda ${icon("arrow-up-right")}</a></div>${
    future.length
      ? future
          .slice(0, 5)
          .map(
            (a) =>
              `<div class="appointment-row"><div class="date-box"><strong>${new Date(a.start).getDate()}</strong><span>${new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(new Date(a.start))}</span></div><div><strong>${esc(name("students", a.studentId))}</strong><small>${esc(name("professionals", a.professionalId))} · ${esc(shortSchool(a.schoolId))}</small></div><span class="time">${fmt(a.start, true).split(", ")[1] || fmt(a.start, true)}</span>${pill(a.status)}</div>`,
          )
          .join("")
      : empty(
          "Sua agenda está livre",
          "Os agendamentos aparecerão aqui assim que forem cadastrados.",
          "calendar-days",
        )
  }</section><section class="panel school-summary"><div class="panel-heading"><div><h2>Nossa rede</h2><p>Presença em cada escola</p></div><span class="counter">${state.schools.length}</span></div>${state.schools
    .map((s) => {
      const count =
        state._counts?.bySchool?.[s.id] ??
        active.filter((a) => a.schoolId === s.id).length;
      return `<a href="#schools" class="school-row"><span class="school-icon">${icon("school")}</span><div><strong>${esc(s.name.replace("Escola Municipal ", "").replace("Creche Municipal ", ""))}</strong><small>${count} aluno${count === 1 ? "" : "s"} acompanhado${count === 1 ? "" : "s"}</small></div>${icon("chevron-right")}</a>`;
    })
    .join(
      "",
    )}</section></div><div class="care-note">${icon("shield-check")}<p><strong>Cada informação merece cuidado.</strong> O acesso é definido pelo seu perfil e pelos vínculos com as escolas.</p></div>`;
}
function empty(title, desc, ico = "notebook-pen") {
  return `<div class="empty">${icon(ico)}<h3>${title}</h3><p>${desc}</p></div>`;
}
const columns = {
  staff: [
    ["Servidor", (x) => esc(x.name)],
    ["Cargo", (x) => esc(x.job)],
    ["Escola", (x) => esc(shortSchool(x.schoolId))],
    ["Situação", (x) => pill(x.status)],
  ],
  schools: [
    ["Escola", (x) => esc(x.name)],
    ["INEP", (x) => esc(x.inep) || "Não informado"],
    ["Direção", (x) => esc(x.director) || "—"],
    ["Situação", (x) => pill(x.status)],
  ],
  professionals: [
    [
      "Profissional",
      (x) =>
        `<strong>${esc(x.name)}</strong>${x.email ? `<small>${esc(x.email)}</small>` : ""}`,
    ],
    ["Especialidade", (x) => esc(x.specialty)],
    ["Situação", (x) => pill(x.status)],
  ],
  links: [
    ["Profissional", (x) => esc(name("professionals", x.professionalId))],
    ["Escola", (x) => esc(shortSchool(x.schoolId))],
    ["Função", (x) => esc(x.job)],
    [
      "Vigência",
      (x) => fmt(x.start) + " → " + (x.end ? fmt(x.end) : "Em aberto"),
    ],
    ["Situação", (x) => pill(x.status)],
  ],
  students: [
    [
      "Aluno",
      (x) =>
        `<strong>${esc(x.name)}</strong><small>Matrícula ${esc(x.registration)}</small>`,
    ],
    ["Escola", (x) => esc(shortSchool(x.schoolId))],
    ["Situação", (x) => pill(x.status)],
  ],
  appointments: [
    ["Data e hora", (x) => fmt(x.start, true)],
    ["Aluno", (x) => esc(name("students", x.studentId))],
    ["Profissional", (x) => esc(name("professionals", x.professionalId))],
    ["Escola", (x) => esc(shortSchool(x.schoolId))],
    ["Situação", (x) => pill(x.status)],
  ],
  notes: [
    ["Aluno", (x) => esc(name("students", x.studentId))],
    [
      "Data",
      (x) =>
        fmt(
          state.appointments.find((a) => a.id === x.appointmentId)?.start,
          true,
        ),
    ],
    [
      "Profissional",
      (x) =>
        esc(
          name(
            "professionals",
            state.appointments.find((a) => a.id === x.appointmentId)
              ?.professionalId,
          ),
        ),
    ],
    [
      "Evolução",
      (x) =>
        `<details><summary>Ler atendimento</summary><p class="plain-text">${esc(x.text)}</p>${x.referral ? `<p>Encaminhamento: ${esc(x.referral)}</p>` : ""}${x.returnDate ? `<p>Retorno: ${fmt(x.returnDate)}</p>` : ""}</details>`,
    ],
  ],
  attendance: [
    ["Dia", (x) => fmt(x.day)],
    ["Profissional", (x) => esc(name("professionals", x.professionalId))],
    ["Escola", (x) => esc(shortSchool(x.schoolId))],
    [
      "Entrada / saída",
      (x) => esc(x.entry || "—") + " / " + esc(x.exit || "—"),
    ],
    ["Situação", (x) => pill(x.status)],
  ],
  referrals: [
    ["Aluno", (x) => esc(name("students", x.studentId))],
    ["Encaminhamento", (x) => esc(x.description)],
    ["Prazo", (x) => fmt(x.due)],
    ["Situação", (x) => pill(x.status)],
  ],
  users: [
    [
      "Usuário",
      (x) => `<strong>${esc(x.name)}</strong><small>${esc(x.email)}</small>`,
    ],
    ["Perfil", (x) => labelRole[x.role]],
    ["Escolas", (x) => x.schoolIds.map(shortSchool).map(esc).join(", ") || "—"],
    ["Situação", (x) => pill(x.status)],
  ],
  blocks: [
    ["Profissional", (x) => esc(name("professionals", x.professionalId))],
    ["Início", (x) => fmt(x.start, true)],
    ["Fim", (x) => fmt(x.end, true)],
    ["Motivo", (x) => esc(x.reason)],
  ],
  audit: [
    ["Data", (x) => fmt(x.at, true)],
    ["Responsável", (x) => esc(name("users", x.actorId))],
    ["Operação", (x) => esc(x.action)],
    ["Módulo", (x) => esc(nav.find((n) => n[0] === x.table)?.[1] || x.table)],
    ["Registro", (x) => `<code>${esc(x.targetId)}</code>`],
  ],
};
function editable(t, x) {
  if (t === "blocks") return false;
  return t === "users"
    ? manager() && x.id !== state.user.id
    : canCreate(t) &&
        (admin() ||
          !["appointments", "notes", "attendance", "referrals"].includes(t) ||
          x.authorId === state.user.id);
}
function modulePage() {
  const rows = filtered(state[page] || []);
  const cols = columns[page] || [];
  const info =
    page === "users"
      ? '<div class="info">A pessoa deve entrar uma vez com Google para solicitar acesso. Aprovação e vínculos são definidos separadamente. Nenhuma senha é enviada.</div>'
      : page === "notes" && !clinical()
        ? '<div class="info">Seu perfil permite indicadores e agenda. As observações dos atendimentos são restritas aos especialistas autorizados.</div>'
        : page === "attendance"
          ? '<div class="info">Atendimentos realizados não registram frequência automaticamente. Informe a jornada efetivamente cumprida.</div>'
          : "";
  return `${info}${filters(page === "appointments")}<section class="panel table-panel"><div class="table-caption"><strong>${rows.length} registro${rows.length === 1 ? "" : "s"}</strong><span>Atualizado nesta sessão</span></div>${rows.length ? `<div class="table-scroll"><table><thead><tr>${cols.map(([c]) => `<th>${c}</th>`).join("")}<th><span class="sr-only">Ações</span></th></tr></thead><tbody>${rows.map((x) => `<tr>${cols.map(([, fn]) => `<td>${fn(x)}</td>`).join("")}<td class="row-actions">${page === "students" ? `<button class="text-btn" data-history="${x.id}">Histórico</button>` : ""}${page === "appointments" && clinical() && (admin() || x.authorId === state.user.id) && !["Cancelado", "Remarcado"].includes(x.status) ? `<button class="text-btn" data-note="${x.id}">Registrar</button>` : ""}${editable(page, x) ? `<button class="text-btn" data-edit="${x.id}">Editar ${icon("arrow-up-right")}</button>` : ""}</td></tr>`).join("")}</tbody></table></div>` : empty("Nenhum registro encontrado", "Cadastre as primeiras informações ou ajuste os filtros.")}</section>${page === "audit" && state.versions?.length ? `<section class="panel version-panel"><h2>Versões anteriores</h2>${state.versions.map((v) => `<details><summary>${fmt(v.at, true)} · ${esc(v.table)} · ${esc(v.targetId)}</summary><pre>${esc(JSON.stringify(v.before, null, 2))}</pre></details>`).join("")}</section>` : ""}`;
}
function reports() {
  const rows = filtered(state.appointments || []),
    totals = [
      "Agendado",
      "Realizado",
      "Falta do aluno",
      "Falta do profissional",
      "Cancelado",
      "Remarcado",
    ].map((status) => ({
      status,
      total: rows.filter((x) => x.status === status).length,
    }));
  return `${filters(true)}<div class="report-actions">${admin() || state.user.canExport ? button("Exportar planilha CSV", "csv", "primary", "download") + button("Imprimir / salvar PDF", "print", "ghost", "printer") : "<p>Seu perfil não possui permissão para exportar.</p>"}<span>Exportação agregada sem nomes de alunos ou observações.</span></div><section class="panel report-panel"><h2>Atendimentos por situação</h2><p>${rows.length} atendimento(s) no período selecionado</p>${totals.map((t) => `<div class="bar-row"><span>${pill(t.status)}</span><div class="bar"><div style="width:${rows.length ? (t.total / rows.length) * 100 : 0}%"></div></div><strong>${t.total}</strong></div>`).join("")}</section><section class="panel report-panel"><h2>Planejado e realizado por escola</h2><div class="table-scroll"><table><thead><tr><th>Escola</th><th>Previstos</th><th>Realizados</th><th>Horas realizadas</th><th>Frequências presentes</th></tr></thead><tbody>${state.schools
    .filter((s) => !schoolFilter || schoolFilter === s.id)
    .map((s) => {
      const rr = rows.filter((r) => r.schoolId === s.id),
        done = rr.filter((r) => r.status === "Realizado");
      return `<tr><td>${esc(s.name)}</td><td>${rr.filter((r) => r.status === "Agendado").length}</td><td>${done.length}</td><td>${done.reduce((n, a) => n + (new Date(a.end) - new Date(a.start)) / 3600000, 0).toFixed(1)}</td><td>${(state.attendance || []).filter((a) => a.schoolId === s.id && a.status === "Presente" && (!from || a.day >= from) && (!to || a.day <= to)).length}</td></tr>`;
    })
    .join("")}</tbody></table></div></section>`;
}
function options(table, value = "", predicate = () => true) {
  return (state[table] || [])
    .filter(predicate)
    .map(
      (x) =>
        `<option value="${esc(x.id)}" ${x.id === value ? "selected" : ""}>${esc(x.name || `${name("professionals", x.professionalId)} · ${shortSchool(x.schoolId)} · ${x.job || fmt(x.start, true)}`)}</option>`,
    )
    .join("");
}
const f = (key, label, type = "text", extra = {}) => ({
  key,
  label,
  type,
  ...extra,
});
const configs = {
  schools: [
    f("name", "Nome oficial", "text", { required: true, max: 200 }),
    f("inep", "Código INEP"),
    f("director", "Nome da direção"),
    f("email", "E-mail institucional", "email"),
    f("phone", "Telefone"),
    f("address", "Endereço completo"),
    f("status", "Situação", "select", { values: ["Ativo", "Inativo"] }),
    f("remarks", "Observações", "textarea"),
  ],
  professionals: [
    f("name", "Nome completo", "text", { required: true }),
    f("specialty", "Especialidade", "text", { required: true }),
    f("email", "E-mail", "email"),
    f("phone", "Telefone"),
    f("birth", "Nascimento", "date"),
    f("cpf", "CPF (se necessário)", "text", { max: 14 }),
    f("address", "Endereço"),
    f("status", "Situação", "select", {
      values: ["Pendente", "Ativo", "Afastado", "Inativo"],
    }),
    f("remarks", "Observações", "textarea"),
  ],
  links: [
    f("professionalId", "Profissional", "relation", {
      table: "professionals",
      required: true,
    }),
    f("userId", "Conta Google aprovada", "relation", { table: "users" }),
    f("schoolId", "Escola", "relation", { table: "schools", required: true }),
    f("job", "Cargo / função", "text", { required: true }),
    f("specialty", "Especialidade exercida", "text", { required: true }),
    f("weeklyHours", "Jornada semanal (horas)", "number", {
      required: true,
      min: 0,
      max: 80,
    }),
    f("start", "Início da vigência", "date", { required: true }),
    f("end", "Fim da vigência", "date"),
    f("status", "Situação", "select", {
      values: ["Pendente", "Ativo", "Afastado", "Encerrado"],
    }),
    f("schedule", "Jornada de trabalho", "schedule"),
  ],
  students: [
    f("name", "Nome completo", "text", { required: true }),
    f("registration", "Matrícula única", "text", { required: true, max: 60 }),
    f("schoolId", "Escola atual", "relation", {
      table: "schools",
      required: true,
    }),
    f("birth", "Nascimento", "date"),
    f("guardian", "Responsável"),
    f("phone", "Telefone"),
    f("address", "Endereço"),
    f("status", "Situação", "select", { values: ["Ativo", "Arquivado"] }),
    f("reason", "Motivo do arquivamento ou transferência", "textarea"),
  ],
  appointments: [
    f("schoolId", "Escola", "relation", { table: "schools", required: true }),
    f("linkId", "Vínculo do profissional", "relation", {
      table: "links",
      required: true,
    }),
    f("studentId", "Aluno", "relation", { table: "students", required: true }),
    f("start", "Início", "datetime-local", { required: true }),
    f("end", "Fim", "datetime-local", { required: true }),
    f("modality", "Modalidade", "select", {
      values: [
        "Presencial",
        "Remoto",
        "Orientação familiar",
        "Atividade em grupo",
      ],
    }),
    f("status", "Situação", "select", {
      values: [
        "Agendado",
        "Realizado",
        "Cancelado",
        "Remarcado",
        "Falta do aluno",
        "Falta do profissional",
      ],
    }),
    f("reason", "Justificativa de cancelamento / remarcação", "textarea"),
  ],
  notes: [
    f("appointmentId", "Consulta / atendimento", "relation", {
      table: "appointments",
      required: true,
    }),
    f("text", "Observação do atendimento (até 1.000 caracteres)", "textarea", {
      required: true,
      max: 1000,
    }),
    f("referral", "Encaminhamentos", "textarea"),
    f("returnDate", "Retorno sugerido", "date"),
    f("reason", "Motivo da alteração", "textarea"),
  ],
  attendance: [
    f("linkId", "Vínculo do profissional", "relation", {
      table: "links",
      required: true,
    }),
    f("day", "Dia", "date", { required: true }),
    f("entry", "Entrada", "time"),
    f("exit", "Saída", "time"),
    f("status", "Situação", "select", {
      values: ["Presente", "Ausente", "Justificado"],
    }),
    f("reason", "Justificativa", "textarea"),
  ],
  referrals: [
    f("schoolId", "Escola", "relation", { table: "schools", required: true }),
    f("studentId", "Aluno", "relation", { table: "students", required: true }),
    f("description", "Encaminhamento", "textarea", { required: true }),
    f("due", "Prazo", "date"),
    f("status", "Situação", "select", {
      values: ["Pendente", "Em andamento", "Concluído"],
    }),
  ],
  users: [
    f("name", "Nome", "text", { required: true }),
    f("role", "Perfil", "select", {
      values: Object.keys(labelRole),
      labels: labelRole,
    }),
    f("status", "Situação", "select", {
      values: ["Pendente", "Ativo", "Inativo"],
    }),
    f("schoolIds", "Escolas autorizadas", "checks"),
    f("manageUsers", "Pode gerenciar usuários e cadastros", "checkbox"),
    f("canExport", "Pode exportar relatórios", "checkbox"),
  ],
  blocks: [
    f("professionalId", "Profissional", "relation", {
      table: "professionals",
      required: true,
    }),
    f("start", "Início", "datetime-local", { required: true }),
    f("end", "Fim", "datetime-local", { required: true }),
    f("reason", "Motivo", "textarea", { required: true }),
  ],
};
const toLocal = (d) =>
  d
    ? new Intl.DateTimeFormat("sv-SE", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
        .format(new Date(d))
        .replace(" ", "T")
    : "";
const time = (v) =>
  `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
function scheduleRow(x = { day: 1, start: 420, end: 1020 }) {
  return `<div class="schedule-row"><select aria-label="Dia da jornada">${["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"].map((v, i) => `<option value="${i}" ${i === x.day ? "selected" : ""}>${v}</option>`).join("")}</select><input type="time" aria-label="Início da jornada" value="${time(x.start)}" required><span>até</span><input type="time" aria-label="Fim da jornada" value="${time(x.end)}" required><button type="button" class="icon-btn remove-schedule" aria-label="Remover intervalo">${icon("x")}</button></div>`;
}
function field(c, v) {
  const attrs = `name="${c.key}" id="field-${c.key}" ${c.required ? "required" : ""}`;
  const val = esc(v ?? "");
  let input = "";
  if (c.type === "select")
    input = `<select ${attrs}>${c.values
      .filter((x) => c.key !== "role" || admin() || x !== "superadmin")
      .map(
        (x) =>
          `<option value="${x}" ${v === x ? "selected" : ""}>${esc(c.labels?.[x] || x)}</option>`,
      )
      .join("")}</select>`;
  else if (c.type === "relation") {
    let predicate = () => true;
    if (c.table === "links")
      predicate = (x) =>
        x.status === "Ativo" && (admin() || x.userId === state.user.id);
    if (c.table === "appointments")
      predicate = (x) =>
        (admin() || x.authorId === state.user.id) &&
        !["Cancelado", "Remarcado"].includes(x.status);
    input = `<select ${attrs}><option value="">Selecione...</option>${options(c.table, v, predicate)}</select>`;
  } else if (c.type === "textarea")
    input = `<textarea ${attrs} rows="4" maxlength="${c.max || 1000}">${val}</textarea>`;
  else if (c.type === "checkbox")
    input = `<input type="checkbox" ${attrs} ${v ? "checked" : ""} ${c.key === "manageUsers" && !admin() ? "disabled" : ""}>`;
  else if (c.type === "checks")
    input = `<div class="check-list">${state.schools.map((s) => `<label><input type="checkbox" name="schoolIds" value="${s.id}" ${v?.includes(s.id) ? "checked" : ""}>${esc(s.name)}</label>`).join("")}</div>`;
  else if (c.type === "schedule")
    input = `<div id="schedule-rows">${(v || []).map(scheduleRow).join("")}</div><button type="button" class="text-btn" id="add-schedule">+ Adicionar intervalo</button><small>Adicione cada período de trabalho. Intervalos de almoço ficam separados.</small>`;
  else
    input = `<input type="${c.type}" ${attrs} value="${c.type === "datetime-local" ? toLocal(v) : val}" maxlength="${c.max || 200}" ${c.type === "number" ? `min="${c.min || 0}" max="${c.max || 80}" step="0.5"` : ""}>`;
  return `<div class="field ${["textarea", "checks", "schedule"].includes(c.type) ? "full" : ""} ${c.type === "checkbox" ? "checkbox-field" : ""}"><label for="field-${c.key}">${c.label}${c.required ? " <span>*</span>" : ""}</label>${input}</div>`;
}
async function edit(table, row = {}, prefill = {}) {
  try {
    if (store) {
      const updated = await store.formOptions(table);
      state = { ...state, ...updated };
      if (row.id) row = { ...row, ...(await store.privateRow(table, row.id)) };
    }
  } catch (e) {
    toast(friendly(e), true);
    return;
  }
  const dialog = document.querySelector("#editor");
  const existing = !!row.id,
    values = { ...prefill, ...row };
  dialog.innerHTML = `<form id="edit-form"><div class="dialog-heading"><div><p class="eyebrow">SEDUC ESPECIALISTAS</p><h2>${existing ? "Editar" : "Novo"} · ${nav.find((x) => x[0] === table)?.[1]}</h2></div><button type="button" class="icon-btn" id="close-dialog" aria-label="Fechar">${icon("x")}</button></div><div class="dialog-body">${table === "students" && existing ? '<div class="info">Arquivar preserva todos os atendimentos. Transferir restringe o cadastro à nova escola; registros anteriores mantêm a escola de origem.</div>' : ""}${table === "appointments" ? '<div class="info">O servidor confere vigência, jornada, bloqueios e conflitos. Para reagendar, justifique a remarcação e crie a nova consulta.</div>' : ""}<div class="form-grid">${configs[table].map((c) => field(c, values[c.key])).join("")}</div>${store && ["appointments", "referrals"].includes(table) ? '<button type="button" id="more-student-options" class="text-btn">Carregar mais alunos na seleção</button>' : ""}<p class="form-error" id="form-error" role="alert"></p></div><div class="dialog-footer"><small>Os campos com * são obrigatórios.</small><button type="button" class="ghost" id="cancel-edit">Cancelar</button><button class="primary" type="submit">${icon("check")}Salvar registro</button></div></form>`;
  dialog.showModal();
  createIcons({ icons });
  document.querySelector("#close-dialog").onclick = () => dialog.close();
  document.querySelector("#cancel-edit").onclick = () => dialog.close();
  const moreOptions = document.querySelector("#more-student-options");
  if (moreOptions)
    moreOptions.onclick = async () => {
      try {
        const data = await store.more("students");
        state = { ...state, ...data };
        const select = dialog.querySelector('[name="studentId"]'),
          value = select.value,
          school = dialog.querySelector('[name="schoolId"]').value;
        select.innerHTML =
          '<option value="">Selecione...</option>' +
          options("students", value, (x) => !school || x.schoolId === school);
        toast("Seleção de alunos atualizada.");
      } catch (e) {
        toast(friendly(e), true);
      }
    };
  if (existing) {
    for (const key of table === "appointments"
      ? ["schoolId", "studentId", "linkId", "start", "end"]
      : table === "links"
        ? ["professionalId", "schoolId", "userId"]
        : table === "students"
          ? ["registration"]
          : table === "notes"
            ? ["appointmentId"]
            : [])
      dialog.querySelector(`[name="${key}"]`).disabled = true;
  }
  if (table === "links") {
    document.querySelector("#add-schedule").onclick = () => {
      document
        .querySelector("#schedule-rows")
        .insertAdjacentHTML("beforeend", scheduleRow());
      createIcons({ icons });
    };
    document.querySelector("#schedule-rows").onclick = (e) =>
      e.target.closest(".remove-schedule")?.closest(".schedule-row").remove();
  }
  if (["appointments", "referrals"].includes(table)) {
    const school = dialog.querySelector('[name="schoolId"]');
    const sync = () => {
      for (const key of [
        "studentId",
        ...(table === "appointments" ? ["linkId"] : []),
      ]) {
        const select = dialog.querySelector(`[name="${key}"]`),
          oldValue = select.value;
        const t = key === "studentId" ? "students" : "links";
        select.innerHTML =
          '<option value="">Selecione...</option>' +
          options(
            t,
            oldValue,
            (x) =>
              (!school.value || x.schoolId === school.value) &&
              (t !== "links" ||
                (x.status === "Ativo" &&
                  (admin() || x.userId === state.user.id))),
          );
      }
    };
    school.onchange = sync;
    sync();
  }
  document.querySelector("#edit-form").onsubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget,
      submit = form.querySelector('[type="submit"]'),
      data = {};
    for (const c of configs[table]) {
      const el = form.elements[c.key];
      if (c.type === "schedule")
        data[c.key] = [...form.querySelectorAll(".schedule-row")].map((r) => {
          const times = r.querySelectorAll("input"),
            minutes = (v) =>
              Number(v.split(":")[0]) * 60 + Number(v.split(":")[1]);
          return {
            day: +r.querySelector("select").value,
            start: minutes(times[0].value),
            end: minutes(times[1].value),
          };
        });
      else if (c.type === "checks")
        data[c.key] = [
          ...form.querySelectorAll('[name="schoolIds"]:checked'),
        ].map((el) => el.value);
      else if (c.type === "checkbox") data[c.key] = el.checked;
      else if (c.type === "number") data[c.key] = +el.value;
      else if (c.type === "datetime-local")
        data[c.key] = el.value
          ? new Date(el.value + ":00-03:00").toISOString()
          : "";
      else data[c.key] = el.value;
    }
    if (
      table === "students" &&
      row.status !== "Arquivado" &&
      data.status === "Arquivado" &&
      !confirm(
        "Arquivar este aluno? Novos agendamentos serão impedidos. O histórico será preservado.",
      )
    )
      return;
    submit.disabled = true;
    document.querySelector("#form-error").textContent = "";
    try {
      await api("save", {
        table,
        data,
        ...(existing ? { id: row.id, version: row.version } : {}),
      });
      dialog.close();
      toast("Registro salvo com sucesso.");
      await load();
    } catch (error) {
      document.querySelector("#form-error").textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  };
}
async function history(studentId) {
  if (store) {
    try {
      state = { ...state, ...(await store.history(studentId)) };
    } catch (e) {
      toast(friendly(e), true);
      return;
    }
  }
  const student = state.students.find((x) => x.id === studentId),
    dialog = document.querySelector("#editor");
  const appointments = (state.appointments || [])
    .filter((x) => x.studentId === studentId)
    .sort((a, b) => b.start.localeCompare(a.start));
  dialog.innerHTML = `<div class="dialog-heading"><div><p class="eyebrow">TRAJETÓRIA DO ALUNO</p><h2>${esc(student.name)}</h2><p>Matrícula ${esc(student.registration)} · ${esc(shortSchool(student.schoolId))}</p></div><button class="icon-btn" id="close-dialog" aria-label="Fechar">${icon("x")}</button></div><div class="dialog-body">${
    appointments.length
      ? appointments
          .map((a) => {
            const n = state.notes.find((n) => n.appointmentId === a.id);
            return `<details class="timeline"><summary><strong>${fmt(a.start, true)}</strong> · ${esc(name("professionals", a.professionalId))} ${pill(a.status)}</summary><p>${esc(shortSchool(a.schoolId))} · ${esc(a.modality)}</p>${n ? `<p class="plain-text">${esc(n.text)}</p><p>${esc(n.referral)}</p>` : "<p>Nenhuma observação disponível para seu perfil.</p>"}</details>`;
          })
          .join("")
      : empty(
          "O acompanhamento começa aqui",
          "Os atendimentos desse aluno aparecerão em ordem cronológica.",
        )
  }<h3>Histórico de matrículas</h3>${(state.enrollments || [])
    .filter((x) => x.studentId === studentId)
    .map(
      (x) =>
        `<p>${esc(shortSchool(x.schoolId))} · ${fmt(x.start)} → ${x.end ? fmt(x.end) : "Atual"}</p>`,
    )
    .join("")}</div>`;
  dialog.showModal();
  document.querySelector("#close-dialog").onclick = () => dialog.close();
  createIcons({ icons });
}
async function exportReport(print = false) {
  try {
    const rows = await api("report", { schoolId: schoolFilter, from, to });
    if (print) {
      const dialog = document.querySelector("#editor");
      dialog.innerHTML = `<div class="dialog-heading"><h2>Relatório agregado · SEDUC</h2><button class="icon-btn" id="close-dialog" aria-label="Fechar">${icon("x")}</button></div><div class="dialog-body"><p>Emissão: ${fmt(new Date().toISOString(), true)} · Período: ${from ? fmt(from) : "Início"} a ${to ? fmt(to) : "Hoje"}</p><table><thead><tr><th>Escola</th><th>Especialidade</th><th>Situação</th><th>Total</th><th>Horas</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r.escola)}</td><td>${esc(r.especialidade)}</td><td>${esc(r.situacao)}</td><td>${r.quantidade}</td><td>${r.horas.toFixed(1)}</td></tr>`).join("")}</tbody></table><button class="primary" id="confirm-print">Imprimir / salvar como PDF</button></div>`;
      dialog.showModal();
      createIcons({ icons });
      document.querySelector("#close-dialog").onclick = () => dialog.close();
      document.querySelector("#confirm-print").onclick = () => window.print();
    } else {
      const cell = (v) =>
        '"' +
        String(v ?? "")
          .replace(/^[=+@\-\t\r]/, "'$&")
          .replaceAll('"', '""') +
        '"';
      const text =
        "\uFEFF" +
        [
          ["Escola", "Especialidade", "Situação", "Quantidade", "Horas"],
          ...rows.map((r) => [
            r.escola,
            r.especialidade,
            r.situacao,
            r.quantidade,
            r.horas.toFixed(2),
          ]),
        ]
          .map((r) => r.map(cell).join(";"))
          .join("\r\n");
      const url = URL.createObjectURL(
        new Blob([text], { type: "text/csv;charset=utf-8" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `seduc-relatorio-${today()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast("Relatório exportado.");
    }
  } catch (e) {
    toast(friendly(e), true);
  }
}
function bind() {
  createIcons({ icons });
  document.querySelectorAll("[data-action]").forEach(
    (el) =>
      (el.onclick = async () => {
        const a = el.dataset.action;
        if (a === "refresh") {
          if (store) state = await store.stateFor(page, true);
          await load();
        } else if (a === "new") edit(page);
        else if (a === "new-appointment") edit("appointments");
        else if (a === "new-immediate") {
          edit(
            "appointments",
            {},
            {
              start: new Date(
                Math.floor(Date.now() / 900000) * 900000,
              ).toISOString(),
              end: new Date(
                Math.floor(Date.now() / 900000) * 900000 + 30 * 60000,
              ).toISOString(),
            },
          );
        } else if (a === "logout") {
          if (demo)
            toast("Demonstração local. A produção usa sua conta Google.");
          else await signOut(auth);
        } else if (a === "menu")
          document.querySelector("#sidebar").classList.toggle("open");
        else if (a === "csv" || a === "print")
          await exportReport(a === "print");
      }),
  );
  document.querySelectorAll("[data-edit]").forEach(
    (el) =>
      (el.onclick = () =>
        edit(
          page,
          state[page].find((x) => x.id === el.dataset.edit),
        )),
  );
  document
    .querySelectorAll("[data-history]")
    .forEach((el) => (el.onclick = () => history(el.dataset.history)));
  document.querySelectorAll("[data-note]").forEach(
    (el) =>
      (el.onclick = () => {
        const note = state.notes.find(
          (x) => x.appointmentId === el.dataset.note,
        );
        edit("notes", note || {}, { appointmentId: el.dataset.note });
      }),
  );
  const bindFilter = (id, set) => {
    const el = document.getElementById(id);
    if (el)
      el.onchange = async () => {
        set(el.value);
        if (
          store &&
          [
            "school-filter",
            "from",
            "to",
            "status-filter",
            "professional-filter",
          ].includes(id) &&
          ![
            "dashboard",
            "schools",
            "professionals",
            "users",
            "blocks",
            "audit",
          ].includes(page)
        ) {
          try {
            const target = page === "reports" ? "appointments" : page;
            state = {
              ...state,
              ...(await store.applyFilters(target, {
                schoolId: schoolFilter,
                from,
                to,
                status: statusFilter,
                professionalId: professionalFilter,
              })),
            };
          } catch (e) {
            toast(friendly(e), true);
          }
        }
        render();
      };
  };
  bindFilter("school-filter", (v) => (schoolFilter = v));
  bindFilter("from", (v) => (from = v));
  bindFilter("to", (v) => (to = v));
  bindFilter("status-filter", (v) => (statusFilter = v));
  bindFilter("professional-filter", (v) => (professionalFilter = v));
  bindFilter("specialty-filter", (v) => (specialtyFilter = v));
  const input = document.querySelector("#search");
  if (input) {
    input.oninput = () => {
      const start = input.selectionStart;
      search = input.value;
      render();
      const next = document.querySelector("#search");
      next.focus();
      next.setSelectionRange(start, start);
    };
  }
}
window.addEventListener("hashchange", () => {
  page = location.hash.slice(1) || "dashboard";
  search = "";
  schoolFilter = "";
  from = "";
  to = "";
  statusFilter = "";
  professionalFilter = "";
  specialtyFilter = "";
  if (store) load();
  else render();
});
page = location.hash.slice(1) || "dashboard";
async function boot() {
  app.innerHTML =
    '<div class="pending"><div class="brand-mark">S<span>✦</span></div><p>Conectando à rede SEDUC...</p></div>';
  try {
    if (["localhost", "127.0.0.1"].includes(location.hostname)) {
      try {
        const health = await fetch("/api/health").then((r) => r.json());
        demo = health.mode === "demo";
      } catch {}
    }
    if (demo) {
      await load();
      return;
    }
    const config = await fetch("/__/firebase/init.json").then((r) => {
      if (!r.ok) throw new Error("Configuração Firebase indisponível.");
      return r.json();
    });
    const firebaseApp = initializeApp(config);
    auth = getAuth(firebaseApp);
    onAuthStateChanged(auth, async (user) => {
      unsubscribe?.();
      currentUser = user;
      if (user) {
        store = createStore(firebaseApp, user, (error) => {
          if (error) {
            state = {};
            login(error);
          } else load();
        });
        try {
          unsubscribe = await store.initialize();
          await load();
        } catch (e) {
          toast(friendly(e), true);
          login(friendly(e));
        }
      } else {
        store = null;
        state = {};
        login();
      }
    });
  } catch (error) {
    app.innerHTML = `<div class="pending"><h1>Conexão indisponível</h1><p>${esc(error.message)}</p><p>Verifique a conexão e tente recarregar a página.</p><button class="primary" id="retry">Tentar novamente</button></div>`;
    document.querySelector("#retry").onclick = boot;
  }
}
boot();
