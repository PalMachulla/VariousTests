import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    // Get the password from environment variable or use a default (for development only)
    const correctPassword = process.env.APP_PASSWORD || "securepassword123";

    // Check if the password is correct
    if (password === correctPassword) {
      // Create a response with success message
      const response = NextResponse.json({ success: true });

      // Set a cookie for authentication
      response.cookies.set({
        name: "auth_session",
        value: correctPassword,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 7, // 1 week
        path: "/",
        sameSite: "strict",
      });

      return response;
    }

    // If the password is incorrect, return an error
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  } catch (error) {
    console.error("Login error:", error);

    return NextResponse.json(
      { error: "An error occurred during authentication" },
      { status: 500 }
    );
  }
}
