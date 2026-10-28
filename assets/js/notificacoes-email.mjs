// Mensagem administrativa mínima. Não inclui CPF, contato da família,
// observações clínicas, laudos nem diagnóstico.
export function criarEmailAgendamento({aluno,escola,profissional,inicio,duracaoMin=30,especialidade='',remetente='',destinatario=''}) {
 const data=inicio?.toDate?.()||(inicio instanceof Date?inicio:new Date(inicio));
 if(!aluno||!escola||!profissional||!Number.isFinite(data.getTime()))throw Error('Dados do agendamento incompletos.');
 const pad=n=>String(n).padStart(2,'0');
 const dia=pad(data.getDate())+'/'+pad(data.getMonth()+1)+'/'+data.getFullYear();
 const hora=pad(data.getHours())+':'+pad(data.getMinutes());
 const assunto='SEDUC | Novo agendamento de consulta — '+aluno;
 const corpo=[
  'Prezada(o),',
  '',
  'Informamos que foi registrado um novo agendamento de consulta no sistema SEDUC Especialistas.',
  '',
  'Aluno: '+aluno,
  'Escola: '+escola,
  'Profissional responsável: '+profissional,
  'Especialidade: '+(especialidade||'Atendimento especializado'),
  'Data: '+dia,
  'Horário: '+hora,
  'Duração: '+Number(duracaoMin)+' minutos',
  '',
  'Consulte a Agenda do SEDUC Especialistas para confirmar os detalhes e eventuais alterações.',
  'Esta mensagem contém dados escolares pessoais. Não encaminhe a terceiros não autorizados.',
  '',
  'Agendado por: '+(remetente||'Secretaria de Educação')
 ].join('\n');
 const email=String(destinatario||'').trim();
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Informe um e-mail de destino válido.');
 const mailto='mailto:'+encodeURIComponent(email)+'?subject='+encodeURIComponent(assunto)+'&body='+encodeURIComponent(corpo);
 return {assunto,corpo,mailto,data:dia,hora};
}
