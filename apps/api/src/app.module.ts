import { Module } from "@nestjs/common";
import { SaudeController } from "./saude/saude.controller";
import { TenantModule } from "./comum/tenant/tenant.module";
import { StatusModule } from "./status/status.module";
import { TiposProcessoModule } from "./tipos-processo/tipos-processo.module";
import { ClientesModule } from "./clientes/clientes.module";
import { CasosModule } from "./casos/casos.module";
import { ComentariosModule } from "./comentarios/comentarios.module";
import { PerfilModule } from "./perfil/perfil.module";
import { EscritoriosModule } from "./escritorios/escritorios.module";
import { MembrosModule } from "./membros/membros.module";

@Module({
  imports: [
    TenantModule,
    StatusModule,
    TiposProcessoModule,
    ClientesModule,
    CasosModule,
    ComentariosModule,
    PerfilModule,
    EscritoriosModule,
    MembrosModule,
  ],
  controllers: [SaudeController],
})
export class AppModule {}
