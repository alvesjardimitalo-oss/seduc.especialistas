// Service worker do SEDUC Especialistas: guarda o aplicativo (telas, estilos, scripts e logotipos)
// para abrir sem internet. Os DADOS ficam no cache do Firestore (IndexedDB), não aqui.
// Ao publicar mudanças no código, aumente a VERSAO.
const VERSAO = 'seduc-v2.2.2';
const APP = ['./', 'index.html', 'css/app.css', 'css/impressao.css',
  'js/app.js', 'js/config.js', 'js/dados.js', 'js/dominio.js', 'js/estado.js', 'js/firebase.js', 'js/formularios.js', 'js/impressao.js',
  'js/ui.js', 'js/backup.js', 'js/grafico.js', 'js/calendario-pdf.js',
  'js/paginas/agenda.js', 'js/paginas/alunos.js', 'js/paginas/equipe.js', 'js/paginas/escolas.js', 'js/paginas/fila.js', 'js/paginas/frequencia.js',
  'js/paginas/painel.js', 'js/paginas/prontuario.js', 'js/paginas/relatorios.js', 'js/paginas/seguranca.js',
  'img/logos/seduc.png', 'img/logos/joao-souza-lima.png', 'img/logos/terezinha-sarmento.png', 'img/logos/monteiro-lobato.png',
  'img/logos/sebastiana-duarte-cabral.png', 'img/logos/wilma-gloria.png'];
const SDK = 'https://www.gstatic.com/firebasejs/';

self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(VERSAO).then(c => c.addAll(APP)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', ev => {
  ev.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // SDK do Firebase (versão fixa): do cache primeiro.
  if (url.href.startsWith(SDK)) {
    ev.respondWith(caches.match(req).then(r => r || fetch(req).then(resp => { const copia = resp.clone(); caches.open(VERSAO).then(c => c.put(req, copia)); return resp; })));
    return;
  }
  if (url.origin !== location.origin) return; // Firestore, Auth etc. não passam pelo cache do aplicativo
  // Código do próprio sistema: rede primeiro (sempre a versão nova), cache quando sem internet.
  ev.respondWith(fetch(req).then(resp => {
    if (resp.ok) { const copia = resp.clone(); caches.open(VERSAO).then(c => c.put(req, copia)); }
    return resp;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});
