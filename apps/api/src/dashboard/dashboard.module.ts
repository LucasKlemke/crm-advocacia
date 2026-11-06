import { Module } from "@nestjs/common";
import { DashboardController } from "./dashboard.controller";
import { DASHBOARD_SERVICE } from "./tokens";
import { dashboardService } from "@dominio/services/dashboard.service";

@Module({
  controllers: [DashboardController],
  providers: [{ provide: DASHBOARD_SERVICE, useValue: dashboardService }],
})
export class DashboardModule {}
