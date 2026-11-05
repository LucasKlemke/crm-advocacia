import { Module } from "@nestjs/common";
import { MembrosController } from "./membros.controller";
import { MEMBRO_SERVICE } from "./tokens";
import { membroService } from "@/services/membro.service";

@Module({
  controllers: [MembrosController],
  providers: [{ provide: MEMBRO_SERVICE, useValue: membroService }],
})
export class MembrosModule {}
