import { NextRequest, NextResponse } from "next/server";
import { OpenAI } from "openai";
import { getLocationFromCoordinates } from "../geocode/route";

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
    // Get location name from coordinates directly using the imported function
    const locationInfo = await getLocationFromCoordinates(lat, lon);
    const locationName = locationInfo.best_name;
    const country = locationInfo.country || "Unknown country";
    console.log(`Location identified as: ${locationName}, ${country}`);

    try {
      // Construct the MET Norway API URL
      // MET Norway API requires coordinates to be provided directly in the URL path
      const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}${
        altitude ? `&altitude=${altitude}` : ""
      }`;
      console.log(`Fetching weather from: ${url}`);

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
              content: `Create a vivid, short description (50-60 words) of the current weather in ${locationName}, ${country}. Temperature: ${
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
        creativeDescription = `Weather in ${locationName}, ${country}: ${
          weather.temperature
        }°C, ${weather.symbol.replace(/_/g, " ")}.`;
      }

      // Add the creative description to the weather data
      weather.description = creativeDescription;

      // Return the processed weather data with location info
      return NextResponse.json({
        success: true,
        location: locationName,
        country: country,
        weather,
      });
    } catch (weatherError: unknown) {
      // If the MET Norway API fails, we'll create a fallback response with just the location
      console.error("Error with MET Norway weather API:", weatherError);

      // Create a fallback weather description using OpenAI
      let fallbackDescription = "";
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content:
                "You are a creative travel writer providing vivid, evocative descriptions of locations for a photographer. Keep descriptions concise (50-60 words) but vivid. Focus on sensory details, lighting conditions, and atmospheric qualities that would impact photography. You should describe generic pleasant weather conditions since actual weather data is unavailable.",
            },
            {
              role: "user",
              content: `Create a vivid, short description (50-60 words) of typical pleasant weather conditions in ${locationName}, ${country}. Focus on how this creates appealing lighting conditions, atmospheric effects, and visual elements that would make for good photography.`,
            },
          ],
          temperature: 0.7,
          max_tokens: 150,
        });

        fallbackDescription = completion.choices[0].message.content || "";
        console.log("Generated fallback description:", fallbackDescription);
      } catch (error: unknown) {
        console.error("Error generating fallback description:", error);
        fallbackDescription = `A pleasant day in ${locationName}, ${country} with good conditions for photography.`;
      }

      // Return a response with the location name and fallback weather
      return NextResponse.json({
        success: true,
        location: locationName,
        country: country,
        weather: {
          temperature: 20, // A reasonable default temperature
          description: "pleasant conditions",
          symbol: "partlycloudy_day",
          windSpeed: 2,
          cloudCover: 30,
          precipitation: 0,
          creativeDescription: fallbackDescription,
        },
      });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error with geocoding API:", error);
    return NextResponse.json(
      {
        error: `Failed to fetch location and weather data: ${errorMessage}`,
        // Still try to provide a valid response structure even in error cases
        location: "Unknown location",
        country: "Unknown country",
        weather: {
          temperature: 20,
          description: "unknown conditions",
          symbol: "partlycloudy_day",
          windSpeed: 2,
          cloudCover: 30,
          precipitation: 0,
          creativeDescription:
            "A day with generally pleasant conditions, suitable for outdoor photography.",
        },
      },
      { status: 500 }
    );
  }
}
