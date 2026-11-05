import { Module } from "@nestjs/common";
import { UazapiWebhookController } from "./uazapi-webhook.controller";

@Module({
  controllers: [UazapiWebhookController],
})
export class WebhooksModule {}
