// Run only from an authenticated administrator workstation with ADC credentials.
import {
  initializeApp,
  applicationDefault,
} from "../functions/node_modules/firebase-admin/lib/esm/app/index.js";
import { getAuth } from "../functions/node_modules/firebase-admin/lib/esm/auth/index.js";
import { getFirestore } from "../functions/node_modules/firebase-admin/lib/esm/firestore/index.js";
import { FirestoreRepository } from "../functions/firestore-repository.mjs";
import { initialSchools, audit } from "../functions/domain.mjs";
const [email, project] = process.argv.slice(2);
if (!email || project !== "seduc-especialistas")
  throw new Error(
    "Uso: node scripts/bootstrap.mjs EMAIL_DO_ADMIN seduc-especialistas",
  );
initializeApp({ credential: applicationDefault(), projectId: project });
const authUser = await getAuth().getUserByEmail(email);
if (
  !authUser.emailVerified ||
  !authUser.providerData.some((p) => p.providerId === "google.com")
)
  throw new Error(
    "O administrador deve entrar primeiro com sua conta Google verificada.",
  );
const repository = new FirestoreRepository(getFirestore());
await repository.run((s) => {
  if (s.users.some((x) => x.role === "superadmin" && x.status === "Ativo"))
    throw new Error(
      "Administrador inicial já existe. Use a gestão de usuários.",
    );
  initialSchools(s);
  const old = s.users.find((x) => x.id === authUser.uid);
  const u = {
    id: authUser.uid,
    name: authUser.displayName || email,
    email: email.toLowerCase(),
    role: "superadmin",
    status: "Ativo",
    schoolIds: [],
    manageUsers: true,
    canExport: true,
    version: (old?.version || 0) + 1,
    createdAt: old?.createdAt || new Date().toISOString(),
  };
  if (old) s.users[s.users.indexOf(old)] = u;
  else s.users.push(u);
  audit(s, u, "implantacao_administrador", "users", u.id);
});
console.log(
  "Administrador e escolas configurados. Nenhum profissional real foi incluído.",
);
