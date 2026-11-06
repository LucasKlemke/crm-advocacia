const JSDOMEnvironment = require("jest-environment-jsdom").default;

// jsdom do Jest 29 sem as APIs que o React Router 7 usa: TextEncoder (no import do
// pacote) e Request/Headers/AbortController (a cada navegação de um data router, ex.
// <Navigate> dentro de createMemoryRouter). As classes vêm do Node que roda o Jest.
// AbortController/AbortSignal também precisam ser os do Node: o Request do Node rejeita
// um signal do jsdom. FormData, Blob e URL continuam os do jsdom — o login faz
// `new FormData(form)`, que só o FormData do jsdom aceita.
class AmbienteJsdom extends JSDOMEnvironment {
  constructor(...args) {
    super(...args);
    this.global.TextEncoder = TextEncoder;
    this.global.TextDecoder = TextDecoder;
    this.global.Request = Request;
    this.global.Response = Response;
    this.global.Headers = Headers;
    this.global.AbortController = AbortController;
    this.global.AbortSignal = AbortSignal;
  }
}

module.exports = AmbienteJsdom;
