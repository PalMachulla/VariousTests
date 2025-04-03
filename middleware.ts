import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// The password you want to use
const APP_PASSWORD = process.env.APP_PASSWORD || "securepassword123";

// The session cookie name
const SESSION_COOKIE = "auth_session";

// Function to check if the user is authenticated
function isAuthenticated(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE);
  return sessionCookie?.value === APP_PASSWORD;
}

export function middleware(request: NextRequest) {
  // Skip authentication for the login endpoint
  if (request.nextUrl.pathname === "/api/login") {
    return NextResponse.next();
  }

  // Skip authentication for static files
  if (
    request.nextUrl.pathname.startsWith("/_next") ||
    request.nextUrl.pathname.startsWith("/icons") ||
    request.nextUrl.pathname.includes(".") // Catch-all for files with extensions
  ) {
    return NextResponse.next();
  }

  // If user is not authenticated, redirect to login page
  if (!isAuthenticated(request)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // User is authenticated, allow the request
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api/login (authentication endpoint)
     * - _next (Next.js internals)
     * - icons (app icons)
     * - files with extensions (static files)
     */
    "/((?!api/login|_next|icons|.*\\.).*)",
  ],
};
