const normalizar=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();
export function filtrarAlunos(alunos,f={}){
 if(f.nascimentoDe&&f.nascimentoAte&&f.nascimentoDe>f.nascimentoAte)throw Error('A data de nascimento inicial deve ser anterior ou igual à final.');
 return alunos.filter(a=>(!f.nome||normalizar(a.nome).includes(normalizar(f.nome)))&&(!f.escola||a.escola_id===f.escola)&&
  (!(f.nascimentoDe||f.nascimentoAte)||(/^\d{4}-\d{2}-\d{2}$/.test(a.nascimento||'')&&(!f.nascimentoDe||a.nascimento>=f.nascimentoDe)&&(!f.nascimentoAte||a.nascimento<=f.nascimentoAte))));
}
export const formatarNascimento=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')?d.split('-').reverse().join('/'):'Não informada';
export function prepararMatricula(d){
 const turma=String(d.turma||'').trim(),professor=String(d.professor||'').trim(),numero=String(d.numero||'').trim(),ano_letivo=Number(d.ano_letivo),turno=d.turno;
 if(!turma||turma.length>120)throw Error('Informe a turma em até 120 caracteres.');
 if(!professor||professor.length>180)throw Error('Informe o professor em até 180 caracteres.');
 if(numero.length>100)throw Error('Número de matrícula inválido.');
 if(!Number.isInteger(ano_letivo)||ano_letivo<2020||ano_letivo>2100)throw Error('Informe um ano letivo entre 2020 e 2100.');
 if(!['manha','tarde','noite','integral','outro'].includes(turno))throw Error('Selecione o turno.');
 return {numero,ano_letivo,turma,turno,professor};
}
export const nomesTurnos={manha:'Manhã',tarde:'Tarde',noite:'Noite',integral:'Integral',outro:'Outro'};
