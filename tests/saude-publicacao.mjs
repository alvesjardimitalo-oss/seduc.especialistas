import { firebaseConfig } from '../assets/js/firebase-config.js';

const site = 'https://alvesjardimitalo-oss.github.io/seduc.especialistas/';
let failed = false;
async function check(label, callback) {
  try {
    const result = await callback();
    console.log('OK:',label,result||'');
  } catch (error) {
    failed = true;
    console.error('ERRO:',label,error.message);
  }
}
await check('GitHub Pages: página inicial', async () => {
  const response = await fetch(site,{redirect:'follow',signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error('HTTP '+response.status);
  const html=await response.text();
  if (!html.includes('SEDUC Especialistas') || !html.includes('assets/js/app.js')) {
    throw new Error('Publicação não contém a página do aplicativo.');
  }
  return 'HTTP '+response.status;
});
await check('GitHub Pages: JavaScript da aplicação', async () => {
  const response=await fetch(site+'assets/js/app.js',{signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error('HTTP '+response.status);
  const source=await response.text();
  if (!source.includes('initializeApp(firebaseConfig)')) throw new Error('Código JS incorreto ou desatualizado.');
  return 'HTTP '+response.status;
});
await check('Firebase Authentication: configuração pública', async () => {
  if (!firebaseConfig.apiKey || firebaseConfig.projectId!=='seduc-especialistas') {
    throw new Error('Identificação Firebase inválida.');
  }
  const url='https://identitytoolkit.googleapis.com/v1/projects?key='+encodeURIComponent(firebaseConfig.apiKey);
  const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
  const data=await response.json().catch(()=>({}));
  if (!response.ok) {
    const code=data?.error?.message||('HTTP '+response.status);
    throw new Error('API Firebase retornou '+code);
  }
  if (data.projectId && ![firebaseConfig.projectId, firebaseConfig.messagingSenderId].includes(String(data.projectId))) {
    throw new Error('Identificador de projeto Firebase inesperado: '+data.projectId);
  }
  if (!Array.isArray(data.authorizedDomains)) {
    throw new Error('Firebase não retornou domínios autorizados; confira o provedor Google no console.');
  }
  const domain='alvesjardimitalo-oss.github.io';
  if (!data.authorizedDomains.includes(domain)) {
    throw new Error('DOMÍNIO NÃO AUTORIZADO: incluir '+domain+' no Firebase Authentication > Settings > Authorized domains.');
  }
  return 'Domínio do GitHub Pages autorizado.';
});
await check('Firebase Authentication: login Google habilitado', async () => {
  const url='https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key='+encodeURIComponent(firebaseConfig.apiKey);
  const response=await fetch(url,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({providerId:'google.com',continueUri:site}),
    signal:AbortSignal.timeout(20000)
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data?.error?.message||('HTTP '+response.status));
  if(!data.authUri)throw new Error('Provedor Google não retornou URI de autenticação.');
  return 'Provedor Google retornou URI OAuth válida (sem fazer login).';
});
if (failed) process.exitCode = 1;
