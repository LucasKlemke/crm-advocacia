import { Module } from "@nestjs/common";
import { StatusController } from "./status.controller";
import { TiposStatusController } from "./tipos-status.controller";
import { STATUS_SERVICE, TIPO_STATUS_SERVICE } from "./tokens";
import { statusService } from "@dominio/services/status.service";
import { tipoStatusService } from "@dominio/services/tipo-status.service";

@Module({
  controllers: [StatusController, TiposStatusController],
  providers: [
    { provide: STATUS_SERVICE, useValue: statusService },
    { provide: TIPO_STATUS_SERVICE, useValue: tipoStatusService },
  ],
})
export class StatusModule {}
