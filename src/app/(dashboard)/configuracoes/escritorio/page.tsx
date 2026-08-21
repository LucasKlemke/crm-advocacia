import type { Metadata } from "next";
import { getTenantContextOuRedirect } from "../../_lib/tenant-context-pagina";
import { escritorioService } from "@/services/escritorio.service";
import { EscritorioForm } from "@/components/configuracoes/escritorio-form";
import { PageContainer } from "@/components/shared/page-container";

export const metadata: Metadata = {
  title: "Escritório",
};

export default async function ConfiguracoesEscritorioPage() {
  const ctx = await getTenantContextOuRedirect();

  const escritorio = await escritorioService.obterEscritorioAtivo(ctx);

  return (
    <PageContainer className="gap-6">
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
    </PageContainer>
  );
}
