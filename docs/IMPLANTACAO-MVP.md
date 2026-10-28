# Implantação do MVP — ambiente de homologação

## Estado
Esta branch contém uma primeira interface funcional e integração Firebase, **não uma implantação homologada**. Nunca cadastre CPF, saúde ou dados reais de crianças enquanto houver pendências de segurança.

## 1. Preparar Firebase independente
1. Crie um projeto exclusivo para SEDUC Especialistas em https://console.firebase.google.com/.
2. Habilite Authentication > Google.
3. Habilite Cloud Firestore em modo produção.
4. Registre o app Web e copie as configurações para `assets/js/firebase-config.js`.
5. Publique `firestore.rules` no Console Firestore (o arquivo local NÃO é aplicado automaticamente).
6. Configure domínios autorizados de autenticação (GitHub Pages ou domínio oficial).

## 2. Provisionar o superadministrador com segurança
A conta inicial **não é promovida automaticamente**, para evitar que o primeiro visitante se aproprie do sistema:
1. Entre com a conta Google escolhida no site e verifique o UID no Firebase Authentication.
2. No Firestore, edite manualmente **apenas aquela conta**, em `usuarios/{uid}`, definindo `ativo:true`, `perfil:"superadmin"`, `gerenciar:true`, `escolas:[]`. Confirme o UID e o e-mail antes de salvar.
3. Saia e entre novamente. Nunca habilite primeira-conta-vira-admin no cliente.

## 3. Publicação para testes
Abra GitHub > Settings > Pages e habilite publicação da branch de homologação `feature/mvp-especialistas` (pasta root) ou efetue deploy em hospedagem de testes. Sem Firebase configurado, o site mostra somente uma tela explicativa e não registra dados.

## 4. Configuração inicial
- Na aba Escolas, cadastre as cinco instituições listadas na especificação. INEP, telefones e endereços exigem confirmação oficial.
- As pessoas acessam a aplicação com Google e aparecem no Firestore como pendentes.
- Superadmin aprova pessoas e atribui perfis e escolas pelo módulo Usuários (etapa inicial técnica: usa UID).
- Profissional deve ter vínculo ativo, escola e horários no formato `1 08:00-12:00; 3 13:00-17:00` (domingo = 0, segunda = 1).
- Registre alunos e atendimentos somente com dados fictícios até homologação.

## 5. Limitações e bloqueios antes da produção
- O filtro de jornada do MVP roda no navegador; **a validação atômica no backend ainda precisa ser criada** para impedir agendamentos manipulados ou concorrentes.
- As edições de notas já geram versões imutáveis em lote, mas o histórico completo de acessos/consultas (auditoria administrativa) ainda precisa ser implementado.
- O cadastro passou a separar CPF, filiação, endereço e telefone em coleções privadas; ainda falta homologação das políticas de retenção e de consulta de cada campo.
- A gestão de usuários já apresenta a lista de pessoas autenticadas e permite atribuir perfis e escolas. A criação de usuários continua sendo por convite/login Google; falta envio de convite e fluxo de recuperação/regularização de identidade.
- Foram criados testes automatizados de regras no Firestore Emulator. É necessário completar cenários de consulta multi-escola, vínculos revogados, simultaneidade e perfis administrativos antes de homologar.
- Foi incluído um registro inicial e **declaratório** de frequência com entrada e saída carimbadas no servidor, que não substitui homologação da jornada pela chefia. Relatórios avançados, matrícula histórica, transferências, exportação, backup, política de retenção e fluxo de eliminação legal ainda não foram implementados.
- A UI não implementa todos os critérios da especificação. Há necessidade de revisão de acessibilidade e validação com a equipe da Educação.

**Portanto: esta entrega é um MVP de desenvolvimento e não deve ser liberada para uso com dados pessoais de alunos.**

## 6. Testes automatizados no GitHub
A branch contém um workflow em `.github/workflows/testes.yml` que verifica sintaxe, valida CPF/jornadas/conflitos e executa testes de permissões usando o emulador oficial do Firestore com dados fictícios. A publicação de regras em produção deve acontecer **somente após revisão e testes verdes**.

Com Node.js e Java instalados, localmente:
```bash
npm install
npm test
npm run test:rules
```

## 7. Funcionalidades presentes no protótipo
- Lista e carga assistida das cinco escolas; demais dados são informados pela Secretaria.
- Cadastro de usuários por login Google, com aprovação por perfil e escola.
- Profissionais, dados privados, vínculos e jornadas.
- Alunos, dados privados, edição e arquivamento sem exclusão de atendimentos.
- Agendamento, atendimento com nota de até 1.000 caracteres e histórico expandível.
- Textos privados das notas separados dos metadados gerenciais.
- Edição por autor/superadmin com justificativa e cópia de versão imutável.
- Frequência declaratória: entrada e saída pela hora do servidor, sem equivaler a ponto homologado.

> As verificações de choque de horários e de limites de jornada ainda ocorrem **apenas no navegador**. Para produção, uma API confiável/Cloud Function ou outro backend transacional deverá executar essas verificações também no servidor, especialmente com múltiplos profissionais registrando simultaneamente.
