import "@testing-library/jest-dom";

// jsdom no implementa scrollIntoView — lo usa src/components/ui/Select.tsx para mantener la
// opción activa visible dentro del listbox al navegar con teclado. Algunas suites corren con
// testEnvironment "node" (sin DOM), donde `Element` ni siquiera existe — no tocarlas.
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}
