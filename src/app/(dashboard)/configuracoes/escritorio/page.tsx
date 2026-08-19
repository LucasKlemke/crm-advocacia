import { redirect } from "next/navigation";
import { getTenantContext, NaoAutenticadoError, SemEscritorioAtivoError } from "@/lib/auth/tenant-context";
import { escritorioService } from "@/services/escritorio.service";
import { EscritorioForm } from "@/components/configuracoes/escritorio-form";

export default async function ConfiguracoesEscritorioPage() {
  let ctx;
  try {
    ctx = await getTenantContext();
  } catch (error) {
    if (error instanceof NaoAutenticadoError) redirect("/login");
    if (error instanceof SemEscritorioAtivoError) redirect("/onboarding");
    throw error;
  }

  const escritorio = await escritorioService.obterEscritorioAtivo(ctx);

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Dados do escritório</h1>
        <p className="text-sm text-muted-foreground">
          {ctx.role === "padrao"
            ? "Somente owners e admins podem editar estes dados."
            : "Essas informações aparecem nas mensagens e documentos do escritório."}
        </p>
      </div>
      <EscritorioForm
        escritorio={{
          nome: escritorio.nome,
          oabResponsavel: escritorio.oabResponsavel,
          telefoneWhatsapp: escritorio.telefoneWhatsapp,
        }}
        somenteLeitura={ctx.role === "padrao"}
      />
    </div>
  );
}
