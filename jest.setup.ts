import "@testing-library/jest-dom";

// jsdom não implementa matchMedia — necessário para o hook use-mobile usado pelo
// Sidebar (shadcn/ui) em qualquer teste que renderize dentro de um SidebarProvider.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

// jsdom também não implementa PointerEvent, que o Base UI dispara ao ativar controles
// como Checkbox e DropdownMenu. Sem isso qualquer clique nesses componentes estoura
// "PointerEvent is not a constructor" antes de o handler React rodar.
if (typeof window !== "undefined" && !window.PointerEvent) {
  class PointerEventPolyfill extends MouseEvent {
    readonly pointerId: number;
    readonly pointerType: string;

    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 0;
      this.pointerType = params.pointerType ?? "mouse";
    }
  }
  window.PointerEvent = PointerEventPolyfill as unknown as typeof window.PointerEvent;
}

// Base UI também usa estas duas APIs de captura de ponteiro, ausentes no jsdom.
if (typeof Element !== "undefined" && !Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
}

// jsdom não implementa ResizeObserver, usado pelo cmdk (Command) para medir a lista —
// sem isso qualquer teste que abra um Command (ex. StatusIconePicker) estoura
// "ResizeObserver is not defined" ao montar.
if (typeof window !== "undefined" && !window.ResizeObserver) {
  class ResizeObserverPolyfill {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = ResizeObserverPolyfill as unknown as typeof window.ResizeObserver;
}

// jsdom também não implementa scrollIntoView, usado pelo cmdk (Command) para rolar até
// o item destacado ao navegar pela lista com teclado/mouse.
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
