# VPC com 2 subnets públicas (ALB + task Fargate com IP público) e 2 privadas (RDS), em AZs distintas.
# Sem NAT Gateway (~US$ 32/mês): a task sai para a internet pelo próprio IP público.

data "aws_availability_zones" "disponiveis" {
  state = "available"
}

locals {
  azs = slice(data.aws_availability_zones.disponiveis.names, 0, 2)
}

resource "aws_vpc" "principal" {
  cidr_block           = "10.20.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "${var.prefixo}-vpc" }
}

resource "aws_internet_gateway" "principal" {
  vpc_id = aws_vpc.principal.id

  tags = { Name = "${var.prefixo}-igw" }
}

resource "aws_subnet" "publica" {
  count = 2

  vpc_id                  = aws_vpc.principal.id
  availability_zone       = local.azs[count.index]
  cidr_block              = cidrsubnet(aws_vpc.principal.cidr_block, 8, count.index)
  map_public_ip_on_launch = false

  tags = { Name = "${var.prefixo}-publica-${local.azs[count.index]}" }
}

resource "aws_subnet" "privada" {
  count = 2

  vpc_id            = aws_vpc.principal.id
  availability_zone = local.azs[count.index]
  cidr_block        = cidrsubnet(aws_vpc.principal.cidr_block, 8, count.index + 10)

  tags = { Name = "${var.prefixo}-privada-${local.azs[count.index]}" }
}

resource "aws_route_table" "publica" {
  vpc_id = aws_vpc.principal.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.principal.id
  }

  tags = { Name = "${var.prefixo}-rt-publica" }
}

resource "aws_route_table_association" "publica" {
  count = 2

  subnet_id      = aws_subnet.publica[count.index].id
  route_table_id = aws_route_table.publica.id
}

# Sem rota para a internet: só tráfego local da VPC.
resource "aws_route_table" "privada" {
  vpc_id = aws_vpc.principal.id

  tags = { Name = "${var.prefixo}-rt-privada" }
}

resource "aws_route_table_association" "privada" {
  count = 2

  subnet_id      = aws_subnet.privada[count.index].id
  route_table_id = aws_route_table.privada.id
}

# ---------------------------------------------------------------------------
# Security groups: CloudFront -> ALB (80) -> task (3001) -> RDS (5432)
# ---------------------------------------------------------------------------

data "aws_ec2_managed_prefix_list" "cloudfront" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

resource "aws_security_group" "alb" {
  name        = "${var.prefixo}-alb"
  description = "ALB da API: entrada HTTP so do CloudFront"
  vpc_id      = aws_vpc.principal.id

  tags = { Name = "${var.prefixo}-alb" }
}

resource "aws_vpc_security_group_ingress_rule" "alb_cloudfront" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTP vindo das origens do CloudFront"
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
  prefix_list_id    = data.aws_ec2_managed_prefix_list.cloudfront.id
}

resource "aws_vpc_security_group_egress_rule" "alb_para_task" {
  security_group_id            = aws_security_group.alb.id
  description                  = "Encaminha para a task da API"
  ip_protocol                  = "tcp"
  from_port                    = local.porta_api
  to_port                      = local.porta_api
  referenced_security_group_id = aws_security_group.task.id
}

resource "aws_security_group" "task" {
  name        = "${var.prefixo}-task"
  description = "Task da API: entrada so do ALB, saida livre"
  vpc_id      = aws_vpc.principal.id

  tags = { Name = "${var.prefixo}-task" }
}

resource "aws_vpc_security_group_ingress_rule" "task_do_alb" {
  security_group_id            = aws_security_group.task.id
  description                  = "Porta da API vinda do ALB"
  ip_protocol                  = "tcp"
  from_port                    = local.porta_api
  to_port                      = local.porta_api
  referenced_security_group_id = aws_security_group.alb.id
}

resource "aws_vpc_security_group_egress_rule" "task_saida" {
  security_group_id = aws_security_group.task.id
  description       = "Saida livre (UAZAPI, New Relic, ECR, Secrets Manager, S3, RDS)"
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_security_group" "rds" {
  name        = "${var.prefixo}-rds"
  description = "Postgres: entrada so da task da API"
  vpc_id      = aws_vpc.principal.id

  tags = { Name = "${var.prefixo}-rds" }
}

resource "aws_vpc_security_group_ingress_rule" "rds_da_task" {
  security_group_id            = aws_security_group.rds.id
  description                  = "Postgres vindo da task da API"
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = aws_security_group.task.id
}
