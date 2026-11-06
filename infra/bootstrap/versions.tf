terraform {
  required_version = ">= 1.11"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  # Estado LOCAL de propósito: este diretório cria o próprio bucket do estado remoto.
  # O terraform.tfstate gerado aqui não é versionado — guarde-o (ver README.md).
}
