output "api_url" {
  description = "URL pública da API (CloudFront). API_ORIGIN da Vercel; VITE_WS_URL = mesma URL com wss://."
  value       = local.api_public_url
}

output "ecr_repository_url" {
  description = "Repositório ECR da imagem da API."
  value       = aws_ecr_repository.api.repository_url
}

output "ecs_cluster" {
  description = "Nome do cluster ECS."
  value       = aws_ecs_cluster.principal.name
}

output "ecs_service" {
  description = "Nome do serviço ECS da API."
  value       = aws_ecs_service.api.name
}

output "task_definition_family" {
  description = "Família da task definition da API (run-task de migration usa a revisão mais recente)."
  value       = aws_ecs_task_definition.api.family
}

output "subnets_publicas" {
  description = "Subnets públicas (network configuration do run-task de migration)."
  value       = aws_subnet.publica[*].id
}

output "sg_task" {
  description = "Security group da task da API (run-task de migration)."
  value       = aws_security_group.task.id
}

output "log_group" {
  description = "Log group do CloudWatch da API."
  value       = aws_cloudwatch_log_group.api.name
}
