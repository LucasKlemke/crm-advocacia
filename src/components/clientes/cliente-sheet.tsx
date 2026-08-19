"use client";

import { useState } from "react";
import { formatarCpf } from "@/lib/utils/cpf";
import { formatarTelefone } from "@/lib/utils/telefone";
import { formatarDataHora } from "@/lib/utils/data";
import { ClienteForm } from "@/components/clientes/cliente-form";
import { ComentariosPanel } from "@/components/clientes/comentarios-panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { RoleMembro } from "@prisma/client";
import type { ClienteDTO } from "@/types/cliente";

export type ModoSheet = "criar" | "ver";

export interface ClienteSheetProps {
  modo: ModoSheet;
  cliente: ClienteDTO | null;
  aberto: boolean;
  onOpenChange: (aberto: boolean) => void;
  atorUsuarioId: string;
  atorRole: RoleMembro;
}

function LinhaDado({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd className="text-sm text-foreground">{valor?.trim() ? valor : "—"}</dd>
    </div>
  );
}

// Um único drawer serve criação, visualização e edição: o mesmo formulário muda de
// papel conforme `cliente`, evitando duas telas divergentes para os mesmos campos.
export function ClienteSheet({
  modo,
  cliente,
  aberto,
  onOpenChange,
  atorUsuarioId,
  atorRole,
}: ClienteSheetProps) {
  const [editando, setEditando] = useState(false);

  function fechar(proximo: boolean) {
    if (!proximo) setEditando(false);
    onOpenChange(proximo);
  }

  const excluido = cliente?.softDeletedAt != null;

  return (
    <Sheet open={aberto} onOpenChange={fechar}>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {modo === "criar" ? "Novo cliente" : (cliente?.nome ?? "Cliente")}
            {excluido ? <Badge variant="outline">Excluído</Badge> : null}
          </SheetTitle>
          <SheetDescription>
            {modo === "criar"
              ? "Cadastre um cliente do escritório."
              : "Consulte os dados e o histórico de comentários."}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
          {modo === "criar" ? (
            <ClienteForm onSucesso={() => fechar(false)} onCancelar={() => fechar(false)} />
          ) : cliente ? (
            <Tabs defaultValue="dados">
              <TabsList className="mb-4">
                <TabsTrigger value="dados">Dados</TabsTrigger>
                <TabsTrigger value="comentarios">Comentários</TabsTrigger>
              </TabsList>

              <TabsContent value="dados">
                {editando ? (
                  <ClienteForm
                    cliente={cliente}
                    onSucesso={() => setEditando(false)}
                    onCancelar={() => setEditando(false)}
                  />
                ) : (
                  <div className="flex flex-col gap-6">
                    <dl className="grid grid-cols-2 gap-4">
                      <LinhaDado rotulo="Nome completo" valor={cliente.nome} />
                      <LinhaDado rotulo="CPF" valor={formatarCpf(cliente.cpf)} />
                      <LinhaDado
                        rotulo="Telefone"
                        valor={cliente.telefone ? formatarTelefone(cliente.telefone) : null}
                      />
                      <LinhaDado rotulo="E-mail" valor={cliente.email} />
                      <LinhaDado rotulo="Endereço" valor={cliente.endereco} />
                      <LinhaDado
                        rotulo="Cadastrado em"
                        valor={formatarDataHora(cliente.createdAt)}
                      />
                    </dl>
                    <div className="flex justify-end">
                      <Button onClick={() => setEditando(true)}>Editar dados</Button>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="comentarios">
                <ComentariosPanel
                  clienteId={cliente.id}
                  atorUsuarioId={atorUsuarioId}
                  atorRole={atorRole}
                />
              </TabsContent>
            </Tabs>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
