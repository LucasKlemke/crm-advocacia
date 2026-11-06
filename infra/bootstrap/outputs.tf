output "bucket_estado" {
  description = "Nome do bucket S3 do estado remoto (vai no backend.hcl e na variável TF_STATE_BUCKET do GitHub)."
  value       = aws_s3_bucket.estado.bucket
}

output "role_deploy_arn" {
  description = "ARN da role de deploy (só refs/heads/main; variável AWS_DEPLOY_ROLE_ARN do GitHub)."
  value       = aws_iam_role.deploy.arn
}

output "role_plan_arn" {
  description = "ARN da role somente leitura do terraform plan em PRs (variável AWS_PLAN_ROLE_ARN do GitHub)."
  value       = aws_iam_role.plan.arn
}
