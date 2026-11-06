output "bucket_estado" {
  description = "Nome do bucket S3 do estado remoto (vai no backend.hcl e na variável TF_STATE_BUCKET do GitHub)."
  value       = aws_s3_bucket.estado.bucket
}

output "role_deploy_arn" {
  description = "ARN da role assumida pelo GitHub Actions (variável AWS_DEPLOY_ROLE_ARN do GitHub)."
  value       = aws_iam_role.deploy.arn
}
