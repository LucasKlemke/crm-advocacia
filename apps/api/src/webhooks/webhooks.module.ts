import { Module } from "@nestjs/common";
import { TempoRealModule } from "../tempo-real/tempo-real.module";
import { UazapiWebhookController } from "./uazapi-webhook.controller";

@Module({
  imports: [TempoRealModule],
  controllers: [UazapiWebhookController],
})
export class WebhooksModule {}
