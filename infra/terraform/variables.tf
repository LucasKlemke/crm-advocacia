variable "regiao" {
  description = "Região AWS do ambiente."
  type        = string
  default     = "us-east-1"
}

variable "prefixo" {
  description = "Prefixo dos nomes dos recursos."
  type        = string
  default     = "crm-pac"
}

variable "image_tag" {
  description = "Tag da imagem da API no ECR (o deploy usa o SHA do commit)."
  type        = string
}

variable "web_origins" {
  description = "Origens da SPA (ex.: https://crm-advocacia-pac.vercel.app): CORS do S3 e WEB_ORIGINS da API."
  type        = list(string)

  validation {
    condition     = length(var.web_origins) > 0
    error_message = "Informe ao menos uma origem da SPA."
  }
}

variable "uazapi_server_url" {
  description = "URL base do servidor UAZAPI (ex.: https://<subdominio>.uazapi.com)."
  type        = string
}

variable "uazapi_admin_token" {
  description = "Admin token da UAZAPI (no CI: secret TF_VAR_UAZAPI_ADMIN_TOKEN)."
  type        = string
  sensitive   = true
}

variable "new_relic_license_key" {
  description = "License key do New Relic; vazio desliga o agente (no CI: secret TF_VAR_NEW_RELIC_LICENSE_KEY)."
  type        = string
  sensitive   = true
  default     = ""
}

variable "new_relic_app_name" {
  description = "Nome da aplicação no New Relic."
  type        = string
  default     = "crm-advocacia-pac"
}

variable "budget_email" {
  description = "E-mail que recebe os alertas do orçamento mensal (no CI: secret TF_VAR_BUDGET_EMAIL)."
  type        = string
}

variable "budget_limit_usd" {
  description = "Limite mensal do orçamento em USD (alertas em 80% e 100%)."
  type        = number
  default     = 30
}

variable "db_instance_class" {
  description = "Classe da instância RDS."
  type        = string
  default     = "db.t4g.micro"
}

variable "task_cpu" {
  description = "CPU da task Fargate (unidades; 1024 = 1 vCPU)."
  type        = number
  default     = 512
}

variable "task_memory" {
  description = "Memória da task Fargate (MiB)."
  type        = number
  default     = 1024
}
