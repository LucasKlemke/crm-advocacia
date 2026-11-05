import { Module } from "@nestjs/common";
import { SaudeController } from "./saude/saude.controller";
import { TenantModule } from "./comum/tenant/tenant.module";
import { StatusModule } from "./status/status.module";

@Module({
  imports: [TenantModule, StatusModule],
  controllers: [SaudeController],
})
export class AppModule {}
