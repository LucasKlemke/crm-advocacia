import { Body, Controller, Inject, Post, UseFilters } from "@nestjs/common";
import { ErrosHttpFilter, type TradutorDeErro } from "../comum/erros-http.filter";
import { ValidacaoZodPipe } from "../comum/validacao.pipe";
import { USUARIO_SERVICE } from "./tokens";
import { cadastroSchema, type DadosCadastro } from "./schemas";
import { EmailJaCadastradoError, type usuarioService } from "@/services/usuario.service";

const tratarErroDeCadastro: TradutorDeErro = (error) =>
  error instanceof EmailJaCadastradoError ? Response.json({ error: error.message }, { status: 409 }) : null;

// Rota pública (RN02): cria só o usuário. Convites pendentes para o e-mail já viram
// membership aqui (temEscritorio); a sessão é aberta pelo front via /api/auth/login.
@Controller("cadastro")
@UseFilters(new ErrosHttpFilter([tratarErroDeCadastro]))
export class CadastroController {
  constructor(@Inject(USUARIO_SERVICE) private readonly usuarios: Pick<typeof usuarioService, "cadastrarUsuario">) {}

  @Post()
  async cadastrar(@Body(new ValidacaoZodPipe(cadastroSchema)) dados: DadosCadastro) {
    const { usuario, temEscritorio } = await this.usuarios.cadastrarUsuario(dados);
    return { usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email }, temEscritorio };
  }
}
