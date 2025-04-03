import { NextRequest, NextResponse } from "next/server";
import { getLocationFromCoordinates } from "../utils/geocoding";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");

  if (!lat || !lon) {
    return NextResponse.json(
      { error: "Latitude and longitude are required" },
      { status: 400 }
    );
  }

  try {
    const locationInfo = await getLocationFromCoordinates(lat, lon);

    return NextResponse.json({
      success: true,
      location: locationInfo,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error with reverse geocoding:", error);
    return NextResponse.json(
      {
        error: `Failed to geocode: ${errorMessage}`,
        location: {
          best_name: "Unknown location",
        },
      },
      { status: 500 }
    );
  }
}
