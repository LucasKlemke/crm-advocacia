import { Module } from "@nestjs/common";
import { SaudeController } from "./saude/saude.controller";

@Module({
  controllers: [SaudeController],
})
export class AppModule {}
