import { chromium } from 'playwright';

const site='https://alvesjardimitalo-oss.github.io/seduc.especialistas/';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1280,height:800}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,400))});
try {
  const res=await page.goto(site,{waitUntil:'domcontentloaded',timeout:30000});
  if(!res || !res.ok()) throw new Error('Página inicial não respondeu HTTP 200.');
  await page.getByRole('button',{name:'Entrar com Google'}).waitFor({state:'visible',timeout:30000});
  const title=await page.title();
  if(!title.includes('SEDUC'))throw new Error('Título incorreto: '+title);
  console.log('OK: SEDUC carregou no navegador com botão Entrar com Google.');
  console.log('OK: nenhum login de usuário real foi realizado.');
  if(errors.length)console.warn('Avisos de navegador:',errors.join(' | '));
} catch(e) {
  console.error('Falha ao abrir a aplicação:',e.message);
  console.error('Texto exibido:',(await page.locator('body').innerText().catch(()=>'' )).slice(0,600));
  console.error('Erros capturados:',errors.join(' | ').slice(0,800));
  process.exitCode=1;
} finally {
  await browser.close();
}
