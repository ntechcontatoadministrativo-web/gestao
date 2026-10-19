import { CheckCircle2, ExternalLink, HardDrive } from "lucide-react";
import { exigirGestor } from "@/lib/auth";
import { db } from "@/lib/db";
import * as google from "@/lib/storage/google";
import { Aviso, Badge, Cabecalho } from "@/components/ui";
import { BotaoDesconectar, FormPastaRaiz, ListaModelos } from "./cliente";

export const metadata = { title: "Configurações" };

const MENSAGENS: Record<string, { tom: "ok" | "erro" | "alerta"; texto: string }> = {
  conectado: { tom: "ok", texto: "Google Drive conectado com sucesso." },
  cancelado: { tom: "alerta", texto: "A conexão com o Google foi cancelada." },
  erro: { tom: "erro", texto: "Não foi possível concluir a conexão com o Google. Tente novamente." },
  "estado-invalido": { tom: "erro", texto: "A sessão de conexão expirou. Tente novamente." },
  "sem-credenciais": { tom: "alerta", texto: "Defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET nas variáveis de ambiente do servidor." },
};

export default async function Configuracoes({ searchParams }: { searchParams: { google?: string } }) {
  await exigirGestor();
  const [modelos, conectado, conta, raiz] = await Promise.all([
    db.modeloEtapa.findMany({ orderBy: { ordem: "asc" } }),
    google.driveConectado(),
    google.lerConfig(google.CFG_CONTA),
    google.lerConfig(google.CFG_PASTA_RAIZ),
  ]);
  const msg = searchParams.google ? MENSAGENS[searchParams.google] : null;
  const appUrl = process.env.APP_URL?.replace(/\/$/, "") ?? "";

  return (
    <>
      <Cabecalho eyebrow="Configurações" titulo="Configurações" descricao="Integração com o Google Drive e modelos de etapas." />
      {msg && (
        <div className="mb-6">
          <Aviso tom={msg.tom}>{msg.texto}</Aviso>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neon/10 text-neon">
                <HardDrive className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-semibold text-white">Google Drive do escritório</h2>
                <p className="text-xs text-ink-400">Os arquivos ficam na conta da empresa; a equipe acessa só pelo sistema.</p>
              </div>
            </div>
            {conectado ? <Badge tom="verde">Conectado</Badge> : <Badge tom="amarelo">Modo local</Badge>}
          </div>

          {conectado ? (
            <div className="mt-5 space-y-4">
              <div className="flex items-center gap-2 text-sm text-ink-200">
                <CheckCircle2 className="h-4 w-4 text-neon" /> Conta: <span className="font-semibold">{conta || "—"}</span>
              </div>
              {raiz && (
                <a href={`https://drive.google.com/drive/folders/${raiz}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-ink-300 hover:text-neon">
                  <ExternalLink className="h-4 w-4" /> Abrir pasta principal no Drive
                </a>
              )}
              <FormPastaRaiz />
              <div className="rounded-xl border border-ink-700 bg-ink-900 p-4 text-xs text-ink-400">
                <div className="mb-1 font-semibold text-ink-200">Para o controle de acesso funcionar de verdade</div>
                Remova o compartilhamento direto das pastas de projeto com os funcionários no Google Drive. Assim o sistema passa a ser o único caminho até os
                arquivos, e todo acesso fica registrado.
              </div>
              <BotaoDesconectar />
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              <p className="text-sm text-ink-300">
                Sem o Drive conectado, os arquivos são guardados no próprio servidor (bom para testar). Para produção, conecte a conta do escritório:
              </p>
              {google.googleConfigurado() ? (
                <a href="/api/google/conectar" className="btn-primario">
                  Conectar Google Drive
                </a>
              ) : (
                <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink-300">
                  <li>
                    No{" "}
                    <a className="text-neon hover:underline" href="https://console.cloud.google.com/apis/library/drive.googleapis.com" target="_blank" rel="noreferrer">
                      Google Cloud Console
                    </a>
                    , ative a <b>Google Drive API</b>.
                  </li>
                  <li>
                    Crie um <b>ID do cliente OAuth</b> do tipo &quot;Aplicativo da Web&quot;.
                  </li>
                  <li>
                    URI de redirecionamento: <code className="rounded bg-ink-800 px-1.5 py-0.5 text-xs text-ink-100">{appUrl || "{APP_URL}"}/api/google/callback</code>
                  </li>
                  <li>
                    Coloque <code className="text-xs">GOOGLE_CLIENT_ID</code> e <code className="text-xs">GOOGLE_CLIENT_SECRET</code> nas variáveis do servidor e reinicie.
                  </li>
                </ol>
              )}
            </div>
          )}
        </section>

        <section className="card p-6">
          <h2 className="font-semibold text-white">Modelos de etapas padrão</h2>
          <p className="mb-4 mt-1 text-xs text-ink-400">Usados ao criar um projeto. Os dias definem os prazos sugeridos em sequência.</p>
          <ListaModelos modelos={modelos} />
        </section>
      </div>
    </>
  );
}
