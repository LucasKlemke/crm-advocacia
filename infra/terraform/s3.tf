# Bucket privado de documentos/avatares. A API gera URLs assinadas com a credencial da task role,
# e o navegador faz PUT/GET direto no S3 — por isso o CORS libera só as origens da SPA.
resource "aws_s3_bucket" "documentos" {
  bucket = "${var.prefixo}-documentos-${data.aws_caller_identity.atual.account_id}"

  # Ambiente de disciplina: `terraform destroy` apaga o bucket com os arquivos. Ver README.md.
  force_destroy = true
}

resource "aws_s3_bucket_ownership_controls" "documentos" {
  bucket = aws_s3_bucket.documentos.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_public_access_block" "documentos" {
  bucket = aws_s3_bucket.documentos.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "documentos" {
  bucket = aws_s3_bucket.documentos.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_cors_configuration" "documentos" {
  bucket = aws_s3_bucket.documentos.id

  cors_rule {
    allowed_methods = ["PUT", "GET", "HEAD"]
    allowed_origins = var.web_origins
    allowed_headers = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}
