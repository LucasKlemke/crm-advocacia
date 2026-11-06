variable "regiao" {
  description = "Região AWS do bucket de estado e da role de deploy."
  type        = string
  default     = "us-east-1"
}

variable "repositorio_github" {
  description = "Repositório GitHub (owner/repo) autorizado a assumir a role de deploy via OIDC."
  type        = string
  default     = "LucasKlemke/crm-advocacia"
}

variable "prefixo" {
  description = "Prefixo dos nomes dos recursos."
  type        = string
  default     = "crm-pac"
}
