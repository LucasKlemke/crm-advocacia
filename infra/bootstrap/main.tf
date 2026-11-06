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

data "aws_iam_policy_document" "confianca_github" {
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

    # Só a branch main (deploy/apply) e pull requests (plan) deste repositório.
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values = [
        "repo:${var.repositorio_github}:ref:refs/heads/main",
        "repo:${var.repositorio_github}:pull_request",
      ]
    }
  }
}

resource "aws_iam_role" "deploy" {
  name                 = "${var.prefixo}-github-deploy"
  description          = "Assumida pelo GitHub Actions via OIDC para terraform plan/apply e push no ECR."
  assume_role_policy   = data.aws_iam_policy_document.confianca_github.json
  max_session_duration = 7200 # deploy-aws.yml pede sessão de 2 h (primeiro deploy é longo)
}

# Simplificação consciente para conta pessoal de disciplina (ver README.md):
# a trust policy restringe QUEM assume a role; a permissão em si é ampla.
resource "aws_iam_role_policy_attachment" "deploy_admin" {
  role       = aws_iam_role.deploy.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}
