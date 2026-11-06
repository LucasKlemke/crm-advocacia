resource "aws_lb" "api" {
  name               = local.nome_api
  load_balancer_type = "application"
  internal           = false
  subnets            = aws_subnet.publica[*].id
  security_groups    = [aws_security_group.alb.id]

  # Conexões WebSocket ociosas entre pings (25 s) não podem ser derrubadas pelo ALB.
  idle_timeout               = 120
  drop_invalid_header_fields = true
}

resource "aws_lb_target_group" "api" {
  name                 = local.nome_api
  port                 = local.porta_api
  protocol             = "HTTP"
  target_type          = "ip"
  vpc_id               = aws_vpc.principal.id
  deregistration_delay = 30

  health_check {
    path                = local.caminho_saude
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

# Sem o header secreto do CloudFront, 403: ninguém fala com o ALB direto, mesmo dentro da prefix list.
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.api.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "fixed-response"

    fixed_response {
      content_type = "text/plain"
      message_body = "Forbidden"
      status_code  = "403"
    }
  }
}

resource "aws_lb_listener_rule" "origem_cloudfront" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 10

  condition {
    http_header {
      http_header_name = "X-Origem-CloudFront"
      values           = [random_password.origem_cloudfront.result]
    }
  }

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}
