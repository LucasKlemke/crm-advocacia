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

variable "prefixo_sub_imutavel" {
  description = "Prefixo do claim sub com IDs imutáveis (gh api repos/<owner>/<repo>/actions/oidc/customization/sub → sub_claim_prefix). Vazio = só o formato clássico."
  type        = string
  default     = "repo:LucasKlemke@127155761/crm-advocacia@1338763709"
}
