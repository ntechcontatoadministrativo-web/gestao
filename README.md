# NTECH · Gestão de Projetos

Sistema web para organizar projetos elétricos, equipe e arquivos do Google Drive, com controle de acesso.
Implementa a **Fase 1 (MVP)** da proposta comercial.

| Módulo | O que tem |
| --- | --- |
| **Acessos** | Login individual, perfis Gestor / Colaborador, ativar e desativar (a sessão cai na hora), troca de senha, bloqueio após 5 tentativas erradas |
| **Projetos e etapas** | Cadastro de projetos, etapas com responsável, prazo e status, modelos de etapas padrão (levantamento, anteprojeto, executivo, compatibilização, revisão, entrega) com prazos sugeridos |
| **Acompanhamento** | Painel do gestor (progresso por projeto e por funcionário, alertas de atraso, aprovações pendentes, acessos recentes), comentários e histórico por etapa, fluxo *Pendente → Em andamento → Aguardando aprovação → Concluída* com aprovação ou devolução pelo gestor |
| **Arquivos (Google Drive)** | Pasta do Drive por projeto e por etapa (criadas automaticamente ou vinculadas a pastas existentes, com importação), upload direto para o Drive sem limite de tamanho, download pelo sistema, visualização de PDFs e imagens no navegador com marca d'água, revisões R00, R01… |
| **Controle de acesso** | Liberar (só visualizar / visualizar e baixar) ou bloquear por pessoa, regra padrão por equipe, bloqueio geral, registro de quem abriu, baixou ou teve o acesso negado, indicador de online, tela de auditoria com filtros e exportação em CSV |

## Como o controle de acesso funciona

O conteúdo dos arquivos só chega à equipe pela rota `/api/arquivos/[id]/conteudo`, que confere a permissão
**a cada requisição**. Por isso um bloqueio vale na hora, até para um PDF que já está aberto.

Ordem das regras: gestor tem acesso total → liberação individual (BLOQUEADO sempre vence) → regra da equipe
(o responsável pela etapa do arquivo, ou qualquer responsável do projeto se for um arquivo geral) → sem acesso.

> Para o controle valer de verdade, **tire o compartilhamento direto das pastas** com os funcionários no Google Drive.
> E, como diz a proposta: depois que alguém baixa um arquivo, ele fica no computador da pessoa. O sistema controla
> quem pode baixar e registra quem baixou.

## Rodar localmente

Requisitos: Node 20+ e um Postgres (por exemplo, um banco gratuito no [Neon](https://neon.tech)).

```bash
cp .env.example .env      # preencha DATABASE_URL, DIRECT_URL, SESSION_SECRET, ENCRYPTION_KEY e o ADMIN_*
npm install
npm run db:push           # cria as tabelas
npm run db:seed           # cria os modelos de etapa e o primeiro gestor
npm run dev               # http://localhost:3000
```

Gere os segredos com `openssl rand -hex 32` (ou `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).

Sem o Google configurado, os arquivos ficam na pasta `storage/` do servidor (modo demonstração).

## Conectar o Google Drive

1. No [Google Cloud Console](https://console.cloud.google.com), crie um projeto e ative a **Google Drive API**.
2. Em *Tela de consentimento OAuth*, use o tipo **Interno** se a conta for Google Workspace. Se for Gmail, use **Externo** e adicione o e-mail do escritório como usuário de teste.
3. Em *Credenciais → Criar credenciais → ID do cliente OAuth → Aplicativo da Web*, cadastre o URI de redirecionamento
   `{APP_URL}/api/google/callback`.
4. Coloque `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` nas variáveis de ambiente e reinicie o servidor.
5. Entre como gestor → **Configurações → Conectar Google Drive** e autorize com a conta **do escritório**.

O sistema cria a pasta `NTECH · Gestão de Projetos` (ou usa uma pasta que você indicar) e, dentro dela, uma pasta por projeto e uma por etapa.
O token do Google fica criptografado no banco (AES-256-GCM com `ENCRYPTION_KEY`).

## Deploy (Render + Neon)

- **Build:** `npm install && npm run build && npx prisma db push`
- **Start:** `npm start`
- Variáveis: as mesmas do `.env.example`, com `APP_URL` igual à URL pública (https, sem barra no final).
- Rode `npm run db:seed` uma vez (pelo Shell do Render) para criar o primeiro gestor.

Na Vercel também funciona: o upload vai direto do navegador para o Google Drive, sem passar pelo servidor. O modo local (`storage/`) **não** serve na Vercel, porque o disco não é persistente.

## Estrutura

```
prisma/schema.prisma        modelo de dados
src/lib/permissoes.ts       regras de acesso a arquivos
src/lib/storage/            Google Drive (REST/OAuth) e armazenamento local
src/actions/                server actions (projetos, etapas, equipe, arquivos, configurações)
src/app/api/arquivos/       upload em 2 etapas e entrega de conteúdo com auditoria
src/app/(app)/              telas: painel, projetos, etapas, arquivos, equipe, auditoria, configurações
```

## Próximas fases (proposta)

- **Fase 2:** agente de IA de levantamento (lê memoriais, plantas e fotos e sugere escopo, etapas e prazos) e integração com o Dynamo.
- **Fase 3:** relatórios de produtividade, apontamento de horas, notificações por WhatsApp e área do cliente final.
