import test from 'node:test';
import assert from 'node:assert/strict';
import {prepararCadastroAluno,dataNascimentoValida,formatarCPF,formatarCEP,consultarCEP} from '../assets/js/cadastro-alunos.mjs';
import {readFileSync} from 'node:fs';
const ficha=()=>({
 escola_id:'escolaA',nome:'Aluno de Teste',nascimento:'2016-02-29',matricula:'123',
 cpf:'',mae_nome:'Maria de Teste',pai_nao_declarado:'sim',
 pai_nome:'',responsavel_nome:'Maria de Teste',responsavel_parentesco:'Mae',
 responsavel_telefone:'(33) 99999-9999',responsavel_telefone_alternativo:'',
 responsavel_email:'',cep:'35170-000',logradouro:'Rua de Teste',numero:'12',
 complemento:'',bairro:'Centro',cidade:'Cidade Fictícia',uf:'MG',referencia:''
});
test('valida datas reais e rejeita datas futuras, dias inexistentes',()=>{
 assert.equal(dataNascimentoValida('2016-02-29',new Date('2026-10-28')),true);
 assert.equal(dataNascimentoValida('2016-02-30',new Date('2026-10-28')),false);
 assert.equal(dataNascimentoValida('2030-01-01',new Date('2026-10-28')),false);
});
test('cadastro preserva dados sensíveis na coleção privada e não declara pai quando ausente',()=>{
 const r=prepararCadastroAluno(ficha(),{criadoPor:'testUser'});
 assert.deepEqual(Object.keys(r.publico).sort(),['ativo','criado_por','escola_id','matricula','nascimento','nome'].sort());
 assert.equal(r.publico.nome,'Aluno de Teste');
 assert.equal(r.privado.pai_nao_declarado,true);
 assert.equal(r.privado.pai_nome,'');
 assert.equal(r.privado.mae_nome,'Maria de Teste');
 assert.equal(r.privado.responsavel_telefone,'(33) 99999-9999');
 assert.equal(r.privado.cep,'35170-000');
 assert.equal(r.privado.criado_por,'testUser');
});
test('valida CPF e o campo de pai declarado',()=>{
 let d=ficha();d.cpf='11111111111';assert.throws(()=>prepararCadastroAluno(d,{criadoPor:'u'}),/CPF/);
 d=ficha();d.pai_nao_declarado='nao';assert.throws(()=>prepararCadastroAluno(d,{criadoPor:'u'}),/pai/);
 d.pai_nome='João de Teste';assert.equal(prepararCadastroAluno(d,{criadoPor:'u'}).privado.pai_nao_declarado,false);
 assert.equal(formatarCPF('52998224725'),'529.982.247-25');
});
test('edita aluno preservando escola e autoria originais',()=>{
 const r=prepararCadastroAluno(ficha(),{criadoPor:'outro',existente:{escola_id:'escolaA',criado_por:'autorOriginal',ativo:true},privadoAnterior:{criado_por:'autorOriginal'}});
 assert.equal(r.publico.criado_por,'autorOriginal');
 assert.equal(r.privado.criado_por,'autorOriginal');
});
test('consulta de CEP somente usa o CEP e preenche campos municipais',async()=>{
 let requested;
 const result=await consultarCEP('35170-000',async(url,options)=>{requested=url;assert.deepEqual(options.headers,{Accept:'application/json'});return {ok:true,json:async()=>({logradouro:'Rua Fictícia',bairro:'Centro',localidade:'Município Fictício',uf:'MG'})};});
 assert.equal(requested,'https://viacep.com.br/ws/35170000/json/');
 assert.equal(result.cidade,'Município Fictício');
 assert.equal(formatarCEP('35170000'),'35170-000');
 await assert.rejects(()=>consultarCEP('000',async()=>({})),/CEP/);
});
const app=readFileSync(new URL('../assets/js/app.js',import.meta.url),'utf8');
test('formulário usa modelo unificado para criar e editar aluno',()=>{
 assert.match(app,/function camposCadastroCompletoAluno/);
 assert.match(app,/function configurarFormularioCompletoAluno/);
 assert.match(app,/async function salvarCadastroCompletoAluno/);
 assert.match(app,/function editStudent/);
 assert.match(app,/consultarCEP\(codigo\)/);
 assert.match(app,/batch\.set\(ref,privado\)/);
});
test('aviso LGPD exige confirmação para continuar e consta no tutorial',()=>{
 assert.match(app,/function mostrarTermosSeguranca/);
 assert.match(app,/id="lgpd-confirmar"/);
 assert.match(app,/button\.disabled=!checkbox\.checked/);
 assert.match(app,/await mostrarTermosSeguranca\(\)/);
 assert.match(app,/textoAvisoSeguranca\(\)/);
 assert.match(app,/Os Termos de Uso são aceitos uma vez por versão/);
 assert.match(app,/termosAceitosNesteDispositivo\(\)/);
});
