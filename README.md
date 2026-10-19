# NTECH · Gestão de Projetos

Sistema web para organizar projetos elétricos, equipe e arquivos do Google Drive, com controle de acesso.
Implementa as **Fases 1, 2 e 3** da proposta comercial, mais tarefas com aviso por WhatsApp e um assistente de IA.

| Módulo | O que tem |
| --- | --- |
| **Acessos** | Login individual, perfis Gestor / Colaborador, ativar e desativar (a sessão cai na hora), troca de senha, bloqueio após 5 tentativas erradas |
| **Projetos e etapas** | Cadastro de projetos, etapas com responsável, prazo e status, modelos de etapas padrão (levantamento, anteprojeto, executivo, compatibilização, revisão, entrega) com prazos sugeridos |
| **Acompanhamento** | Painel do gestor (progresso por projeto e por funcionário, alertas de atraso, aprovações pendentes, acessos recentes), comentários e histórico por etapa, fluxo *Pendente → Em andamento → Aguardando aprovação → Concluída* com aprovação ou devolução pelo gestor |
| **Arquivos (Google Drive)** | Pasta do Drive por projeto e por etapa (criadas automaticamente ou vinculadas a pastas existentes, com importação), upload direto para o Drive sem limite de tamanho, download pelo sistema, visualização de PDFs e imagens no navegador com marca d'água, revisões R00, R01… |
| **Controle de acesso** | Liberar (só visualizar / visualizar e baixar) ou bloquear por pessoa, regra padrão por equipe, bloqueio geral, registro de quem abriu, baixou ou teve o acesso negado, indicador de online, tela de auditoria com filtros e exportação em CSV |

| **Tarefas + WhatsApp** | O gestor designa tarefas avulsas (com prioridade, prazo, projeto/etapa) e gera a mensagem pronta para o WhatsApp do funcionário (link `wa.me`, texto editável). Também há aviso de etapa designada. O funcionário acompanha e conclui as tarefas dele. |
| **Levantamento com IA** (Fase 2) | O gestor envia memorial, plantas (PDF) e fotos; o Claude (`claude-opus-5-5`) lê tudo e devolve resumo, dados técnicos identificados, escopo, entregáveis, etapas com prazos calibrados pelo histórico real do escritório, riscos, perguntas para o cliente e documentos faltantes. Um clique cria o projeto com as etapas. |
| **Integração com Dynamo** (Fase 2) | Script Python (`public/dynamo/enviar_ntech.py`) que lê do Revit os quadros, circuitos e quantitativos e envia para o projeto. O sistema mostra o quadro de cargas, a potência por fase e o desequilíbrio. |

| **Assistente IA** | Chat em todas as telas (botão "Perguntar à IA"). Responde com os dados reais do sistema: "o que o Yuri fez hoje?", "o que está atrasado?", "quantas horas a equipe apontou essa semana?", "como está o P2026-014?". Colaboradores só consultam os próprios dados. |
| **Horas** (Fase 3) | Apontamento por projeto, etapa ou tarefa (`1:30`, `2h`, `1,5`), totais por dia, projeto e pessoa. |
| **Relatórios** (Fase 3) | Produtividade por pessoa e por projeto no período: horas, etapas e tarefas concluídas, % no prazo, atrasos e arquivos enviados. Exporta CSV. |
| **Área do cliente** (Fase 3) | Link público por projeto (sem login) com andamento, etapas, prazos e só os arquivos marcados "visível para o cliente". Acessos do cliente ficam na auditoria. |
| **WhatsApp automático** (Fase 3) | Com a Z-API configurada, os avisos são enviados pelo próprio sistema (botão "Enviar pelo sistema" e envio automático ao criar tarefa). Histórico em Configurações. |

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

## Ativar a IA

1. Crie uma chave em [console.anthropic.com](https://console.anthropic.com) (API keys).
2. Adicione `ANTHROPIC_API_KEY` nas variáveis do servidor (Render → Environment) e faça o deploy de novo.

A análise usa structured outputs (o JSON sempre segue o schema) e o *fallback* do servidor (`fallbacks: "default"`), que tenta outro modelo se a resposta for recusada.
O custo é por uso e depende do volume de documentos. Limite por envio: 22 MB e 20 arquivos; DWG/RVT precisam ser exportados para PDF.

## WhatsApp automático (Z-API)

Crie uma instância em [z-api.io](https://z-api.io), conecte o WhatsApp do escritório pelo QR Code e defina
`ZAPI_INSTANCE_ID`, `ZAPI_TOKEN` e (se a conta exigir) `ZAPI_CLIENT_TOKEN` no servidor. Sem elas, o sistema usa links `wa.me`.

## Dynamo

Em **Configurações → Integração com Dynamo**, gere o token e baixe o script. No Dynamo (Revit 2022+, CPython3), cole o script num nó
*Python Script* com 4 entradas: URL, token, código do projeto e `Enviar` (False mostra só a prévia).

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

## Status das fases

- **Fase 1 · MVP:** concluída.
- **Fase 2 · IA e Dynamo:** concluída.
- **Fase 3 · Extras:** concluída (horas, relatórios, WhatsApp automático, área do cliente).
