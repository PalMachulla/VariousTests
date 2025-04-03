import { NextRequest, NextResponse } from "next/server";

// Using the same hardcoded password as in middleware.ts
const APP_PASSWORD = "image123";

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    console.log("Login attempt received");

    // Check if the password is correct
    if (password === APP_PASSWORD) {
      console.log("Login successful");

      // Create a response with success message
      const response = NextResponse.json({ success: true });

      // Set a cookie for authentication
      response.cookies.set({
        name: "auth_session",
        value: APP_PASSWORD,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 7, // 1 week
        path: "/",
        sameSite: "strict",
      });

      return response;
    }

    // If the password is incorrect, return an error
    console.log("Login failed: Invalid password");
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  } catch (error) {
    console.error("Login error:", error);

    return NextResponse.json(
      { error: "An error occurred during authentication" },
      { status: 500 }
    );
  }
}
