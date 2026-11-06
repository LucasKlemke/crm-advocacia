locals {
  api_public_url = "https://${aws_cloudfront_distribution.api.domain_name}"

  # Chaves do secret JSON `crm-pac/api` injetadas como variáveis de ambiente.
  # NEW_RELIC_LICENSE_KEY só entra quando informada: sem licença, a variável fica ausente
  # (a instrumentação já trata ausência como "sem New Relic") e evitamos injetar valor vazio.
  chaves_segredo = concat(
    ["AUTH_SECRET", "DATABASE_URL", "DIRECT_URL", "UAZAPI_WEBHOOK_SECRET", "UAZAPI_ADMIN_TOKEN"],
    nonsensitive(var.new_relic_license_key != "") ? ["NEW_RELIC_LICENSE_KEY"] : [],
  )

  ambiente_api = {
    NODE_ENV              = "production"
    PORT                  = tostring(local.porta_api)
    AWS_REGION            = var.regiao
    AWS_S3_BUCKET         = aws_s3_bucket.documentos.bucket
    AWS_S3_PREFIX         = local.s3_prefixo
    UAZAPI_SERVER_URL     = var.uazapi_server_url
    NEW_RELIC_APP_NAME    = var.new_relic_app_name
    API_PUBLIC_URL        = local.api_public_url
    WEB_ORIGINS           = join(",", var.web_origins)
    TEMPO_REAL_HABILITADO = "true"
  }
}

resource "aws_ecs_cluster" "principal" {
  name = var.prefixo

  setting {
    name  = "containerInsights"
    value = "disabled"
  }
}

# O comando é o CMD da imagem (não sobrescrito aqui). As migrations rodam antes do deploy num
# `aws ecs run-task` com esta mesma revisão e `command` = prisma migrate deploy (deploy-aws.yml).
resource "aws_ecs_task_definition" "api" {
  family                   = local.nome_api
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = tostring(var.task_cpu)
  memory                   = tostring(var.task_memory)
  execution_role_arn       = aws_iam_role.execucao.arn
  task_role_arn            = aws_iam_role.task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }

  container_definitions = jsonencode([
    {
      name      = "api"
      image     = "${aws_ecr_repository.api.repository_url}:${var.image_tag}"
      essential = true

      portMappings = [
        {
          containerPort = local.porta_api
          protocol      = "tcp"
        }
      ]

      environment = [
        for nome in sort(keys(local.ambiente_api)) : { name = nome, value = local.ambiente_api[nome] }
      ]

      secrets = [
        for chave in local.chaves_segredo : {
          name      = chave
          valueFrom = "${aws_secretsmanager_secret.api.arn}:${chave}::"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.api.name
          awslogs-region        = var.regiao
          awslogs-stream-prefix = "api"
        }
      }
    }
  ])

  # A versão do secret precisa existir antes de qualquer task tentar lê-la.
  depends_on = [aws_secretsmanager_secret_version.api]
}

resource "aws_ecs_service" "api" {
  name            = local.nome_api
  cluster         = aws_ecs_cluster.principal.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  enable_execute_command            = false
  health_check_grace_period_seconds = 60
  propagate_tags                    = "SERVICE"

  network_configuration {
    subnets          = aws_subnet.publica[*].id
    security_groups  = [aws_security_group.task.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = local.porta_api
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  # O target group só é utilizável depois de associado a um listener.
  depends_on = [aws_lb_listener_rule.origem_cloudfront]
}
