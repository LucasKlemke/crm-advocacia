data "aws_iam_policy_document" "confianca_ecs_tasks" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }

    # Proteção contra confused deputy: só tasks desta conta.
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.atual.account_id]
    }
  }
}

# ---------------------------------------------------------------------------
# Execution role: usada pelo agente do ECS para puxar a imagem, escrever logs e ler o secret.
# ---------------------------------------------------------------------------

resource "aws_iam_role" "execucao" {
  name               = "${var.prefixo}-ecs-execucao"
  assume_role_policy = data.aws_iam_policy_document.confianca_ecs_tasks.json
}

resource "aws_iam_role_policy_attachment" "execucao_ecs" {
  role       = aws_iam_role.execucao.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "execucao_segredo" {
  statement {
    sid       = "LerSegredoDaApi"
    effect    = "Allow"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.api.arn]
  }
}

resource "aws_iam_role_policy" "execucao_segredo" {
  name   = "ler-segredo-api"
  role   = aws_iam_role.execucao.id
  policy = data.aws_iam_policy_document.execucao_segredo.json
}

# ---------------------------------------------------------------------------
# Task role: credencial da própria API (SDK, cadeia padrão) — só o prefixo de documentos do bucket.
# ---------------------------------------------------------------------------

resource "aws_iam_role" "task" {
  name               = "${var.prefixo}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.confianca_ecs_tasks.json
}

data "aws_iam_policy_document" "task_s3" {
  statement {
    sid       = "ObjetosDoPrefixo"
    effect    = "Allow"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.documentos.arn}/${local.s3_prefixo}/*"]
  }

  statement {
    sid       = "ListarPrefixo"
    effect    = "Allow"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.documentos.arn]

    condition {
      test     = "StringLike"
      variable = "s3:prefix"
      values   = ["${local.s3_prefixo}/*"]
    }
  }
}

resource "aws_iam_role_policy" "task_s3" {
  name   = "s3-documentos"
  role   = aws_iam_role.task.id
  policy = data.aws_iam_policy_document.task_s3.json
}
