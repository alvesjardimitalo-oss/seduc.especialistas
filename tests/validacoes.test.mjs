import test from 'node:test';
import assert from 'node:assert/strict';
import {cpfValido,lerHorarios,gerarSlotsSemana,dentroDaJornada,possuiConflito,podeAgendar,resumirPerfil} from '../assets/js/validacoes.mjs';
test('CPF: impede formato inválido e dígitos repetidos',()=>{
 assert.equal(cpfValido('111.111.111-11'),false);
 assert.equal(cpfValido('12345678900'),false);
 assert.equal(cpfValido('529.982.247-25'),true);
});
test('jornada: analisa dias, limites e formato',()=>{
 const h=lerHorarios('1 08:00-12:00; 3 13:00-17:00');
 assert.equal(h.length,2);
 assert.equal(dentroDaJornada(new Date(2026,9,26,11,30),30,h),true);
 assert.equal(dentroDaJornada(new Date(2026,9,26,11,45),30,h),false);
 assert.equal(dentroDaJornada(new Date(2026,9,27,11,0),30,h),false);
 assert.throws(()=>lerHorarios('1 12:00-08:00'));
});
test('agenda: detecta sobreposição no mesmo profissional',()=>{
 const a=[{id:'x',autor_uid:'prof',inicio:'2026-11-02T12:00:00.000Z',duracao_min:60,status:'agendado'}];
 assert.equal(possuiConflito('2026-11-02T12:30:00.000Z',30,a,'prof'),true);
 assert.equal(possuiConflito('2026-11-02T13:00:00.000Z',30,a,'prof'),false);
 assert.equal(possuiConflito('2026-11-02T12:30:00.000Z',30,a,'outro'),false);
});
test('agenda: exige vínculo válido e escopo',()=>{
 assert.throws(()=>podeAgendar({inicio:'2027-11-02T12:00:00.000Z',escolaId:'a',uid:'x',vinculos:[],agendamentos:[]}),/vínculo/);
 assert.deepEqual(resumirPerfil({perfil:'especialista',ativo:true,escolas:['a']}),{perfil:'especialista',ativo:true,escolas:['a']});
});

test('grade semanal gera meias-horas para verificação no servidor',()=>{
 const horarios=lerHorarios('1 08:00-10:00; 3 13:00-14:00');
 assert.deepEqual(gerarSlotsSemana(horarios),[64,65,66,67,170,171]);
 assert.throws(()=>lerHorarios('1 08:15-09:45'),/meias horas/);
});
