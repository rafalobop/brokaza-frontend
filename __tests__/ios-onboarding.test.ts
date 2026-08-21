import {
  isIosDevice,
  isRunningAsInstalledPwa,
  shouldShowIosInstallOnboarding,
} from "@/lib/ios-onboarding";

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const ANDROID_UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36";
const DESKTOP_MAC_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

describe("ios-onboarding (KAN-257, port de ios-onboarding.js KAN-47)", () => {
  describe("isIosDevice", () => {
    it("reconoce un iPhone por el user agent clásico", () => {
      expect(isIosDevice({ userAgent: IPHONE_UA, platform: "iPhone", maxTouchPoints: 5 })).toBe(
        true,
      );
    });

    it("reconoce un iPad con el user agent 'de escritorio' de iPadOS 13+ (MacIntel + touch)", () => {
      expect(
        isIosDevice({ userAgent: DESKTOP_MAC_UA, platform: "MacIntel", maxTouchPoints: 5 }),
      ).toBe(true);
    });

    it("no confunde un Mac real (sin touch) con un iPad", () => {
      expect(
        isIosDevice({ userAgent: DESKTOP_MAC_UA, platform: "MacIntel", maxTouchPoints: 0 }),
      ).toBe(false);
    });

    it("no reconoce Android", () => {
      expect(
        isIosDevice({ userAgent: ANDROID_UA, platform: "Linux armv8l", maxTouchPoints: 5 }),
      ).toBe(false);
    });
  });

  describe("isRunningAsInstalledPwa", () => {
    it("true si navigator.standalone está seteado (iOS)", () => {
      expect(
        isRunningAsInstalledPwa({
          userAgent: IPHONE_UA,
          platform: "iPhone",
          maxTouchPoints: 5,
          standalone: true,
        }),
      ).toBe(true);
    });

    it("true si matchMedia('(display-mode: standalone)') matchea", () => {
      const win = { matchMedia: () => ({ matches: true }) as MediaQueryList };
      expect(
        isRunningAsInstalledPwa(
          { userAgent: IPHONE_UA, platform: "iPhone", maxTouchPoints: 5 },
          win,
        ),
      ).toBe(true);
    });

    it("false por default (pestaña normal de Safari)", () => {
      const win = { matchMedia: () => ({ matches: false }) as MediaQueryList };
      expect(
        isRunningAsInstalledPwa(
          { userAgent: IPHONE_UA, platform: "iPhone", maxTouchPoints: 5 },
          win,
        ),
      ).toBe(false);
    });
  });

  describe("shouldShowIosInstallOnboarding", () => {
    it("true en iOS sin instalar como PWA", () => {
      const win = { matchMedia: () => ({ matches: false }) as MediaQueryList };
      expect(
        shouldShowIosInstallOnboarding(
          { userAgent: IPHONE_UA, platform: "iPhone", maxTouchPoints: 5 },
          win,
        ),
      ).toBe(true);
    });

    it("false en iOS ya instalado como PWA", () => {
      const win = { matchMedia: () => ({ matches: true }) as MediaQueryList };
      expect(
        shouldShowIosInstallOnboarding(
          { userAgent: IPHONE_UA, platform: "iPhone", maxTouchPoints: 5 },
          win,
        ),
      ).toBe(false);
    });

    it("false en Android", () => {
      const win = { matchMedia: () => ({ matches: false }) as MediaQueryList };
      expect(
        shouldShowIosInstallOnboarding(
          { userAgent: ANDROID_UA, platform: "Linux armv8l", maxTouchPoints: 5 },
          win,
        ),
      ).toBe(false);
    });
  });
});
