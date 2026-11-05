import { Module } from "@nestjs/common";
import { SaudeController } from "./saude/saude.controller";
import { TenantModule } from "./comum/tenant/tenant.module";

@Module({
  imports: [TenantModule],
  controllers: [SaudeController],
})
export class AppModule {}
