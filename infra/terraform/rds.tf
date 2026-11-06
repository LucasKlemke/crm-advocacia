resource "aws_db_subnet_group" "principal" {
  name        = "${var.prefixo}-db"
  description = "Subnets privadas do Postgres"
  subnet_ids  = aws_subnet.privada[*].id
}

# Ambiente de disciplina: single-AZ, backup de 1 dia, sem proteção contra exclusão e sem snapshot final
# (um `terraform destroy` apaga os dados). Ver README.md.
resource "aws_db_instance" "principal" {
  identifier     = "${var.prefixo}-db"
  engine         = "postgres"
  engine_version = "16"
  instance_class = var.db_instance_class

  allocated_storage = 20
  storage_type      = "gp3"
  storage_encrypted = true

  db_name  = local.db_nome
  username = local.db_usuario
  password = random_password.db.result

  db_subnet_group_name   = aws_db_subnet_group.principal.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false
  multi_az               = false

  backup_retention_period    = 1
  auto_minor_version_upgrade = true
  apply_immediately          = true
  deletion_protection        = false
  skip_final_snapshot        = true
}
