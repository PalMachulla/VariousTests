import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// Helper function to get the current time of day
function getTimeOfDay(): string {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 8) return "Early morning";
  if (hour >= 8 && hour < 12) return "Morning";
  if (hour >= 12 && hour < 14) return "Midday";
  if (hour >= 14 && hour < 17) return "Afternoon";
  if (hour >= 17 && hour < 20) return "Evening";
  if (hour >= 20 && hour < 23) return "Night";
  return "Late night";
}

// Helper function to get lighting description based on time of day and weather
function getLightingDescription(timeOfDay: string, cloudCover: number): string {
  const cloudy = cloudCover > 50;

  switch (timeOfDay) {
    case "Early morning":
      return cloudy
        ? "diffused dawn light through clouds"
        : "warm golden sunrise light";
    case "Morning":
      return cloudy
        ? "soft diffused morning light"
        : "bright morning sunlight with long shadows";
    case "Midday":
      return cloudy
        ? "even, diffused daylight"
        : "harsh direct overhead sunlight";
    case "Afternoon":
      return cloudy
        ? "soft even light through cloud cover"
        : "warm directional sunlight";
    case "Evening":
      return cloudy
        ? "muted twilight ambience"
        : "golden hour light with warm tones";
    case "Night":
      return cloudy
        ? "ambient urban light reflecting off cloud cover"
        : "clear night with moonlight and city lights";
    case "Late night":
      return cloudy
        ? "minimal ambient light with cloud cover"
        : "dark setting with subtle artificial lighting";
    default:
      return "natural lighting";
  }
}

export async function POST(request: NextRequest) {
  try {
    const { location, country, weather, subject, coordinates, basePrompt } =
      await request.json();

    if (!location || !weather || !subject) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // Get time of day and lighting information
    const timeOfDay = getTimeOfDay();
    const lightingConditions = getLightingDescription(
      timeOfDay,
      weather.cloudCover || 0
    );

    // Preserve the Fujifilm style requirements
    const fujifilmStyle = `Style: Shot on Fujifilm GFX 50S medium format camera with GF 120mm F4 R LM OIS WR Macro lens.
    Fujifilm's signature color science with natural skin tone reproduction. Medium format sensor rendering with exceptional detail and subtle tonal gradations.
    Technical settings: f/14 for deep focus across frame, 1/500 sec shutter speed for crisp detail, ISO 640 maintaining clean image quality with medium format noise characteristics.
    Fujifilm's characteristic color rendition emphasizing warm tones while maintaining highlight detail. 4:3 medium format aspect ratio.
    Gentle falloff in corners typical of GF lens lineup. Sharp detail retention with medium format depth.
    Subtle micro-contrast typical of GFX system. The text on signs must be perfectly legible and clear.`;

    // OpenAI setup
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Create a detailed prompt for OpenAI
    const openaiPrompt = `
    Create a detailed photography prompt for an image taken in ${location}, ${country} during ${timeOfDay.toLowerCase()} with ${lightingConditions}.
    
    Current weather conditions:
    - Temperature: ${weather.temp}°C
    - Weather description: ${weather.description}
    - Cloud cover: ${weather.cloudCover || "unknown"}%
    - Wind speed: ${weather.windSpeed || "light"} m/s
    
    The image should feature ${
      subject === "portrait"
        ? "a portrait of a local person"
        : subject === "humans"
        ? "people engaged in activities"
        : "a natural landscape scene"
    } that reflects:
    
    1. The local environment and ${timeOfDay.toLowerCase()} lighting conditions (${lightingConditions})
    2. Weather-appropriate clothing and activities (e.g., ${
      weather.temp > 25
        ? "light summer clothes, perhaps with sunglasses and sun protection"
        : weather.temp > 15
        ? "comfortable light layers suited for mild conditions"
        : weather.temp > 5
        ? "jackets and light cold-weather gear"
        : "heavy winter clothing, scarves, gloves, etc."
    })
    3. Cultural elements specific to ${country}
    4. Authentic details that would be found in ${location}
    
    Include "Dentsu" and "${location.toUpperCase()}" text visible on signs or in the environment - these must be clearly readable.
    
    GPS coordinates: ${coordinates.latitude.toFixed(
      4
    )}, ${coordinates.longitude.toFixed(4)}
    
    The prompt should be detailed and vivid, focusing on the scene, environment, lighting, and people's appearance/activities if applicable. DO NOT include any technical camera settings in your prompt.
    `;

    // Generate an enhanced prompt with OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are a photography expert and prompt engineer who creates detailed, vivid descriptions for image generation.",
        },
        {
          role: "user",
          content: openaiPrompt,
        },
      ],
      temperature: 0.8,
      max_tokens: 500,
    });

    const enhancedDescription = completion.choices[0].message.content;

    // Combine the AI-generated prompt with technical requirements
    const finalPrompt = `${enhancedDescription}\n\n${fujifilmStyle}`;

    // Return the enhanced prompt along with metadata
    return NextResponse.json({
      prompt: finalPrompt,
      meta: {
        timeOfDay,
        lightingConditions,
        location,
        country,
        subject,
      },
    });
  } catch (error) {
    console.error("Error generating enhanced prompt:", error);
    return NextResponse.json(
      { error: "Failed to generate enhanced prompt" },
      { status: 500 }
    );
  }
}
