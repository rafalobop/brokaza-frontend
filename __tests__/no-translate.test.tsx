import { render, screen } from "@testing-library/react";
import { NoTranslate } from "@/components/ui/NoTranslate";
import { PageHeader } from "@/components/shell/PageHeader";

describe("NoTranslate (KAN-298)", () => {
  it("envuelve el texto en un <span> con translate=no y class=notranslate por default", () => {
    render(<NoTranslate>Brokaza</NoTranslate>);

    const el = screen.getByText("Brokaza");
    expect(el.tagName).toBe("SPAN");
    expect(el).toHaveAttribute("translate", "no");
    expect(el).toHaveClass("notranslate");
  });

  it("permite cambiar el tag con `as` sin perder los atributos anti-traducción", () => {
    render(<NoTranslate as="strong">Match</NoTranslate>);

    const el = screen.getByText("Match");
    expect(el.tagName).toBe("STRONG");
    expect(el).toHaveAttribute("translate", "no");
    expect(el).toHaveClass("notranslate");
  });
});

describe("PageHeader — prop notranslate (KAN-298)", () => {
  it("sin notranslate, el título no lleva translate=no", () => {
    render(<PageHeader title="Resumen" />);

    const heading = screen.getByRole("heading", { name: "Resumen" });
    expect(heading).not.toHaveAttribute("translate");
    expect(heading).not.toHaveClass("notranslate");
  });

  it("con notranslate=true, el título lleva translate=no y class=notranslate (ej. 'Matches')", () => {
    render(<PageHeader title="Matches" notranslate />);

    const heading = screen.getByRole("heading", { name: "Matches" });
    expect(heading).toHaveAttribute("translate", "no");
    expect(heading).toHaveClass("notranslate");
  });
});
