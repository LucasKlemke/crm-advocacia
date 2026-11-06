provider "aws" {
  region = var.regiao

  default_tags {
    tags = {
      Projeto       = "crm-advocacia"
      Ambiente      = "pac"
      GerenciadoPor = "terraform"
    }
  }
}

data "aws_caller_identity" "atual" {}

# ---------------------------------------------------------------------------
# Bucket do estado remoto do ambiente pac (infra/terraform)
# ---------------------------------------------------------------------------

resource "aws_s3_bucket" "estado" {
  bucket = "${var.prefixo}-tfstate-${data.aws_caller_identity.atual.account_id}"

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "estado" {
  bucket = aws_s3_bucket.estado.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "estado" {
  bucket = aws_s3_bucket.estado.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "estado" {
  bucket = aws_s3_bucket.estado.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ---------------------------------------------------------------------------
# OIDC do GitHub Actions + role de deploy
# ---------------------------------------------------------------------------

resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

# Uma trust policy por role: cada uma aceita um único `sub` deste repositório.
locals {
  sub_github = {
    deploy = "repo:${var.repositorio_github}:ref:refs/heads/main"
    plan   = "repo:${var.repositorio_github}:pull_request"
  }
}

data "aws_iam_policy_document" "confianca_github" {
  for_each = local.sub_github

  statement {
    sid     = "GitHubActionsOIDC"
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = [each.value]
    }
  }
}

# Deploy (deploy-aws.yml): só a branch main assume; aplica o terraform e publica no ECR.
resource "aws_iam_role" "deploy" {
  name                 = "${var.prefixo}-github-deploy"
  description          = "Assumida pelo GitHub Actions (só refs/heads/main) via OIDC para terraform apply e push no ECR."
  assume_role_policy   = data.aws_iam_policy_document.confianca_github["deploy"].json
  max_session_duration = 7200 # deploy-aws.yml pede sessão de 2 h (primeiro deploy é longo)
}

# Simplificação consciente para conta pessoal de disciplina (ver README.md):
# a trust policy restringe QUEM assume a role; a permissão em si é ampla.
resource "aws_iam_role_policy_attachment" "deploy_admin" {
  role       = aws_iam_role.deploy.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}

# Plan (infra-plan.yml): qualquer PR deste repositório assume, então só lê. Um PR malicioso
# que altere o workflow não consegue escrever nada na conta com esta role.
resource "aws_iam_role" "plan" {
  name                 = "${var.prefixo}-github-plan"
  description          = "Assumida pelo GitHub Actions (só pull_request) via OIDC para terraform plan, somente leitura."
  assume_role_policy   = data.aws_iam_policy_document.confianca_github["plan"].json
  max_session_duration = 3600
}

resource "aws_iam_role_policy_attachment" "plan_leitura" {
  role       = aws_iam_role.plan.name
  policy_arn = "arn:aws:iam::aws:policy/ReadOnlyAccess"
}

# O que o plan precisa além do ReadOnlyAccess:
# - estado remoto: o infra-plan.yml roda `plan -lock=false`, então só lê (sem PutObject do .tflock);
# - refresh do aws_secretsmanager_secret_version lê o valor do secret (GetSecretValue não faz parte
#   do ReadOnlyAccess). Os demais recursos do infra/terraform são lidos com Describe/Get/List.
data "aws_iam_policy_document" "plan_extra" {
  statement {
    sid       = "ListarEstado"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.estado.arn]
  }

  statement {
    sid       = "LerEstado"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.estado.arn}/*"]
  }

  statement {
    sid       = "LerSegredosDoAmbiente"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = ["arn:aws:secretsmanager:*:${data.aws_caller_identity.atual.account_id}:secret:${var.prefixo}/*"]
  }
}

resource "aws_iam_role_policy" "plan_extra" {
  name   = "estado-e-segredos"
  role   = aws_iam_role.plan.id
  policy = data.aws_iam_policy_document.plan_extra.json
}
