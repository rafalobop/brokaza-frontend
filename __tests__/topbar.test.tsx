import { render, screen, fireEvent } from "@testing-library/react";
import { Topbar } from "@/components/shell/Topbar";
import { ThemeProvider } from "@/lib/theme-context";

function renderTopbar(props: Partial<Parameters<typeof Topbar>[0]> = {}) {
  return render(
    <ThemeProvider>
      <Topbar
        email="agente@brokaza.com"
        onLogout={jest.fn()}
        loggingOut={false}
        onMenuClick={jest.fn()}
        {...props}
      />
    </ThemeProvider>,
  );
}

// Pase de UI (2026-09-04, punto 1): nombre + apellido y rol resaltado en vez del email crudo.
describe("Topbar — nombre y rol (pase de UI 2026-09-04)", () => {
  it("muestra displayName y el rol en bold cuando se pasan", () => {
    renderTopbar({ displayName: "Juan Pérez", role: "owner" });

    expect(screen.getByText("Juan Pérez")).toBeInTheDocument();
    expect(screen.getByText("Dueño")).toBeInTheDocument();
  });

  it("etiqueta 'Colaborador' para role='collaborator'", () => {
    renderTopbar({ displayName: "Ana Gómez", role: "collaborator" });

    expect(screen.getByText("Colaborador")).toBeInTheDocument();
  });

  it("sin displayName ni role (ej. panel sysadmin), cae al email y no rompe", () => {
    renderTopbar({ displayName: undefined, role: undefined });

    expect(screen.getByText("agente@brokaza.com")).toBeInTheDocument();
  });
});

describe("Topbar — ícono de usuario sin traducir (KAN-299)", () => {
  it("marca la inicial del avatar con translate=no/notranslate", () => {
    renderTopbar();

    const avatar = screen.getByText("A");
    expect(avatar).toHaveAttribute("translate", "no");
    expect(avatar).toHaveClass("notranslate");
  });
});

describe("Topbar — desplegable de usuario (KAN-299)", () => {
  it("no muestra el desplegable ni el botón de cerrar sesión antes de abrirlo", () => {
    renderTopbar();

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();
  });

  it("abre el desplegable con 'Cerrar sesión' al presionar el ícono de usuario", () => {
    renderTopbar();

    fireEvent.click(screen.getByLabelText("Abrir menú de usuario"));

    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Cerrar sesión" })).toBeInTheDocument();
  });

  it("cierra el desplegable al presionar Escape", () => {
    renderTopbar();

    fireEvent.click(screen.getByLabelText("Abrir menú de usuario"));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("cierra el desplegable al hacer click afuera", () => {
    renderTopbar();

    fireEvent.click(screen.getByLabelText("Abrir menú de usuario"));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("pide confirmación y dispara onLogout al confirmar 'Cerrar sesión' desde el desplegable", () => {
    const onLogout = jest.fn();
    renderTopbar({ onLogout });

    fireEvent.click(screen.getByLabelText("Abrir menú de usuario"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Cerrar sesión" }));

    // El desplegable se cierra y aparece el modal de confirmación.
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByText("¿Seguro que querés cerrar sesión?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it("muestra el estado 'Cerrando sesión...' y deshabilita el ítem mientras loggingOut=true", () => {
    renderTopbar({ loggingOut: true });

    fireEvent.click(screen.getByLabelText("Abrir menú de usuario"));

    const menuItem = screen.getByRole("menuitem", { name: "Cerrando sesión..." });
    expect(menuItem).toBeDisabled();
  });
});
