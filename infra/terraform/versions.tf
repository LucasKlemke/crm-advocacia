terraform {
  required_version = ">= 1.11"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.7"
    }
  }

  # bucket e region vêm de `terraform init -backend-config=backend.hcl` (ver backend.hcl.example);
  # o bucket é o output `bucket_estado` do infra/bootstrap. Lock nativo no S3, sem DynamoDB.
  backend "s3" {
    key          = "pac/terraform.tfstate"
    use_lockfile = true
    encrypt      = true
  }
}
