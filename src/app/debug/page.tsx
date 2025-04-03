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
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-white text-gray-900">
      <div className="w-full max-w-md">
        <div className="flex items-center mb-6">
          <button
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            onClick={() => window.history.back()}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-4xl font-bold ml-4">Debug Page</h1>
        </div>

        <div className="bg-gray-50 p-8 rounded-2xl shadow-sm border border-gray-200 mb-6">
          <h2 className="text-2xl font-semibold mb-4">Current Cookies:</h2>
          <pre className="bg-white p-4 rounded-lg overflow-x-auto border border-gray-200 mb-6 text-sm">
            {cookies}
          </pre>

          <div className="space-y-4">
            <button
              onClick={handleSetAuthCookie}
              className="w-full py-3 bg-black text-white font-medium rounded-full hover:bg-gray-800 transition-colors"
            >
              Set Auth Cookie
            </button>

            <button
              onClick={handleClearAuthCookie}
              className="w-full py-3 bg-red-500 text-white font-medium rounded-full hover:bg-red-600 transition-colors"
            >
              Clear Auth Cookie
            </button>

            <button
              onClick={handleGoHome}
              className="w-full py-3 border-2 border-gray-300 text-black font-medium rounded-full hover:bg-gray-100 transition-colors"
            >
              Go to Homepage
            </button>

            <button
              onClick={handleGoLogin}
              className="w-full py-3 border-2 border-gray-300 text-black font-medium rounded-full hover:bg-gray-100 transition-colors"
            >
              Go to Login Page
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
