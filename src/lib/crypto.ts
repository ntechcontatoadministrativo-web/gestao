import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

function chave(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("ENCRYPTION_KEY ausente ou inválida (precisa de 64 caracteres hex).");
  }
  return Buffer.from(hex, "hex");
}

// AES-256-GCM. Formato: iv.tag.dados (base64url)
export function criptografar(texto: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", chave(), iv);
  const dados = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, dados].map((b) => b.toString("base64url")).join(".");
}

export function descriptografar(valor: string): string {
  const [iv, tag, dados] = valor.split(".").map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", chave(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(dados), decipher.final()]).toString("utf8");
}
