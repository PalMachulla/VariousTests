"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DebugPage() {
  const [cookies, setCookies] = useState<string>("Loading cookies...");
  const router = useRouter();

  useEffect(() => {
    // Get all cookies
    const allCookies = document.cookie;
    setCookies(allCookies || "No cookies found");
  }, []);

  const handleSetAuthCookie = () => {
    document.cookie =
      "auth_session=image123; path=/; max-age=604800; samesite=strict";
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  const handleClearAuthCookie = () => {
    document.cookie =
      "auth_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  const handleGoHome = () => {
    router.push("/");
  };

  const handleGoLogin = () => {
    router.push("/login");
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-6 md:p-12 lg:p-24 bg-gray-100 text-gray-800">
      <div className="z-10 w-full max-w-4xl items-center font-mono text-sm">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h1 className="text-2xl md:text-3xl font-bold text-blue-600 mb-6 text-center">
            Auth Debug Page
          </h1>

          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Current Cookies:</h2>
            <pre className="bg-gray-100 p-4 rounded overflow-x-auto">
              {cookies}
            </pre>
          </div>

          <div className="flex flex-col gap-4">
            <button
              onClick={handleSetAuthCookie}
              className="px-6 py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600"
            >
              Set Auth Cookie
            </button>

            <button
              onClick={handleClearAuthCookie}
              className="px-6 py-3 bg-red-500 text-white font-semibold rounded-lg shadow-md hover:bg-red-600"
            >
              Clear Auth Cookie
            </button>

            <button
              onClick={handleGoHome}
              className="px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600"
            >
              Go to Homepage
            </button>

            <button
              onClick={handleGoLogin}
              className="px-6 py-3 bg-purple-500 text-white font-semibold rounded-lg shadow-md hover:bg-purple-600"
            >
              Go to Login Page
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
