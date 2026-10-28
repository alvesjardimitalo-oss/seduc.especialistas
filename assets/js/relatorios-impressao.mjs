import {resumirAluno,dataRegistro,etiquetasEvolucao} from './consultas-resumo.mjs';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dt=x=>{const n=dataRegistro(x);return n?new Date(n).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'—'};
const date=x=>{const n=dataRegistro(x);return n?new Date(n).toLocaleDateString('pt-BR'):'—'};
const table=(head,rows)=>'<table><thead><tr>'+head.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+(rows.length?rows.map(row=>'<tr>'+row.map(c=>'<td>'+esc(c)+'</td>').join('')+'</tr>').join(''):'<tr><td colspan="'+head.length+'">Sem registros para este período.</td></tr>')+'</tbody></table>';
const card=(n,label)=>'<div class="kpi"><b>'+Number(n||0)+'</b><span>'+esc(label)+'</span></div>';
const header=(title,subtitle,user,reference)=>'<header class="document-header"><span class="seal">SE</span><div><strong>SECRETARIA MUNICIPAL DE EDUCAÇÃO</strong><small>SEDUC Especialistas · Sistema de gestão de atendimentos</small><small>DOCUMENTO INSTITUCIONAL · USO RESTRITO</small></div></header><div class="title"><span>RELATÓRIO DE ACOMPANHAMENTO</span><h1>'+esc(title)+'</h1><p>'+esc(subtitle)+'</p></div><div class="meta"><div>Emitido em<strong>'+esc(new Date().toLocaleString('pt-BR'))+'</strong></div><div>Responsável pela emissão<strong>'+esc(user)+'</strong></div><div>Referência<strong>'+esc(reference)+'</strong></div></div>';
const section=(title,content)=>'<section><h2>'+esc(title)+'</h2>'+content+'</section>';
const signature='<div class="signature">Assinatura e identificação do responsável pela emissão</div><p class="disclaimer">Fonte: registros disponíveis no SEDUC na data de emissão. Os indicadores quantitativos não constituem diagnóstico nem comprovação automática de evolução clínica.</p>';
export function montarDocumentoAluno({aluno,atendimentos=[],agendamentos=[],revisoes=[],relatorios=[],emissor='',escola='',incluirNotas=false}){
 const r=resumirAluno(aluno.id,atendimentos,agendamentos,revisoes);
 const visitas=atendimentos.filter(x=>x.aluno_id===aluno.id&&x.status==='realizado').sort((a,b)=>dataRegistro(b.data)-dataRegistro(a.data));
 const agenda=agendamentos.filter(x=>x.aluno_id===aluno.id).sort((a,b)=>dataRegistro(b.inicio)-dataRegistro(a.inicio));
 const docs=relatorios.filter(x=>x.aluno_id===aluno.id).sort((a,b)=>dataRegistro(b.criado_em)-dataRegistro(a.criado_em));
 const status={agendado:'Agendado',em_atendimento:'Em atendimento',realizado:'Realizado',cancelado:'Cancelado',remarcado:'Remarcado',falta_aluno:'Falta do aluno',falta_profissional:'Falta profissional'};
 const conteudo=header('Histórico individual do aluno','Atendimentos, comparecimento, evolução documentada e relatórios profissionais',emissor,aluno.nome)+
 section('1. Identificação','<dl><dt>Aluno</dt><dd>'+esc(aluno.nome)+'</dd><dt>Escola</dt><dd>'+esc(escola)+'</dd><dt>Primeiro acompanhamento</dt><dd>'+date(r.primeiraConsulta)+'</dd><dt>Último acompanhamento</dt><dd>'+date(r.ultimaConsulta)+'</dd></dl>')+
 section('2. Indicadores de acompanhamento','<div class="kpis">'+card(r.consultas,'Consultas realizadas')+card(r.agendados,'Agendamentos futuros')+card(r.faltasAluno,'Faltas do aluno')+card(r.remarcados,'Remarcações')+'</div><p><strong>Especialidades:</strong> '+esc(r.especialidades.join(', ')||'Não informadas')+'</p><p><strong>Profissionais:</strong> '+esc(r.profissionais.join(', ')||'Não informados')+'</p>')+
 section('3. Evolução documentada','<p>Avaliações registradas: <strong>'+r.evolucao.avaliacoes+'</strong>. Avanço observado: <strong>'+r.evolucao.avancos+'</strong>. Sem mudança observada: <strong>'+r.evolucao.semMudanca+'</strong>. Reavaliação indicada: <strong>'+r.evolucao.reavaliacao+'</strong>. Revisões de metas: <strong>'+r.evolucao.revisoes+'</strong>.</p><p class="disclaimer">'+esc(r.evolucao.descricao)+'</p>')+
 section('4. Consultas realizadas',table(['Data','Profissional','Especialidade','Classificação'],visitas.map(x=>[dt(x.data||x.inicio),x.autor_nome||'—',x.especialidade||'—',etiquetasEvolucao[x.evolucao_observada]||'Não avaliada']))+(incluirNotas?visitas.map((x,i)=>'<article class="entry"><h3>Consulta '+(i+1)+' · '+dt(x.data||x.inicio)+'</h3><p><strong>'+esc(x.autor_nome)+'</strong> · '+esc(x.especialidade)+'</p><p>'+esc(x.texto||'Sem descrição disponível.').replace(/\n/g,'<br>')+'</p></article>').join(''):'<p class="disclaimer">As descrições clínicas não estão incluídas neste documento por restrição de acesso.</p>'))+
 section('5. Agenda, faltas e remarcações',table(['Data prevista','Profissional','Situação','Justificativa'],agenda.map(x=>[dt(x.inicio),x.autor_nome||'—',status[x.status]||x.status,x.motivo_falta||x.motivo_remarcacao||'—'])))+
 section('6. Relatórios profissionais emitidos',docs.length?docs.map(x=>'<article class="entry"><h3>'+esc(x.titulo)+' · '+dt(x.criado_em)+'</h3><p>'+esc(x.autor_nome)+' · '+esc(x.especialidade)+'</p><p>'+esc(x.texto).replace(/\n/g,'<br>')+'</p></article>').join(''):'<p>Nenhum relatório profissional emitido.</p>')+
 signature;
 return document(conteudo,'Histórico individual · '+aluno.nome);
}
export function montarDocumentoGerencial({atendimentos=[],agendamentos=[],escolas=[],emissor='',referencia='Período selecionado'}){
 const realizados=atendimentos.filter(a=>a.status==='realizado');
 const faltas=agendamentos.filter(a=>['falta_aluno','falta_profissional'].includes(a.status));
 const nomes=new Map(escolas.map(e=>[e.id,e.nome]));
 const porEscola=[...new Set([...realizados,...agendamentos].map(x=>x.escola_id))].filter(Boolean).map(id=>{
  const visits=realizados.filter(x=>x.escola_id===id),agenda=agendamentos.filter(x=>x.escola_id===id);
  return [nomes.get(id)||id,new Set(visits.map(x=>x.aluno_id)).size,visits.length,agenda.filter(x=>x.status==='agendado').length,agenda.filter(x=>x.status==='falta_aluno').length];
 }).sort((a,b)=>a[0].localeCompare(b[0],'pt-BR'));
 const specialties=[...new Set([...realizados,...agendamentos].map(x=>x.especialidade).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 const professionals=[...new Map([...realizados,...agendamentos].filter(x=>x.autor_uid).map(x=>[x.autor_uid,x.autor_nome||x.autor_uid])).entries()];
 const labels={agendado:'Agendado',realizado:'Realizado',cancelado:'Cancelado',remarcado:'Remarcado',em_atendimento:'Em atendimento',falta_aluno:'Falta do aluno',falta_profissional:'Falta profissional'};
 const conteudo=header('Relatório gerencial','Indicadores consolidados de atendimentos especializados',emissor,referencia)+
 section('1. Panorama geral','<div class="kpis">'+card(new Set(realizados.map(x=>x.aluno_id)).size,'Alunos atendidos')+card(realizados.length,'Consultas realizadas')+card(agendamentos.filter(x=>x.status==='agendado').length,'Consultas agendadas')+card(faltas.length,'Ausências registradas')+'</div>')+
 section('2. Indicadores por instituição',table(['Escola','Alunos','Realizados','Agendados','Faltas aluno'],porEscola))+
 section('3. Produção por especialidade',table(['Especialidade','Realizados','Agendados'],specialties.map(e=>[e,realizados.filter(x=>x.especialidade===e).length,agendamentos.filter(x=>x.especialidade===e&&x.status==='agendado').length])))+
 section('4. Produção por profissional',table(['Profissional','Realizados','Agendados'],professionals.map(([uid,nome])=>[nome,realizados.filter(x=>x.autor_uid===uid).length,agendamentos.filter(x=>x.autor_uid===uid&&x.status==='agendado').length])))+
 section('5. Controle de comparecimento',table(['Data','Escola','Profissional','Situação'],agendamentos.slice().sort((a,b)=>dataRegistro(b.inicio)-dataRegistro(a.inicio)).map(x=>[dt(x.inicio),nomes.get(x.escola_id)||'—',x.autor_nome||'—',labels[x.status]||x.status])))+
 '<p class="disclaimer">Os dados deste documento refletem os filtros aplicados no momento da emissão. Descrições individuais não constam no relatório gerencial.</p>'+signature;
 return document(conteudo,'Relatório gerencial · SEDUC');
}
function document(body,title){
 const css=[
 '@page{size:A4;margin:17mm 15mm 18mm}',
 '*{box-sizing:border-box}body{font:11px/1.5 Arial,sans-serif;background:#eff3f6;color:#21394a;margin:0}',
 '.toolbar{position:sticky;top:0;background:#183d4c;color:#fff;padding:12px 20px;display:flex;justify-content:space-between;align-items:center}',
 '.toolbar button{background:#0b978a;color:#fff;border:0;border-radius:7px;padding:10px 16px;cursor:pointer;font-weight:bold}',
 '.paper{width:210mm;max-width:100%;min-height:297mm;margin:20px auto;padding:17mm 15mm 18mm;background:white;box-shadow:0 10px 30px #0002}',
 '.document-header{display:flex;gap:14px;align-items:center;border-bottom:3px solid #14837e;padding-bottom:14px}',
 '.document-header div{display:grid;gap:2px}.document-header strong{font-size:12px;letter-spacing:.04em}.document-header small{font-size:9px;color:#6b8290}',
 '.seal{background:#e4f5f1;color:#116f73;padding:15px;border-radius:11px;font-size:19px;font-weight:900}',
 '.title{margin:24px 0}.title>span{color:#158c84;font-size:9px;font-weight:bold;letter-spacing:.14em}',
 '.title h1{font-size:22px;margin:6px 0;color:#173b4a}.title p{color:#718797}',
 '.meta{border:1px solid #e0e9ed;border-radius:8px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:11px}',
 '.meta div{font-size:9px;color:#778b98}.meta strong{display:block;color:#27475a;font-size:10px;margin-top:3px}',
 'h2{background:#eaf5f4;border-left:3px solid #0b8f85;color:#154e50;padding:9px 10px;font-size:12px;margin:25px 0 12px}',
 'h3{font-size:11px;margin:0 0 6px}p{line-height:1.6}',
 '.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin:13px 0}',
 '.kpi{border:1px solid #dfe9ed;border-radius:8px;padding:10px;background:#fbfdfd;display:grid;gap:3px}',
 '.kpi b{font-size:22px;color:#187d77}.kpi span{font-size:9px;color:#6a8192}',
 'table{width:100%;border-collapse:collapse;font-size:9px;margin:10px 0}thead{display:table-header-group}tr,.entry{break-inside:avoid}',
 'th,td{border:1px solid #dfe9ed;padding:7px 8px;text-align:left;vertical-align:top;overflow-wrap:anywhere}',
 'th{background:#eef7f5;color:#31636a;text-transform:uppercase;font-size:8px;letter-spacing:.045em}',
 'tr:nth-child(even) td{background:#fafcfd}dl{display:grid;grid-template-columns:140px 1fr;gap:5px 10px}',
 'dt{font-weight:bold;color:#758998}dd{margin:0}',
 '.entry{border:1px solid #e3e9ed;padding:11px;margin:9px 0;border-radius:7px}',
 '.signature{text-align:center;width:70%;margin:72px auto 12px;border-top:1px solid #7a919d;padding:8px;font-size:9px}',
 '.disclaimer{font-size:9px;color:#728491;border-top:1px solid #e1e7eb;padding-top:10px;margin-top:20px}',
 '@media print{body{background:#fff}.toolbar{display:none!important}.paper{width:auto;max-width:none;min-height:0;margin:0;padding:0;box-shadow:none}}'
 ].join('');
 return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+'</title><style>'+css+'</style></head><body><div class="toolbar">SEDUC Especialistas · documento para impressão <button onclick="window.print()">Imprimir ou salvar como PDF</button></div><div class="paper">'+body+'</div></body></html>';
}
