import { Module } from "@nestjs/common";
import { SaudeController } from "./saude/saude.controller";
import { TenantModule } from "./comum/tenant/tenant.module";
import { StatusModule } from "./status/status.module";
import { TiposProcessoModule } from "./tipos-processo/tipos-processo.module";

@Module({
  imports: [TenantModule, StatusModule, TiposProcessoModule],
  controllers: [SaudeController],
})
export class AppModule {}
