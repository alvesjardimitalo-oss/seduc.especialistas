# SEDUC Especialistas — Especificação funcional v0.1

> **Revisão v2 (out/2026)** — ajustes definidos com a equipe, que prevalecem sobre o texto abaixo:
> - A equipe de especialistas é **única e atende as 6 instituições** (inclui a Creche Sebastiana Duarte Cabral). O acesso clínico é da equipe inteira, não por vínculo com cada escola.
> - A jornada é **por profissional** (dias, horários e local informativo). Não há mais vínculos por escola, frequência funcional nem importação de servidores.
> - O prontuário segue o modelo do SUS: linha do tempo de cards com *trabalhado*, *desenvolvido* e *orientações*, tipo de atendimento e evolução. O texto clínico fica separado dos metadados.
> - Registros nunca são apagados: retificar gera versão imutável e anular exige motivo (CFFa 649/2022 e CFP 001/2009).
> - A direção escolar cadastra alunos da própria escola com o motivo do encaminhamento e agenda nos horários livres, mas não lê o conteúdo clínico.
> - Detalhes técnicos estão no [README](../README.md) e em [IMPLANTACAO.md](IMPLANTACAO.md).


> Documento de planejamento. O sistema não está implantado e não deve receber informações pessoais reais antes da homologação.

## 1. Objetivo e interface
Centralizar o acompanhamento de alunos atendidos por profissionais especializados da rede municipal. Interface baseada visualmente no SISDIFI: fonte Public Sans; menu lateral azul-marinho (#102a45), destaque dourado (#c2912e), cartões brancos, fundo cinza-claro (#f1f3f6), formulários, tabelas e painéis responsivos. O banco de dados e as permissões serão **independentes** do SISDIFI.

## 2. Escolas iniciais
- Escola Municipal Doutor João de Souza Lima
- Escola Municipal Professora Terezinha Sarmento de Oliveira
- Creche Municipal Wilma Glória Nunes Mourão
- Escola Municipal Prefeito José Pedro da Silva
- Escola Municipal Monteiro Lobato

Campos: nome oficial, código INEP, endereço completo, telefone, e-mail institucional, nome da direção, status e observações. Os dados não informados devem ficar em branco até confirmação oficial, sem valores inventados.

## 3. Estrutura de navegação
- Dashboard
- Escolas
- Profissionais
- Alunos
- Agenda
- Atendimentos
- Frequência profissional
- Relatórios
- Usuários e permissões (somente autorizados)
- Auditoria / Configurações (conforme perfil)

## 4. Perfis e permissões
| Perfil | Abrangência | Ações |
|---|---|---|
| Superadministrador | Toda a rede | Todas as operações, gestão de acesso, auditoria e configurações |
| Secretaria de Educação | Rede municipal | Visualizar escolas, indicadores e relatórios; quando delegada, cadastrar usuários, escolas e profissionais, definir cargo e escopo |
| Direção escolar | Escola(s) autorizada(s) | Visualizar agendas, acompanhamento e relatórios da escola; acesso a notas sensíveis somente quando estritamente autorizado |
| Especialista | Escola(s) do vínculo vigente | Cadastrar alunos autorizados, agendar e registrar atendimentos, consultar históricos pertinentes; editar e cancelar apenas registros próprios |
| Visualizador | Escopo definido | Relatórios e informações mínimas necessárias; nunca editar atendimentos |

Regras adicionais: ninguém cria outro superadministrador sem autoridade de superadministrador; delegação de cadastro de usuários não confere permissão de escalonar o próprio perfil; usuário desativado perde acesso imediatamente. Os controles devem existir no backend/regras do banco, não só na tela.

## 5. Login
- Firebase Authentication com conta Google.
- Primeiro login sem autorização gera solicitação de acesso pendente, sem liberar conteúdos.
- Superadministrador ou Secretaria delegada aprova a pessoa e atribui perfil, escolas e capacidades.
- Convite por e-mail (a profissional usa a própria conta Google); **não existe envio de senha Google**.
- Implantação inicial exige designação segura do superadministrador por configuração administrativa, nunca promovendo automaticamente a primeira pessoa que entrar.

## 6. Cadastros de profissionais e vínculos
Dados profissionais: nome completo, nascimento, CPF, endereço, telefone, e-mail, especialidade e situação.

Vínculos (1 profissional pode ter vários): escola, cargo/função naquela instituição, especialidade exercida, jornada semanal, dias e intervalos de trabalho, data de início/fim, situação ativa/afastada e responsável pela inclusão. Possibilidade de exercer o mesmo cargo em mais de uma escola. Ao mudar de escola ou cargo, guardar histórico de vínculos antigos.

Agendamentos só podem ocorrer durante o vínculo e jornada vigentes, sem sobreposição e respeitando afastamentos/bloqueios. A validação deverá ocorrer no servidor/banco e na interface; calendário visual por especialista e por instituição.

Frequência profissional deve ter registros próprios de presença, entrada, saída, justificativas e ausências. **Atendimento realizado não equivale automaticamente a frequência funcional.**

## 7. Cadastro de alunos
Vinculação por matrícula, não por cópia independente de aluno em cada escola. Campos: nome, matrícula, CPF quando necessário, nascimento, filiação/responsáveis, endereço, telefone e situação da matrícula. Deduplicação por matrícula e combinação de dados para evitar homônimos. Permitir transferências escolares sem perder histórico anterior, mantendo restrições de acesso entre escolas.

Formulário de cadastro disponível ao tentar selecionar um aluno inexistente. Edição apenas por pessoas autorizadas; inativar/arquivar com motivo em vez de apagar fisicamente atendimentos e registros de auditoria. Se a administração exigir exclusão definitiva após prazo legal, implementar fluxo controlado de descarte.

Perfil do aluno: ficha cadastral mínima, profissionais responsáveis, histórico cronológico por data e especialidade; cada atendimento com seta para expandir o conteúdo completo, filtros e busca. Profissionais legitimamente envolvidos com o aluno enxergam os mesmos históricos pertinentes, mas só o autor (ou superadministrador) modifica registros antigos.

## 8. Fluxo de consultas e atendimentos
No dashboard, botão **+ Novo** com:
1. Atendimento imediato
2. Agendar consulta

Passos: escolher escola e vínculo, selecionar aluno existente ou cadastrá-lo, escolher data/hora, especialidade, modalidade e duração. Em imediato, iniciar registro no horário atual; em agendamento, criar evento futuro.

Campos do atendimento: aluno, escola, profissional autor, vínculo, especialidade, data/hora inicial e final, status, observação em **texto simples (até 1.000 caracteres)**, encaminhamentos e retorno sugerido.

Status: agendado, realizado, cancelado, remarcado, falta do aluno, falta do profissional.

Ações: salvar, editar (apenas autor), cancelar/arquivar (apenas autor; exige justificativa). Exibir confirmação e impacto antes de arquivar aluno. **Não apagar em cascata consultas**. Salvar autor, criação, atualização e versões anteriores para auditoria. Superadministrador tem operação excepcional, igualmente auditada.

## 9. Relatórios e painel
- Indicadores: alunos acompanhados, atendimentos de hoje, realizados, previstos, faltas, cancelamentos, profissionais ativos, demanda por especialidade.
- Filtros: escola, especialidade, profissional, aluno, intervalo de datas e status.
- Relatórios: por escola, aluno, profissional, especialidade, frequência laboral, ausências e horas planejadas x realizadas.
- Exportação PDF/planilha só para perfis autorizados, minimizando e mascarando dados pessoais quando não essenciais.
- Visão gerencial da SEDUC: tendências e totais por escola, sem expor indiscriminadamente notas detalhadas.

## 10. Sugestões futuras
- Plano individual de acompanhamento educacional, metas e evolução.
- Encaminhamentos e devolutivas com prazos e responsáveis.
- Lista de espera e indicador do tempo até primeiro atendimento.
- Alertas de remarcação e retorno, sem enviar observações sensíveis em notificações.
- Presença do aluno em cada consulta, separada do controle de frequência dos servidores.
- Linha do tempo de acompanhamento entre anos letivos e transferências.
- Relatórios de demanda reprimida e alocação de profissionais/carga horária.
- Anexos e documentos institucionais somente com finalidade, permissão, retenção e registro de acesso definidos.

## 11. Modelo de dados inicial
- `usuarios`: autenticação, papel administrativo, estado, acessos delegados.
- `escolas`: dados cadastrais.
- `profissionais` e `profissionais_privado`: cadastro administrativo e dados restritos.
- `vinculos`: usuário/profissional, escola, função e jornadas com vigência.
- `alunos` e `alunos_privado`: identificador e dados de acesso controlado.
- `matriculas`: escola, aluno, série/turma (opcional), vigência e transferências.
- `agendamentos`: intervalos, vínculos, status e conflitos.
- `atendimentos`: texto de até mil caracteres, autoria e acesso por vínculo.
- `atendimentos_versoes`: alterações e justificativas, imutáveis.
- `frequencias_profissionais`: jornadas cumpridas, ausências e justificativas.
- `encaminhamentos`, `logs_auditoria`, `configuracoes`.

## 12. LGPD e segurança — regras fundamentais
O repositório GitHub é público, mas **nunca** devem ser públicos os dados dos alunos, profissionais, responsáveis ou atendimentos. O termo “público para visualizar” significa **compartilhamento interno, com controle de acesso**.

Dados relativos a saúde/deficiência podem ser sensíveis; crianças e adolescentes exigem proteção adicional e prioridade ao melhor interesse (LGPD, arts. 11 e 14; Enunciado CD/ANPD nº 1/2023). Restringir acesso por finalidade, escola, vínculo e função. Não incluir diagnósticos, laudos ou CPF nos indicadores gerais. Minimizar coleta e definir política formal de retenção/descarte e responsabilidade pelo tratamento com a administração municipal.

Controles técnicos: autenticação Google, autorização no Firestore, perfis sem autoelevação, auditoria, transporte HTTPS, backups, segregação de dados privados, revogação de acesso, testes de isolamento entre escolas e exportação controlada. Criar projeto Firebase **diferente** do SISDIFI e implantar as regras de segurança antes de cadastrar dados reais.

Referências: https://www2.camara.leg.br/legin/fed/lei/2018/lei-13709-14-agosto-2018-787077-normaatualizada-pl.html
e https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-divulga-enunciado-sobre-o-tratamento-de-dados-pessoais-de-criancas-e-adolescentes

## 13. Etapas de entrega
1. Projeto web com identidade SISDIFI, login Google e autorização restrita.
2. Escolas, usuários, profissionais, vínculos, jornadas e cargos.
3. Alunos, matrículas, busca e prontuário educacional.
4. Agenda, atendimentos, histórico compartilhado e propriedade de edição.
5. Frequência, indicadores, relatórios e exportação.
6. Testes de permissão, segurança, privacidade, backups e homologação com dados fictícios.

**Critério de aceitação essencial:** uma especialista da Escola A não pode acessar dados da Escola B sem vínculo ou autorização; duas especialistas autorizadas conseguem ler o mesmo atendimento, mas somente a autora pode alterá-lo; a exclusão de aluno não provoca perda silenciosa dos históricos; profissional sem jornada válida não consegue agendar; pessoas não aprovadas não acessam nenhum cadastro.
