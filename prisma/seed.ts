import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

// Etapas padrão de um projeto elétrico (proposta NTECH). Ajustáveis em Configurações.
const MODELOS = [
  { nome: "Levantamento", diasPadrao: 5, descricao: "Visita técnica, levantamento de cargas, documentos do cliente e premissas do projeto." },
  { nome: "Anteprojeto", diasPadrao: 7, descricao: "Concepção: entrada de energia, distribuição, quadros principais e estimativa de carga." },
  { nome: "Projeto executivo", diasPadrao: 15, descricao: "Plantas, diagramas unifilares, quadros de carga, memorial descritivo e de cálculo." },
  { nome: "Compatibilização", diasPadrao: 5, descricao: "Compatibilização com arquitetura, estrutura e demais disciplinas." },
  { nome: "Revisão", diasPadrao: 3, descricao: "Revisão interna, correções e conferência de quantitativos." },
  { nome: "Entrega", diasPadrao: 2, descricao: "Emissão final (PDF/RVT/DWG), ART e envio ao cliente." },
];

async function main() {
  if ((await db.modeloEtapa.count()) === 0) {
    await db.modeloEtapa.createMany({ data: MODELOS.map((m, i) => ({ ...m, ordem: i + 1 })) });
    console.log(`✓ ${MODELOS.length} modelos de etapa criados`);
  }

  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const senha = process.env.ADMIN_SENHA ?? "";
  if (!email || senha.length < 8) {
    console.log("! Defina ADMIN_EMAIL e ADMIN_SENHA (mín. 8 caracteres) para criar o primeiro gestor.");
    return;
  }
  const existe = await db.usuario.findUnique({ where: { email } });
  if (existe) {
    console.log(`= Gestor ${email} já existe`);
    return;
  }
  await db.usuario.create({
    data: { nome: process.env.ADMIN_NOME || "Gestor", email, perfil: "GESTOR", cargo: "Gestor", senhaHash: await bcrypt.hash(senha, 10) },
  });
  console.log(`✓ Gestor criado: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
