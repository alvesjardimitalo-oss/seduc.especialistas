# Operação do SEDUC Especialistas

## Desenvolvimento e publicação

Node.js 22 ou 24:

```sh
npm ci
npm --prefix functions ci
npm run dev
```

A demonstração roda apenas em `127.0.0.1`, com aviso de dados fictícios. A persistência fica em `.local/demo.json`, ignorada pelo Git. Não insira informações reais nessa demonstração. O servidor local não faz parte da publicação Firebase.

```sh
npm test
npm run build
npx -y firebase-tools@latest login
npx -y firebase-tools@latest deploy --only hosting,firestore --project seduc-especialistas
```

O frontend obtém a configuração pública Firebase em `/__/firebase/init.json`. O provedor Google deve estar habilitado. Nenhuma chave privada de serviço está no código. O primeiro usuário nunca é promovido automaticamente; o administrador inicial é configurado em operação administrativa autenticada.

Testes das regras com Java 21 ou superior:

```sh
npx firebase emulators:exec --only firestore --project demo-seduc "node tests/firestore.integration.mjs"
```

`functions/` também contém uma API opcional para implantação futura com backend dedicado. Ela não está configurada para publicação no plano gratuito. `domain.mjs` compartilha a validação da interface e dos testes.

## Leituras

- Páginas de **40 registros**, com cursor. Páginas seguintes exigem ação do usuário.
- Cache de dois minutos em memória. Trocar de tela reutiliza consultas; salvar invalida somente os conjuntos relacionados.
- Escola, período, situação e profissional da agenda filtram a consulta no Firestore. A busca textual e a especialidade filtram os registros carregados; a interface avisa quando há outras páginas.
- Dashboard com agregações de contagem, sem baixar todos os alunos e atendimentos. As consultas de contagem têm teto de 10.000 entradas e precisam de revisão se a rede crescer.
- Apenas os oito próximos compromissos são buscados no painel. Nomes relacionados são resolvidos sob demanda e reutilizados em memória.
- Uma única escuta em tempo real, no documento de autorização do usuário. Não há listeners de coleções nem atualização periódica automática.
- Dados privados são buscados ao abrir a edição, conforme a permissão. Direção, secretaria e visualizador não carregam observações clínicas.
- Relatórios usam o conjunto carregado. A exportação é bloqueada quando ainda existem páginas pendentes, evitando apresentar um resultado parcial como completo.

Quatro usuários representam uma carga pequena para esse desenho. Não há garantia absoluta de permanência na cota: consultas manuais, regras de segurança, agregações, testes e outros clientes do projeto também consomem recursos. Acompanhe **Firestore → Uso** no console. O aplicativo não faz consultas periódicas ao painel de consumo.

## Permissões e limites

Consultas de 15 a 60 minutos, em incrementos de 15 minutos. Jornadas em intervalos de 15 minutos. Fuso municipal America/Sao_Paulo (UTC−03:00); uma mudança oficial de fuso exige revisão das validações temporais.

Afastamentos são inseridos em períodos de até 31 dias e preservados como registros administrativos. Reagendar exige justificar cancelamento/remarcação e criar nova consulta. Arquivar aluno preserva o histórico; transferências exigem superadministrador.

As escolas autorizadas no perfil são uma concessão administrativa explícita. Revise esse escopo ao encerrar ou mudar um vínculo: o acesso de leitura é definido por ele, enquanto a agenda exige vínculo e jornada vigentes.

Os índices precisam terminar de construir antes das consultas compostas. Os registros antigos permanecem preservados no banco, protegidos e separados das coleções da nova aplicação. O Git não contém cópia do banco nem informações pessoais reais.

Backups agendados, retenção/descarte, notificações por e-mail e alertas externos de cota não são serviços ativados pela aplicação. Defina os procedimentos institucionais antes de ampliar o acesso.

I've set up prototype Security Rules to keep the data in Firestore safe. They are designed to be secure for approved users with school-scoped access, separate private contact records, atomic scheduling and immutable audit records. However, you should review and verify them before broadly sharing your app. If you'd like, I can help you harden these rules.
