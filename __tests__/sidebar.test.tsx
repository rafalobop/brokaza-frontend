import { render, screen, fireEvent } from "@testing-library/react";
import { LayoutGrid } from "lucide-react";
import { Sidebar, type SidebarNavItem } from "@/components/shell/Sidebar";
import { ThemeProvider } from "@/lib/theme-context";

jest.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

const NAV_ITEMS: SidebarNavItem[] = [{ label: "Resumen", href: "/", icon: LayoutGrid }];

function renderSidebar(props: Partial<Parameters<typeof Sidebar>[0]> = {}) {
  return render(
    <ThemeProvider>
      <Sidebar
        brand="Brokaza"
        navItems={NAV_ITEMS}
        mobileOpen={false}
        onMobileClose={jest.fn()}
        {...props}
      />
    </ThemeProvider>,
  );
}

describe("Sidebar — drawer mobile (responsive)", () => {
  it("no renderiza el drawer mobile cuando mobileOpen=false", () => {
    renderSidebar({ mobileOpen: false });

    expect(screen.getAllByText("Resumen")).toHaveLength(1);
    expect(screen.queryByLabelText("Cerrar menú")).not.toBeInTheDocument();
  });

  it("renderiza el drawer (backdrop + panel) cuando mobileOpen=true", () => {
    renderSidebar({ mobileOpen: true });

    // Un nav item por columna desktop + uno por el drawer mobile.
    expect(screen.getAllByText("Resumen")).toHaveLength(2);
    expect(screen.getAllByLabelText("Cerrar menú")).toHaveLength(2);
  });

  it("cierra el drawer al hacer click en el backdrop", () => {
    const onMobileClose = jest.fn();
    renderSidebar({ mobileOpen: true, onMobileClose });
    // El efecto de "cerrar al cambiar de ruta" ya dispara una vez al montar (mismo `pathname`
    // que el mount inicial) — se descarta esa llamada para medir solo el click del backdrop.
    onMobileClose.mockClear();

    fireEvent.click(screen.getAllByLabelText("Cerrar menú")[0]);
    expect(onMobileClose).toHaveBeenCalledTimes(1);
  });

  it("cierra el drawer al hacer click en el botón X", () => {
    const onMobileClose = jest.fn();
    renderSidebar({ mobileOpen: true, onMobileClose });
    onMobileClose.mockClear();

    fireEvent.click(screen.getAllByLabelText("Cerrar menú")[1]);
    expect(onMobileClose).toHaveBeenCalledTimes(1);
  });

  it("cierra el drawer al navegar (click en un item del drawer)", () => {
    const onMobileClose = jest.fn();
    renderSidebar({ mobileOpen: true, onMobileClose });

    // El segundo "Resumen" es el del drawer (el primero es la columna desktop, siempre en el DOM).
    fireEvent.click(screen.getAllByText("Resumen")[1]);
    expect(onMobileClose).toHaveBeenCalled();
  });
});

describe("Sidebar — términos críticos sin traducir (KAN-298)", () => {
  it("marca la marca 'Brokaza' con translate=no/notranslate", () => {
    renderSidebar();

    const brand = screen.getByText("Brokaza");
    expect(brand).toHaveAttribute("translate", "no");
    expect(brand).toHaveClass("notranslate");
  });

  it("marca un nav item con notranslate=true (ej. 'Matches') sin afectar a los demás", () => {
    renderSidebar({
      navItems: [
        { label: "Resumen", href: "/", icon: LayoutGrid },
        { label: "Matches", href: "/matches", icon: LayoutGrid, notranslate: true },
      ],
    });

    const matchesLabel = screen.getByText("Matches");
    expect(matchesLabel).toHaveAttribute("translate", "no");
    expect(matchesLabel).toHaveClass("notranslate");

    const resumenLabel = screen.getByText("Resumen");
    expect(resumenLabel).not.toHaveAttribute("translate");
  });
});
