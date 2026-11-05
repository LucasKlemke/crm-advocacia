import { Module } from "@nestjs/common";
import { ConvitesController } from "./convites.controller";
import { CONVITE_SERVICE } from "./tokens";
import { conviteService } from "@dominio/services/convite.service";

@Module({
  controllers: [ConvitesController],
  providers: [{ provide: CONVITE_SERVICE, useValue: conviteService }],
})
export class ConvitesModule {}
