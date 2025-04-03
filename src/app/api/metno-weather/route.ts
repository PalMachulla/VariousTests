import { NextRequest, NextResponse } from "next/server";
import { OpenAI } from "openai";

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

// User-Agent is required by the MET Norway API
const USER_AGENT = "GeoImageGenerator/1.0 github.com/PalMachulla/VariousTests";

// Define interface for weather data to avoid linter errors
interface WeatherData {
  temperature: number;
  windSpeed: number;
  windDirection: number;
  humidity: number;
  pressure: number;
  cloudCover: number;
  precipitation: number;
  symbol: string;
  description?: string; // Optional since it's added later
}

// Helper function to get city name from coordinates using our geocoding API
async function getCityFromCoordinates(
  lat: string,
  lon: string
): Promise<string> {
  try {
    // Use our internal geocoding API endpoint
    const geocodeUrl = `${
      process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : ""
    }/api/geocode?lat=${lat}&lon=${lon}`;

    const response = await fetch(geocodeUrl, {
      headers: {
        "User-Agent": USER_AGENT,
      },
    });

    if (!response.ok) {
      throw new Error(`Geocoding API error (${response.status})`);
    }

    const data = await response.json();
    return data.location.best_name || "Unknown location";
  } catch (error: unknown) {
    console.error("Error fetching location name:", error);
    return "Unknown location";
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");
  const altitude = searchParams.get("altitude");

  if (!lat || !lon) {
    return NextResponse.json(
      { error: "Latitude and longitude are required" },
      { status: 400 }
    );
  }

  try {
    // Get location name from coordinates
    const locationName = await getCityFromCoordinates(lat, lon);

    // Construct the MET Norway API URL
    // MET Norway API requires coordinates to be provided directly in the URL path
    const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}${
      altitude ? `&altitude=${altitude}` : ""
    }`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
      },
    });

    if (!response.ok) {
      throw new Error(`MET Norway API error (${response.status})`);
    }

    const data = await response.json();

    // Extract relevant weather information from the response
    // The MET Norway API provides timeseries data with forecasts for different time points
    const currentData = data.properties.timeseries[0].data;
    const details = currentData.instant.details;
    const nextHour = currentData.next_1_hours;

    const weather: WeatherData = {
      temperature: details.air_temperature,
      windSpeed: details.wind_speed,
      windDirection: details.wind_from_direction,
      humidity: details.relative_humidity,
      pressure: details.air_pressure_at_sea_level,
      cloudCover: details.cloud_area_fraction,
      precipitation: nextHour ? nextHour.details.precipitation_amount : 0,
      symbol: nextHour ? nextHour.summary.symbol_code : "unknown",
    };

    // Generate a creative weather description using OpenAI
    let creativeDescription = "";
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "You are a creative travel writer providing vivid, evocative descriptions of weather and locations for a photographer. Keep descriptions concise (50-60 words) but vivid. Focus on sensory details, lighting conditions, and atmospheric qualities that would impact photography. Include references to how the weather affects the location's appearance and mood.",
          },
          {
            role: "user",
            content: `Create a vivid, short description (50-60 words) of the current weather in ${locationName}. Temperature: ${
              weather.temperature
            }°C, Wind: ${weather.windSpeed} m/s, Cloud cover: ${
              weather.cloudCover
            }%, Precipitation: ${
              weather.precipitation
            } mm, Weather symbol: ${weather.symbol.replace(
              /_/g,
              " "
            )}. Focus on how this weather creates specific lighting conditions, atmospheric effects, and visual elements that would impact photography.`,
          },
        ],
        temperature: 0.7,
        max_tokens: 150,
      });

      creativeDescription = completion.choices[0].message.content || "";
      console.log("Generated creative description:", creativeDescription);
    } catch (error: unknown) {
      console.error("Error generating creative description:", error);
      creativeDescription = `Weather in ${locationName}: ${
        weather.temperature
      }°C, ${weather.symbol.replace(/_/g, " ")}.`;
    }

    // Add the creative description to the weather data
    weather.description = creativeDescription;

    // Return the processed weather data
    return NextResponse.json({
      success: true,
      location: locationName,
      weather,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error with weather API:", error);
    return NextResponse.json(
      { error: `Failed to fetch weather data: ${errorMessage}` },
      { status: 500 }
    );
  }
}
