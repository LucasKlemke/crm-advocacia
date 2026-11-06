# Valores gerados pelo Terraform. Só alfanuméricos: entram em URL (DATABASE_URL) e em header HTTP.

resource "random_password" "db" {
  length  = 32
  special = false
}

resource "random_password" "auth_secret" {
  length  = 48
  special = false
}

resource "random_password" "uazapi_webhook_secret" {
  length  = 32
  special = false
}

# Valor do header X-Origem-CloudFront: o ALB só encaminha requests que o trazem (ver alb.tf).
resource "random_password" "origem_cloudfront" {
  length  = 32
  special = false
}

locals {
  # O RDS Postgres 16 exige TLS por padrão (rds.force_ssl = 1).
  database_url = format(
    "postgresql://%s:%s@%s:%d/%s?sslmode=require",
    local.db_usuario,
    random_password.db.result,
    aws_db_instance.principal.address,
    aws_db_instance.principal.port,
    local.db_nome,
  )
}

resource "aws_secretsmanager_secret" "api" {
  name        = "${var.prefixo}/api"
  description = "Segredos da API do CRM (ambiente pac), injetados na task do ECS."

  # Ambiente de disciplina: apaga na hora no destroy, para um novo apply poder recriar o mesmo nome.
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "api" {
  secret_id = aws_secretsmanager_secret.api.id

  secret_string = jsonencode({
    AUTH_SECRET           = random_password.auth_secret.result
    DATABASE_URL          = local.database_url
    DIRECT_URL            = local.database_url
    UAZAPI_WEBHOOK_SECRET = random_password.uazapi_webhook_secret.result
    UAZAPI_ADMIN_TOKEN    = var.uazapi_admin_token
    # Vazio = sem New Relic (a API trata string vazia como "agente desligado").
    NEW_RELIC_LICENSE_KEY = var.new_relic_license_key
  })
}
