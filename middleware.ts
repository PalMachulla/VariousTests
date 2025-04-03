import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// IMPORTANT: Environment variables in middleware need special handling
// For middleware, we need to hardcode the default value as edge runtime
// can't access process.env at runtime the same way as server components
const APP_PASSWORD = "image123"; // Default password if env variable is not set at build time

// The session cookie name
const SESSION_COOKIE = "auth_session";

// Function to check if the user is authenticated
function isAuthenticated(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE);
  return sessionCookie?.value === APP_PASSWORD;
}

export function middleware(request: NextRequest) {
  // Debug to check if middleware is running
  console.log(`Middleware running for path: ${request.nextUrl.pathname}`);

  // Skip authentication for the login endpoint
  if (request.nextUrl.pathname === "/api/login") {
    console.log("Skipping auth for login API");
    return NextResponse.next();
  }

  // Skip authentication for static files and other excluded paths
  if (
    request.nextUrl.pathname.startsWith("/_next") ||
    request.nextUrl.pathname.startsWith("/icons") ||
    request.nextUrl.pathname.includes(".") || // Catch-all for files with extensions
    request.nextUrl.pathname === "/login" || // Allow access to login page itself
    request.nextUrl.pathname === "/debug" || // Allow access to debug page
    request.nextUrl.pathname === "/favicon.ico"
  ) {
    console.log(`Skipping auth for static path: ${request.nextUrl.pathname}`);
    return NextResponse.next();
  }

  // If user is not authenticated, redirect to login page
  if (!isAuthenticated(request)) {
    console.log(
      `Auth check failed, redirecting to login from: ${request.nextUrl.pathname}`
    );
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // User is authenticated, allow the request
  console.log(`Auth check passed for: ${request.nextUrl.pathname}`);
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - login (login page)
     * - debug (debug page)
     * - api/login (authentication endpoint)
     * - _next (Next.js internals)
     * - icons (app icons)
     * - files with extensions (static files)
     */
    "/((?!login|debug|api/login|_next|icons|.*\\.).*)",
  ],
};
