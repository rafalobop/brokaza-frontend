/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "https://brokaza.test/"}
 */
import { storeTheme, THEME_STORAGE_KEY } from "@/lib/theme";

describe("theme cookie sobre HTTPS (KAN-329)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.cookie = `${THEME_STORAGE_KEY}=; path=/; max-age=0`;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("agrega el atributo Secure a la cookie cuando la conexión es HTTPS", () => {
    const storageSpy = jest
      .spyOn(window.localStorage.__proto__, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });
    const cookieSetSpy = jest.spyOn(document, "cookie", "set");

    storeTheme("dark");

    expect(cookieSetSpy).toHaveBeenCalledWith(expect.stringContaining("; secure"));
    storageSpy.mockRestore();
    cookieSetSpy.mockRestore();
  });
});
