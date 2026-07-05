import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC_ROUTES = ["/login", "/take", "/daftar", "/_next", "/favicon.ico", "/api/auth", "/api/umkm", "/api/daftar", "/api/wilayah"];
const UMKM_ROUTES = ["/portal"];
const ADMIN_ROUTES = ["/dashboard", "/events", "/umkm", "/tests", "/materials", "/wa-inbox", "/admin"];
const PEMATERI_ROUTES = ["/dashboard", "/events", "/materials", "/api/events/create"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public routes
  if (PUBLIC_ROUTES.some(r => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  // Allow API auth routes
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Check session
  const token = req.cookies.get("session")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const { payload } = await jwtVerify(token, secret);
    const role = payload.role as string;

    // UMKM role: allow portal, test-taking, and payment API
    if (role === "umkm") {
      if (UMKM_ROUTES.some(r => pathname.startsWith(r)) || pathname.startsWith("/take") || pathname.startsWith("/api/pay")) {
        return NextResponse.next();
      }
      return NextResponse.redirect(new URL("/portal", req.url));
    }

    // Admin / Perusahaan: allow admin routes, redirect portal → dashboard
    if (role === "admin" || role === "perusahaan") {
      if (pathname.startsWith("/portal")) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
      return NextResponse.next();
    }

    // Pemateri: materials, events, dashboard only
    if (role === "pemateri") {
      if (PEMATERI_ROUTES.some(r => pathname.startsWith(r))) {
        return NextResponse.next();
      }
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    // Unknown role
    return NextResponse.redirect(new URL("/login", req.url));
  } catch {
    // Invalid token
    const res = NextResponse.redirect(new URL("/login", req.url));
    res.cookies.set("session", "", { maxAge: 0, path: "/" });
    return res;
  }
}

export const proxyConfig = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
