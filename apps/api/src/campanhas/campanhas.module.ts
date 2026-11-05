import { Module } from "@nestjs/common";
import { CampanhasController } from "./campanhas.controller";
import { CAMPANHAS_SERVICE } from "./tokens";
import { campanhaService } from "@/services/campanha.service";

@Module({
  controllers: [CampanhasController],
  providers: [{ provide: CAMPANHAS_SERVICE, useValue: campanhaService }],
})
export class CampanhasModule {}
