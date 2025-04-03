// src/app/api/weather/route.ts
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");

  if (!lat || !lon) {
    return NextResponse.json(
      { error: "Latitude and longitude are required" },
      { status: 400 }
    );
  }

  const apiKey = process.env.OPENWEATHERMAP_API_KEY;
  if (!apiKey) {
    console.error("Missing OPENWEATHERMAP_API_KEY environment variable");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const WEATHER_API_URL = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;

  try {
    const response = await fetch(WEATHER_API_URL);
    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ message: "Unknown weather API error" }));
      console.error("Weather API Error:", errorData);
      throw new Error(
        `Weather API error (${response.status}): ${
          errorData.message || response.statusText
        }`
      );
    }
    const data = await response.json();

    const weatherInfo = {
      city: data.name || "Unknown location",
      description: data.weather[0]?.description || "clear sky",
      temp: data.main?.temp ?? "unknown", // Use nullish coalescing
      country: data.sys?.country || "",
    };

    return NextResponse.json(weatherInfo);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error fetching weather:", error);
    return NextResponse.json(
      { error: `Failed to fetch weather: ${errorMessage}` },
      { status: 500 }
    );
  }
}
