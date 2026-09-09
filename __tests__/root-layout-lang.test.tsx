import { renderToStaticMarkup } from "react-dom/server";
import RootLayout from "@/app/layout";

/**
 * KAN-328: el `<html lang>` es lo primero que un lector de pantalla usa para elegir el motor de
 * pronunciación/fonética — con `lang="en"` sobre una interfaz 100% en español (Tucumán,
 * Argentina), el lector leía todo el texto con acento/fonética inglesa. Se prueba con
 * `renderToStaticMarkup` (no `render` de RTL) porque `RootLayout` devuelve el documento completo
 * (`<html>`/`<head>`/`<body>`) — RTL monta dentro de un `<div>` ya colgado de `document.body`, así
 * que anidar otro `<html>` ahí no refleja lo que un browser/lector de pantalla realmente recibe.
 */
describe("RootLayout (KAN-328) - atributo lang", () => {
  it('renderiza <html lang="es">, no "en"', () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <p>contenido</p>
      </RootLayout>,
    );

    expect(html).toMatch(/<html[^>]*\blang="es"/);
    expect(html).not.toMatch(/\blang="en"/);
  });
});
