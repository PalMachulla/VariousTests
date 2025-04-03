import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// User-Agent is required by MET Norway API
const USER_AGENT = "GeoImageGenerator/1.0 github.com/PalMachulla/VariousTests";

// Format for ISO 8601 date that MET Norway API expects
function formatDate(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");
  const altitude = searchParams.get("altitude") || "0"; // Default to sea level if not provided

  if (!lat || !lon) {
    return NextResponse.json(
      { error: "Latitude and longitude are required" },
      { status: 400 }
    );
  }

  try {
    // Fetch data from MET Norway API
    const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}&altitude=${altitude}`;
    console.log(`Fetching weather data from: ${url}`);

    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("MET Norway API Error:", errorText);
      throw new Error(
        `MET Norway API error (${response.status}): ${errorText}`
      );
    }

    const weatherData = await response.json();

    // Extract relevant weather information
    const currentWeather = weatherData.properties.timeseries[0];
    const details = currentWeather.data.instant.details;
    const nextHour = currentWeather.data.next_1_hours || {};

    // Collect weather parameters
    const weatherInfo = {
      temperature: details.air_temperature, // Temperature in Celsius
      humidity: details.relative_humidity, // Humidity in %
      windSpeed: details.wind_speed, // Wind speed in m/s
      windDirection: details.wind_from_direction, // Wind direction in degrees
      cloudCover: details.cloud_area_fraction, // Cloud cover in %
      pressure: details.air_pressure_at_sea_level, // Pressure at sea level in hPa
      precipitation: nextHour.details?.precipitation_amount || 0, // Precipitation in mm/h
      symbol: nextHour.summary?.symbol_code || "clearsky_day", // Weather symbol code
      location: {
        latitude: parseFloat(lat),
        longitude: parseFloat(lon),
        altitude: parseInt(altitude),
      },
    };

    // Use OpenAI to generate a creative weather description
    const prompt = `
      Based on the following weather data:
      - Temperature: ${weatherInfo.temperature}°C
      - Wind speed: ${weatherInfo.windSpeed} m/s
      - Wind direction: ${weatherInfo.windDirection}° 
      - Cloud cover: ${weatherInfo.cloudCover}%
      - Precipitation: ${weatherInfo.precipitation} mm/h
      - Weather symbol: ${weatherInfo.symbol}
      
      Generate a creative, descriptive paragraph about how this weather would affect the atmosphere, 
      light conditions, and mood in a photograph. Include specific details about:
      1. The quality of light (harsh, soft, golden, etc.)
      2. The atmosphere (crisp, humid, misty, etc.)
      3. What kind of clothing would be appropriate
      4. How the weather affects the visual elements (reflections, shadows, etc.)
      
      Keep your response under 100 words and focus on visual aspects for photography.
    `;

    console.log("Generating creative weather description with OpenAI...");
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are a creative photography assistant who understands how weather affects photographic conditions.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    const creativeDescription =
      completion.choices[0].message.content?.trim() ||
      "Weather conditions affect the scene.";

    // Extract the city/place name from reverse geocoding if needed
    // For now, we'll just use the coordinates as a placeholder
    const locationName = `${lat},${lon}`;

    // Prepare the final response
    const weatherResponse = {
      // Basic location info
      location: locationName,
      coordinates: {
        lat: parseFloat(lat),
        lon: parseFloat(lon),
      },

      // Weather data
      weather: {
        temperature: weatherInfo.temperature,
        description: creativeDescription,
        symbol: weatherInfo.symbol,
        windSpeed: weatherInfo.windSpeed,
        cloudCover: weatherInfo.cloudCover,
        precipitation: weatherInfo.precipitation,
      },

      // Raw data for debugging or advanced use
      raw: weatherInfo,
    };

    return NextResponse.json(weatherResponse);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error fetching or processing weather:", error);
    return NextResponse.json(
      { error: `Failed to fetch weather: ${errorMessage}` },
      { status: 500 }
    );
  }
}
