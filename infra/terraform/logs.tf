resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${local.nome_api}"
  retention_in_days = 14
}
