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

locals {
  nome_api      = "${var.prefixo}-api"
  porta_api     = 3001
  caminho_saude = "/api/saude"
  s3_prefixo    = "documentos"
  db_nome       = "crm"
  db_usuario    = "crm_admin"
}
