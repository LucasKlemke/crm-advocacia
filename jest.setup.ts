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
