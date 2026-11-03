// Abre (descriptografa) uma cópia de segurança e grava o JSON legível.
// Uso: BACKUP_SENHA="..." node tools/abrir-backup.mjs copia.json saida.json
// ATENÇÃO: o arquivo de saída contém dados pessoais sensíveis de crianças (LGPD). Guarde com cuidado e apague depois de usar.
import { readFileSync, writeFileSync } from 'node:fs';
import { abrir } from '../js/backup.js';
const [, , entrada, saida] = process.argv;
if (!entrada || !saida) { console.error('Uso: BACKUP_SENHA="..." node tools/abrir-backup.mjs copia.json saida.json'); process.exit(1); }
const dados = await abrir(JSON.parse(readFileSync(entrada, 'utf8')), process.env.BACKUP_SENHA || '');
writeFileSync(saida, JSON.stringify(dados, null, 2));
console.log('Cópia aberta em', saida, Object.fromEntries(Object.entries(dados).map(([k, v]) => [k, v.length])));
