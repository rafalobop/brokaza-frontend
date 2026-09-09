import {
  applyTheme,
  buildThemeInitScript,
  getAppliedTheme,
  getStoredTheme,
  storeTheme,
  THEME_STORAGE_KEY,
} from "@/lib/theme";

describe("theme (KAN-256)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.cookie = `${THEME_STORAGE_KEY}=; path=/; max-age=0`;
    document.documentElement.removeAttribute("data-theme");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("getStoredTheme", () => {
    it("devuelve 'light' por default sin nada guardado", () => {
      expect(getStoredTheme()).toBe("light");
    });

    it("lee de localStorage cuando hay un valor válido", () => {
      window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
      expect(getStoredTheme()).toBe("dark");
    });

    it("cae a cookie cuando localStorage no tiene nada guardado", () => {
      document.cookie = `${THEME_STORAGE_KEY}=dark; path=/`;
      expect(getStoredTheme()).toBe("dark");
    });

    it("cae a cookie cuando localStorage tira (ej. modo privado de Safari)", () => {
      const spy = jest.spyOn(window.localStorage.__proto__, "getItem").mockImplementation(() => {
        throw new Error("SecurityError");
      });
      document.cookie = `${THEME_STORAGE_KEY}=dark; path=/`;

      expect(getStoredTheme()).toBe("dark");

      spy.mockRestore();
    });

    it("ignora valores inválidos guardados y devuelve 'light'", () => {
      window.localStorage.setItem(THEME_STORAGE_KEY, "sepia");
      expect(getStoredTheme()).toBe("light");
    });
  });

  describe("storeTheme", () => {
    it("guarda en localStorage", () => {
      storeTheme("dark");
      expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    });

    it("cae a cookie cuando localStorage.setItem tira", () => {
      const spy = jest.spyOn(window.localStorage.__proto__, "setItem").mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });

      storeTheme("dark");

      spy.mockRestore();
      expect(document.cookie).toContain(`${THEME_STORAGE_KEY}=dark`);
    });

    it("no agrega Secure a la cookie en HTTP (KAN-329) — jsdom corre en http://localhost por default", () => {
      const storageSpy = jest
        .spyOn(window.localStorage.__proto__, "setItem")
        .mockImplementation(() => {
          throw new Error("QuotaExceededError");
        });
      const cookieSetSpy = jest.spyOn(document, "cookie", "set");

      storeTheme("dark");

      expect(cookieSetSpy).toHaveBeenCalledWith(expect.not.stringContaining("secure"));
      storageSpy.mockRestore();
      cookieSetSpy.mockRestore();
    });

    // Caso HTTPS (KAN-329) en __tests__/theme-https.test.ts — `location.protocol` no es
    // mockeable en este archivo (jsdom corre sobre http://localhost por default y su accessor
    // no es configurable), así que ese archivo fuerza la URL vía docblock de Jest.
  });

  describe("applyTheme / getAppliedTheme", () => {
    it("setea y lee el atributo data-theme del <html>", () => {
      applyTheme("dark");
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
      expect(getAppliedTheme()).toBe("dark");
    });

    it("getAppliedTheme devuelve 'light' sin atributo seteado", () => {
      expect(getAppliedTheme()).toBe("light");
    });
  });

  describe("buildThemeInitScript", () => {
    it("produce un script que aplica el tema guardado en localStorage sin FOUC", () => {
      window.localStorage.setItem(THEME_STORAGE_KEY, "dark");

      eval(buildThemeInitScript());

      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    });

    it("aplica 'light' por default cuando no hay nada guardado", () => {
      eval(buildThemeInitScript());

      expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    });
  });
});
