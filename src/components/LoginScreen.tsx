import { useState, useEffect } from "react";

interface LoginScreenProps {
  onLogin: () => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Set a session cookie or localStorage flag to remember login
        localStorage.setItem("isAuthenticated", "true");
        onLogin();
      } else {
        setError(data.message || "Invalid password");
      }
    } catch (error) {
      setError("Authentication failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Add CSS animation for the background
  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      @keyframes gradient {
        0% {
          background-position: 0% 50%;
        }
        50% {
          background-position: 100% 50%;
        }
        100% {
          background-position: 0% 50%;
        }
      }
      
      .animated-bg {
        background: linear-gradient(-45deg, #1E1E1E, #2d2d2d, #3d1d5d, #2d2d2d);
        background-size: 400% 400%;
        animation: gradient 15s ease infinite;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animated-bg p-6">
      <div className="w-full max-w-md bg-[#1E1E1E]/80 p-8 rounded-3xl backdrop-blur-md border-2 border-[#b494ff]/30">
        <div className="flex items-center justify-center mb-8">
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#b494ff] to-[#ffee00] tracking-tight">
            Image Generator
          </h1>
        </div>

        <div className="mb-6 text-center text-white/80">
          <p>Enter the password to access the application</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col items-center space-y-6"
        >
          <div className="relative w-full mb-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full py-4 px-5 bg-[#2A2A2A] text-white rounded-full border-2 border-[#b494ff] focus:border-[#ffee00] outline-none transition-all"
              required
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm font-medium mt-2 text-center w-full">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 bg-[#ffee00] text-black font-bold rounded-full mb-4 hover:bg-[#ffee00]/90 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#ffee00]/20 transform hover:scale-[1.02]"
          >
            {isLoading ? "Verifying..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}
