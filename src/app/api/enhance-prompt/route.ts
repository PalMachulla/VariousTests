import { NextRequest, NextResponse } from "next/server";
import { Configuration, OpenAIApi } from "openai-edge";

// Configure OpenAI API
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Helper function to make GPT API calls
async function callGPT(content: string): Promise<any> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  try {
    const response = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are a professional image prompt engineer. Create concise, focused prompts that work well with AI image generators. Keep prompts direct and actionable, focusing on visual elements.",
        },
        { role: "user", content },
      ],
      temperature: 0.7,
      max_tokens: 600,
    });

    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (error: any) {
    console.error("Error calling OpenAI API:", error);
    throw new Error(
      `Failed to generate enhanced prompt: ${error.message || "Unknown error"}`
    );
  }
}

// Time of day detection based on time and location
function getTimeOfDay(localTime: Date): string {
  const hour = localTime.getHours();

  if (hour >= 5 && hour < 8) return "Early Morning";
  if (hour >= 8 && hour < 12) return "Morning";
  if (hour >= 12 && hour < 14) return "Midday";
  if (hour >= 14 && hour < 17) return "Afternoon";
  if (hour >= 17 && hour < 20) return "Evening";
  if (hour >= 20 && hour < 22) return "Dusk";
  return "Night";
}

// Determine lighting conditions based on time of day and weather
function getLightingConditions(timeOfDay: string, weather: any): string {
  const cloudCover = weather.cloudCover || 0;
  const isOvercast = cloudCover > 75;
  const isCloudy = cloudCover > 40 && cloudCover <= 75;
  const isClear = cloudCover <= 40;

  switch (timeOfDay) {
    case "Early Morning":
      if (isOvercast) return "Soft, diffused dawn light through clouds";
      return "Golden dawn light, long shadows";
    case "Morning":
      if (isOvercast) return "Soft, even morning light";
      if (isCloudy) return "Partially diffused morning light with some shadows";
      return "Clear, directional morning light with defined shadows";
    case "Midday":
      if (isOvercast) return "Flat, evenly diffused light";
      if (isCloudy) return "Partially diffused midday light";
      return "Harsh, direct overhead sunlight with strong shadows";
    case "Afternoon":
      if (isOvercast) return "Soft, even afternoon light";
      if (isCloudy) return "Partially diffused warm afternoon light";
      return "Warm directional afternoon light with medium-length shadows";
    case "Evening":
      if (isOvercast) return "Subdued, even evening light";
      if (isCloudy) return "Partially diffused golden hour light";
      return "Golden hour light with long, warm shadows";
    case "Dusk":
      if (isOvercast) return "Dim, even blue hour light";
      return "Deep blue hour light with fading warm tones";
    case "Night":
      return weather.description?.includes("clear")
        ? "Moon and starlight with deep shadows"
        : "Low ambient night light";
    default:
      return "Natural daylight";
  }
}

// Get additional instructions based on subject type
function getSubjectSpecificInstructions(subject: string): string {
  switch (subject) {
    case "humans":
      return `
      IMPORTANT COMPOSITION GUIDELINES:
      - Position people in groups FACING the camera or at 3/4 angles to show their faces
      - Capture lively interactions, conversations, and authentic social connections
      - Show clear facial expressions and emotional engagement between people
      - Frame the scene to focus on the front or side of people, NOT their backs
      - AVOID showing people walking away from the camera
      - Prioritize scenes where people are actively engaging with each other rather than just moving through the space
      - Create a sense of community and social interaction that feels authentic to the location
      `;
    case "portrait":
      return `
      IMPORTANT COMPOSITION GUIDELINES:
      - Focus on capturing one subject's face with clear visibility
      - Ensure good lighting on facial features while maintaining natural look
      - Create depth with slight background blur while keeping subject sharp
      - Frame to include some environmental context but keep focus on the person
      `;
    default:
      return "";
  }
}

export async function POST(request: NextRequest) {
  // Parse request body
  let requestData;
  try {
    requestData = await request.json();
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const { location, country, weather, subject, coordinates, basePrompt } =
    requestData;

  if (!location || !weather || !subject) {
    return NextResponse.json(
      {
        error:
          "Missing required parameters: location, weather, and subject are required",
      },
      { status: 400 }
    );
  }

  try {
    // Get current time at the specified location
    const localTime = new Date();
    // In a real app, you might adjust for timezone based on coordinates

    // Determine time of day and lighting conditions
    const timeOfDay = getTimeOfDay(localTime);
    const lightingConditions = getLightingConditions(timeOfDay, weather);

    // Build a detailed context prompt for GPT
    const promptEngineering = `
Create a concise, compelling image generation prompt (max 200 words) for a photo in ${location}, ${
      country || ""
    }.

Location details:
- Place: ${location}, ${country || ""}
- Weather: ${weather.description || "unknown"}, ${weather.temp || ""}°C
- Time of day: ${timeOfDay}
- Lighting: ${lightingConditions}
- Weather insight: ${weather.creativeDescription || ""}

Subject: ${subject} who MUST be actively using a mobile phone (taking photos, checking phone, showing screen to others, etc.)

IMPORTANT GUIDELINES:
1. KEEP IT CONCISE - no more than 200 words total
2. Focus on VISUAL elements only
3. MOBILE PHONE must be prominently featured and being actively used
4. Include a visible sign with "Dentsu" and "${location.toUpperCase()}"
5. Maintain a professional photography style (Fujifilm medium format camera aesthetic)
6. Specify mood, composition, focal length, lighting, and key visual elements
7. Don't use words like "prompt" or "image"

Base your response on this prompt structure but improve it:
${basePrompt}
`;

    // Call GPT to generate an enhanced prompt
    const enhancedPromptText = await callGPT(promptEngineering);

    // Return the enhanced prompt along with metadata
    return NextResponse.json({
      prompt: enhancedPromptText,
      meta: {
        timeOfDay,
        lightingConditions,
        location,
        coordinates,
      },
    });
  } catch (error: any) {
    console.error("Error in /api/enhance-prompt:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate enhanced prompt" },
      { status: 500 }
    );
  }
}
