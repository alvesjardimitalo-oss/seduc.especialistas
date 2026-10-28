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
- O histórico de versões/auditoria de edições ainda precisa ser implementado.
- A tela de profissional ainda não isola CPF em coleção privada.
- A gestão de usuários pelo UID precisa virar busca por e-mail com mecanismo privilegiado seguro.
- A autorização por escola deve passar por testes automatizados reais com perfis distintos, inclusive para Firestore queries de coleção.
- Relatórios avançados, frequência funcional, matrícula histórica, transferência, exportação, backup, política de retenção e exclusão controlada ainda não foram implementados.
- A UI não implementa todos os critérios da especificação. Há necessidade de revisão de acessibilidade e validação com a equipe da Educação.

**Portanto: esta entrega é um MVP de desenvolvimento e não deve ser liberada para uso com dados pessoais de alunos.**
