import { NextResponse, type NextRequest } from "next/server";

/**
 * Gate de acceso pre-lanzamiento: mientras `SITE_LOCKED=true`, cualquier visitante de
 * app.brokaza.com es redirigido a brokaza.com en vez de poder entrar a la app. Para liberar
 * la app a uso público, basta con poner `SITE_LOCKED=false` (o borrar la variable) en Railway
 * y redeployar — no hace falta tocar código.
 *
 * Bypass para el equipo: visitar la app con `?preview_key=<SITE_LOCK_BYPASS_TOKEN>` setea una
 * cookie de bypass y permite seguir navegando (incluso con el sitio bloqueado) sin exponer el
 * token en cada request.
 */
const BYPASS_COOKIE = "brokaza_preview";

const PASSTHROUGH_PATHS = ["/health", "/_next", "/favicon.ico", "/robots.txt", "/sitemap.xml"];

export function proxy(req: NextRequest): NextResponse {
  const isLocked = process.env.SITE_LOCKED === "true";
  if (!isLocked) return NextResponse.next();

  const { pathname, searchParams } = req.nextUrl;
  if (PASSTHROUGH_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  const bypassToken = process.env.SITE_LOCK_BYPASS_TOKEN;
  const previewKey = searchParams.get("preview_key");
  if (bypassToken && previewKey === bypassToken) {
    const cleanUrl = req.nextUrl.clone();
    cleanUrl.searchParams.delete("preview_key");
    const res = NextResponse.redirect(cleanUrl);
    res.cookies.set(BYPASS_COOKIE, bypassToken, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  }

  if (bypassToken && req.cookies.get(BYPASS_COOKIE)?.value === bypassToken) {
    return NextResponse.next();
  }

  return NextResponse.redirect("https://brokaza.com");
}

export const config = {
  matcher: "/:path*",
};
