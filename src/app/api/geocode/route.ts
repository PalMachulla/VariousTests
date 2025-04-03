import { NextRequest, NextResponse } from "next/server";

// User-Agent is required by most geocoding APIs
const USER_AGENT = "GeoImageGenerator/1.0 github.com/PalMachulla/VariousTests";

// Interface for the location data
export interface LocationInfo {
  city: string | null;
  county: string | null;
  state: string | null;
  country: string | null;
  country_code: string | null;
  postcode: string | null;
  display_name: string | null;
  best_name: string;
}

// Export this function so other API routes can use it directly
export async function getLocationFromCoordinates(
  lat: string,
  lon: string
): Promise<LocationInfo> {
  try {
    // We'll use the free OpenStreetMap Nominatim API for reverse geocoding
    // Note: For production use, please respect their usage policy: https://operations.osmfoundation.org/policies/nominatim/
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept-Language": "en", // Request English results
      },
    });

    if (!response.ok) {
      throw new Error(`Geocoding API error (${response.status})`);
    }

    const data = await response.json();

    // Extract various location data with fallbacks
    const locationInfo: LocationInfo = {
      city:
        data.address?.city ||
        data.address?.town ||
        data.address?.village ||
        data.address?.hamlet ||
        null,
      county: data.address?.county || null,
      state: data.address?.state || data.address?.region || null,
      country: data.address?.country || null,
      country_code: data.address?.country_code || null,
      postcode: data.address?.postcode || null,
      display_name: data.display_name || null,
      // Return the best approximation of the city name
      best_name:
        data.address?.city ||
        data.address?.town ||
        data.address?.village ||
        data.address?.hamlet ||
        data.address?.county ||
        data.address?.state ||
        "Unknown location",
    };

    console.log(
      `Reverse geocoding: Found "${locationInfo.best_name}" at coordinates ${lat},${lon}`
    );

    return locationInfo;
  } catch (error: unknown) {
    console.error("Error with reverse geocoding:", error);
    // Return a default location object with "Unknown location"
    return {
      city: null,
      county: null,
      state: null,
      country: null,
      country_code: null,
      postcode: null,
      display_name: null,
      best_name: "Unknown location",
    };
  }
}

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
