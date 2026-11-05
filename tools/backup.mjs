// Cópia de segurança automática (GitHub Actions): lê todas as coleções com a conta de serviço,
// criptografa com a senha do segredo BACKUP_SENHA e grava o arquivo em ./copia/.
// O arquivo é o mesmo formato da cópia baixada pela tela "Segurança" e abre lá ("Conferir uma cópia").
// Uso local:  FIREBASE_SA="$(cat conta.json)" BACKUP_SENHA="..." node tools/backup.mjs
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { mkdirSync, writeFileSync } from 'node:fs';
import { COLECOES, criptografar, serializavel } from '../js/backup.js';

const sa = JSON.parse(process.env.FIREBASE_SA || 'null'), senha = process.env.BACKUP_SENHA || '';
if (!sa) { console.error('Falta FIREBASE_SA (JSON da conta de serviço).'); process.exit(1); }
if (senha.length < 12) { console.error('BACKUP_SENHA precisa ter pelo menos 12 caracteres.'); process.exit(1); }

const db = getFirestore(initializeApp({ credential: cert(sa), projectId: sa.project_id }));
const dados = {}, contagem = {};
for (const nome of COLECOES) {
  const snap = await db.collection(nome).get();
  dados[nome] = snap.docs.map(d => ({ id: d.id, ...serializavel(d.data()) }));
  contagem[nome] = dados[nome].length;
}
const env = await criptografar(dados, senha, { origem: 'github-actions', projeto: sa.project_id, contagem });
mkdirSync('copia', { recursive: true });
const nome = 'copia/seduc-especialistas_copia_' + new Date().toISOString().slice(0, 10) + '.json';
writeFileSync(nome, JSON.stringify(env));
console.log('Cópia criptografada gerada:', nome, '·', Object.values(contagem).reduce((a, b) => a + b, 0), 'registros');
console.table(contagem);
