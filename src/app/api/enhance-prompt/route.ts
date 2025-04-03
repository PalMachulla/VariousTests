import { NextRequest, NextResponse } from "next/server";
import { OpenAI } from "openai";

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

export async function POST(request: NextRequest) {
  try {
    const { location, country, weather, subject, coordinates, basePrompt } =
      await request.json();

    if (!location || !weather || !subject) {
      return NextResponse.json(
        { error: "Location, weather, and subject type are required" },
        { status: 400 }
      );
    }

    // Preserve the Fujifilm style requirements
    const fujifilmStyle = `Style: Shot on Fujifilm GFX 50S medium format camera with GF 120mm F4 R LM OIS WR Macro lens. 
Fujifilm's signature color science with natural skin tone reproduction. Medium format sensor rendering with exceptional detail and subtle tonal gradations. 
Natural outdoor lighting creating directional soft illumination. Technical settings: f/14 for deep focus across frame, 1/500 sec shutter speed for crisp detail, 
ISO 640 maintaining clean image quality with medium format noise characteristics. Fujifilm's characteristic color rendition emphasizing warm tones while maintaining highlight detail. 
4:3 medium format aspect ratio. Gentle falloff in corners typical of GF lens lineup. Sharp detail retention with medium format depth. Subtle micro-contrast typical of GFX system.`;

    let prompt = "";
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are a professional photography director who crafts detailed, vivid photography prompts. 
Your specialty is creating prompts that precisely reflect weather conditions, location specifics, and cultural elements.
You seamlessly incorporate environmental factors into clothing choices, postures, activities, and overall scene composition.
DO NOT include any technical camera settings or style guidelines in your response - those will be added separately.
ALWAYS end your response with text saying "The signs/text showing 'Dentsu' and '[LOCATION NAME]' must be clear and legible."
Focus on describing the visual scene, clothing, activities, lighting, and atmosphere only.`,
          },
          {
            role: "user",
            content: `Create a detailed photography prompt for a location-based lifestyle magazine cover.

LOCATION: ${location}, ${country}
COORDINATES: ${coordinates?.latitude?.toFixed(4) || "Unknown"}, ${
              coordinates?.longitude?.toFixed(4) || "Unknown"
            }
SUBJECT TYPE: ${subject}
WEATHER CONDITIONS: 
- Temperature: ${
              typeof weather.temp === "number"
                ? Math.round(weather.temp)
                : weather.temp
            }°C
- Weather description: ${weather.description}
- Cloud cover: ${weather.cloudCover || "Unknown"}%
- Wind speed: ${weather.windSpeed || "Unknown"} m/s
- Creative weather insight: ${weather.creativeDescription || "Unknown"}

ADDITIONAL REQUIREMENTS:
1. The image should prominently feature the location name "${location.toUpperCase()}" and the word "Dentsu" on signs or direction markers.
2. Clothing and activities should realistically reflect the weather conditions described.
3. If sunny, include appropriate elements like sunglasses, shade-seeking, or sun-drenched lighting.
4. If cold, show appropriate clothing layers and weather-appropriate behavior.
5. Capture authentic cultural elements specific to ${country} in clothing, architecture, or activities.

Based on the subject type "${subject}", focus on:
${
  subject === "portrait"
    ? "- A striking close-up of a local person with the location visible in the background"
    : ""
}
${
  subject === "humans"
    ? "- Small groups of locals engaged in authentic activities typical for this location and weather"
    : ""
}
${
  subject === "nature"
    ? "- The natural landscape with environmental features characteristic of this region, with signage or markers showing the location name"
    : ""
}

Make the prompt vivid, detailed, and authentic to the location and conditions.`,
          },
        ],
        temperature: 0.8,
        max_tokens: 500,
      });

      prompt = completion.choices[0].message.content || "";
      console.log("Generated enhanced prompt:", prompt);
    } catch (error: unknown) {
      console.error("Error generating enhanced prompt:", error);
      // Fall back to the base prompt if OpenAI fails
      return NextResponse.json({
        prompt: basePrompt || "Failed to generate an enhanced prompt",
      });
    }

    // Combine the AI-crafted prompt with the required Fujifilm style
    const enhancedPrompt = `${prompt}\n\n${fujifilmStyle}`;

    return NextResponse.json({
      prompt: enhancedPrompt,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in enhance-prompt API:", error);
    return NextResponse.json(
      { error: `Failed to enhance prompt: ${errorMessage}` },
      { status: 500 }
    );
  }
}
