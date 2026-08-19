import { render, screen } from "@testing-library/react";
import { UploadProgressBar } from "@/components/upload/UploadProgressBar";

describe("UploadProgressBar (KAN-218)", () => {
  it("no renderiza nada si stage es null", () => {
    const { container } = render(<UploadProgressBar stage={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("muestra el label y el porcentaje de la etapa", () => {
    render(<UploadProgressBar stage="parsing_headers" />);

    expect(screen.getByText("Leyendo el archivo...")).toBeInTheDocument();
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "20");
  });

  it("llega a 100% en 'done'", () => {
    render(<UploadProgressBar stage="done" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByText("¡Listo!")).toBeInTheDocument();
  });

  it("'error' se muestra al 100% con el estilo de error", () => {
    render(<UploadProgressBar stage="error" />);

    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    expect(
      screen.getByText("Ocurrió un error durante el procesamiento."),
    ).toHaveClass("text-red-600");
  });
});
