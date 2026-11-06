variable "regiao" {
  description = "Região AWS do bucket de estado e das roles do GitHub."
  type        = string
  default     = "us-east-1"
}

variable "repositorio_github" {
  description = "Repositório GitHub (owner/repo) autorizado a assumir as roles de deploy (main) e plan (PRs) via OIDC."
  type        = string
  default     = "LucasKlemke/crm-advocacia"
}

variable "prefixo" {
  description = "Prefixo dos nomes dos recursos."
  type        = string
  default     = "crm-pac"
}
