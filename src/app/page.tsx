// src/app/page.tsx
"use client"; // This component uses client-side features (hooks, browser APIs)

import { useState, useEffect } from "react";
import Image from "next/image"; // Use Next.js Image component
import dynamic from "next/dynamic";

// Dynamically import the map component to avoid SSR issues with Leaflet
const LocationMap = dynamic(() => import("../components/LocationMap"), {
  ssr: false,
});

interface LocationData {
  latitude: number;
  longitude: number;
  altitude?: number;
  locationName?: string; // Added for storing the location name from geocoding
  // Flag to indicate if location was manually selected on map
  isManuallySet?: boolean;
}

interface WeatherData {
  location?: string;
  city?: string;
  description: string;
  temp: number | string; // Can be number or 'unknown'
  country?: string;
  symbol?: string;
  windSpeed?: number;
  cloudCover?: number;
  precipitation?: number;
  creativeDescription?: string;
}

// Define proper error types
interface ApiError {
  message: string;
  [key: string]: unknown;
}

interface ReplicatePrediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: string[]; // Array of URLs
  error?: any;
  // other fields from Replicate response...
}

// Subject types for different image styles
type SubjectType = "portrait" | "humans" | "nature" | "custom";

export default function Home() {
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [prompt, setPrompt] = useState<string>("");
  const [predictionId, setPredictionId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [showFetchButton, setShowFetchButton] = useState<boolean>(false);
  const [placeholderColor, setPlaceholderColor] = useState<string>("#e0f2f1"); // Default soft teal
  const [useMetNorwayApi, setUseMetNorwayApi] = useState<boolean>(true); // Toggle between APIs
  const [selectedSubject, setSelectedSubject] = useState<SubjectType>("custom");
  const [showCustomPrompt, setShowCustomPrompt] = useState<boolean>(false);

  // Use error for conditional display in the UI
  const hasError = Boolean(error);

  // Interval timer for polling Replicate status
  const [pollingIntervalId, setPollingIntervalId] =
    useState<NodeJS.Timeout | null>(null);

  // Generate random soft color for the placeholder
  useEffect(() => {
    // Generate a soft, pastel color
    const hue = Math.floor(Math.random() * 360); // Random hue
    const pastelColor = `hsl(${hue}, 70%, 90%)`;
    setPlaceholderColor(pastelColor);
  }, []);

  // Clear polling interval on component unmount or when prediction finishes/fails
  useEffect(() => {
    return () => {
      if (pollingIntervalId) {
        clearInterval(pollingIntervalId);
      }
    };
  }, [pollingIntervalId]);

  const clearPolling = () => {
    if (pollingIntervalId) {
      clearInterval(pollingIntervalId);
      setPollingIntervalId(null);
    }
  };

  const updateStatus = (message: string, isError: boolean = false) => {
    console.log(message);
    setStatus(message);
    setError(isError ? message : null);
  };

  // Handle map location changes
  const handleMapLocationChange = (lat: number, lng: number) => {
    if (isLoading) return; // Don't change location while loading

    // Update location with manually set coordinates
    setLocation((prevLocation) => {
      if (!prevLocation)
        return { latitude: lat, longitude: lng, isManuallySet: true };

      // Only update if coordinates actually changed
      if (prevLocation.latitude === lat && prevLocation.longitude === lng) {
        return prevLocation;
      }

      return {
        ...prevLocation,
        latitude: lat,
        longitude: lng,
        isManuallySet: true,
        // Clear previous location name when manually changing location
        locationName: undefined,
      };
    });

    // If we already moved the map and have set coordinates, update the status
    updateStatus(`Location set to: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
  };

  // Modified to use either detected or manually set location
  const handleGetLocation = (): Promise<LocationData> => {
    // If we already have a manually set location, use it
    if (location && location.isManuallySet) {
      return Promise.resolve(location);
    }

    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by your browser."));
        return;
      }
      updateStatus("Requesting location permission...");
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            altitude: position.coords.altitude || undefined,
          };
          updateStatus(
            `Location acquired: ${loc.latitude.toFixed(
              4
            )}, ${loc.longitude.toFixed(4)}`
          );
          setLocation(loc);
          resolve(loc);
        },
        (geoError) => {
          reject(new Error(`Geolocation error: ${geoError.message}`));
        }
      );
    });
  };

  // New function to get location name from coordinates
  const handleGetLocationName = async (
    loc: LocationData
  ): Promise<LocationData> => {
    updateStatus("Determining location name...");
    try {
      const response = await fetch(
        `/api/geocode?lat=${loc.latitude}&lon=${loc.longitude}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to determine location name");
      }

      // Update location with name
      const updatedLoc = {
        ...loc,
        locationName: data.location.best_name,
      };

      updateStatus(`Location identified as: ${updatedLoc.locationName}`);
      setLocation(updatedLoc);
      return updatedLoc;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.warn(`Could not determine location name: ${errorMessage}`);
      // Proceed without location name, the flow shouldn't break
      return loc;
    }
  };

  const handleGetWeather = async (loc: LocationData): Promise<WeatherData> => {
    updateStatus("Fetching weather data...");
    try {
      // Choose which API to use
      const apiUrl = useMetNorwayApi
        ? `/api/metno-weather?lat=${loc.latitude}&lon=${loc.longitude}${
            loc.altitude ? `&altitude=${Math.round(loc.altitude)}` : ""
          }`
        : `/api/weather?lat=${loc.latitude}&lon=${loc.longitude}`;

      const response = await fetch(apiUrl);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch weather");
      }

      let weatherInfo: WeatherData;

      if (useMetNorwayApi) {
        // Format data from MET Norway API
        weatherInfo = {
          location:
            data.location ||
            loc.locationName || // Use geocoded location name if available
            `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`,
          city:
            data.location ||
            loc.locationName || // Use geocoded location name if available
            "Unnamed location",
          country: data.country || "", // Now getting country from the updated API
          temp: data.weather.temperature,
          description: data.weather.symbol.replace(/_/g, " "),
          symbol: data.weather.symbol,
          windSpeed: data.weather.windSpeed,
          cloudCover: data.weather.cloudCover,
          precipitation: data.weather.precipitation,
          creativeDescription: data.weather.creativeDescription, // Creative description from OpenAI
        };

        updateStatus(
          `Weather for ${weatherInfo.city}, ${weatherInfo.country}: ${weatherInfo.temp}°C, ${weatherInfo.description} with creative insight from AI`
        );
      } else {
        // Format data from original weather API
        weatherInfo = {
          city:
            data.city ||
            loc.locationName || // Use geocoded location name if available
            "Unknown location",
          country: data.country || "",
          description: data.description || "unknown conditions",
          temp: data.temp,
        };

        updateStatus(
          `Weather for ${weatherInfo.city}, ${weatherInfo.country}: ${weatherInfo.description}, ${weatherInfo.temp}°C`
        );
      }

      setWeather(weatherInfo);
      return weatherInfo;
    } catch (error: unknown) {
      // Create default weather data with unknown values
      updateStatus("Could not fetch weather data, using default values.");
      const defaultWeather: WeatherData = {
        city: loc.locationName || "Unknown location", // Use geocoded location name if available
        country: "Unknown country",
        description: "unknown conditions",
        temp: "unknown",
      };
      setWeather(defaultWeather);
      return defaultWeather;
    }
  };

  // Get subject description based on selected type
  const getSubjectDescription = (type: SubjectType): string => {
    switch (type) {
      case "portrait":
        return "A striking portrait of a local person with authentic facial expressions and natural lighting. The face is captured with striking detail, showing the character and personality in their eyes.";
      case "humans":
        return "A vibrant scene of people interacting and engaging with each other in a social setting. Small groups facing the camera or angled to show their faces and expressions. People are shown in conversations, laughing, and connecting in authentic ways. Focus on capturing facial expressions, emotions, and the community atmosphere, avoiding shots from behind or of people walking away.";
      case "nature":
        return "The local landscape dominates the scene, showcasing the environmental features, scenery, and natural elements characteristic of the region. No human presence, focusing entirely on the raw beauty of the location.";
      case "custom":
      default:
        return "People are actively engaging with their mobile phones - taking selfies, texting, or showing each other content on their screens.";
    }
  };

  // The enhanced prompt generation function using OpenAI
  const createAndSetPrompt = async (
    loc: LocationData,
    weatherData: WeatherData
  ): Promise<string> => {
    // Start with a fallback prompt in case the enhancement API fails
    const subjectDescription = getSubjectDescription(selectedSubject);

    const fallbackPrompt = `Lifestyle magazine cover photo of an outdoor scene in ${
      weatherData.city || "a beautiful location"
    }, ${weatherData.country || "unknown country"}. ${
      weatherData.creativeDescription || ""
    } 
    ${subjectDescription}
    Street signs or direction signs that say "Dentsu" and "${(
      weatherData.city || "LOCATION"
    ).toUpperCase()}" in bold, easy-to-read font.
    
    GPS coordinates: ${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}. 
    Style: Shot on Fujifilm GFX 50S medium format camera with GF 120mm F4 R LM OIS WR Macro lens.
    Fujifilm's signature color science with natural skin tone reproduction. Medium format sensor rendering with exceptional detail and subtle tonal gradations.
    Technical settings: f/14 for deep focus across frame, 1/500 sec shutter speed for crisp detail, ISO 640 maintaining clean image quality with medium format noise characteristics.
    Fujifilm's characteristic color rendition emphasizing warm tones while maintaining highlight detail. 4:3 medium format aspect ratio.
    Gentle falloff in corners typical of GF lens lineup. Sharp detail retention with medium format depth.
    Subtle micro-contrast typical of GFX system. The text on signs must be perfectly legible and clear.`;

    updateStatus("Creating magic prompt...");

    try {
      // Call our enhance-prompt API
      const response = await fetch("/api/enhance-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: weatherData.city || "Unknown location",
          country: weatherData.country || "Unknown country",
          weather: {
            temp: weatherData.temp,
            description: weatherData.description,
            cloudCover: weatherData.cloudCover,
            windSpeed: weatherData.windSpeed,
            creativeDescription: weatherData.creativeDescription,
          },
          subject: selectedSubject,
          coordinates: {
            latitude: loc.latitude,
            longitude: loc.longitude,
          },
          basePrompt: fallbackPrompt,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to enhance prompt");
      }

      const data = await response.json();
      const enhancedPrompt = data.prompt;

      // Extract and display time of day information if available
      if (data.meta?.timeOfDay) {
        const timeOfDay = data.meta.timeOfDay;
        const lighting = data.meta.lightingConditions;
        updateStatus(
          `Magic prompt created for ${timeOfDay.toLowerCase()} lighting (${lighting})`
        );
      } else {
        updateStatus("Magic prompt created!");
      }

      console.log("Enhanced prompt:", enhancedPrompt);
      setPrompt(enhancedPrompt);
      return enhancedPrompt;
    } catch (error) {
      console.error("Error enhancing prompt:", error);
      updateStatus("Using standard prompt (enhancement failed)");
      setPrompt(fallbackPrompt);
      return fallbackPrompt;
    }
  };

  // Toggle between weather APIs
  const handleToggleWeatherApi = () => {
    setUseMetNorwayApi(!useMetNorwayApi);
    updateStatus(
      `Using ${!useMetNorwayApi ? "MET Norway" : "Original"} weather API`
    );
  };

  const handleStartGeneration = async (currentPrompt: string) => {
    updateStatus("Sending request to start image generation...");
    setPredictionId(null); // Clear previous ID
    setImageUrl(null); // Clear previous image
    setShowFetchButton(false); // Hide fetch button
    clearPolling(); // Stop any previous polling

    try {
      const response = await fetch("/api/replicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: currentPrompt }),
      });

      // First check if we got a valid JSON response
      let prediction;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        prediction = await response.json();
      } else {
        // Not a JSON response, likely an HTML error page
        const text = await response.text();
        console.error("Non-JSON response:", text.substring(0, 150) + "...");
        throw new Error(
          "Server returned non-JSON response. Check console for details."
        );
      }

      if (!response.ok || prediction.error) {
        throw new Error(
          prediction.error ||
            `Failed to start image generation (Status: ${response.status})`
        );
      }

      if (prediction.id) {
        updateStatus(`Image generation started. Status: ${prediction.status}`);
        setPredictionId(prediction.id);
        setShowFetchButton(true); // Show the manual fetch button
        // Start polling
        const intervalId = setInterval(() => {
          handleFetchResult(prediction.id, true); // Pass true for polling check
        }, 5000); // Poll every 5 seconds
        setPollingIntervalId(intervalId);
      } else {
        throw new Error("Replicate API did not return a prediction ID.");
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      updateStatus(`Image generation error: ${errorMessage}`, true);
      setIsLoading(false);
      console.error("Generation error:", error);
    }
  };

  const handleFetchResult = async (
    idToCheck: string | null = predictionId,
    isPolling: boolean = false
  ) => {
    if (!idToCheck) {
      updateStatus("No active generation task ID found.", true);
      return;
    }

    if (!isPolling) {
      // Only show manual fetch status if not polling
      updateStatus(`Checking status...`);
      setIsLoading(true); // Show loading state for manual fetch
    } else {
      console.log(`Polling status for ${idToCheck}...`);
    }

    try {
      const response = await fetch(`/api/replicate/status?id=${idToCheck}`);

      // First check if we got a valid JSON response
      let prediction;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        prediction = await response.json();
      } else {
        // Not a JSON response, likely an HTML error page
        const text = await response.text();
        console.error(
          "Non-JSON status response:",
          text.substring(0, 150) + "..."
        );
        throw new Error(
          "Server returned non-JSON response. Check console for details."
        );
      }

      if (!response.ok || prediction.error) {
        let errorMsg = `Failed to fetch status: ${
          prediction.error || response.statusText
        }`;
        // Don't clear polling on server errors, maybe temporary
        if (response.status >= 400 && response.status < 500) {
          errorMsg += " Stopping checks.";
          clearPolling();
          setShowFetchButton(false); // Hide button if client error likely permanent
        }
        throw new Error(errorMsg);
      }

      updateStatus(`Status: ${prediction.status}`);

      switch (prediction.status) {
        case "succeeded":
          clearPolling();
          if (prediction.output && prediction.output.length > 0) {
            setImageUrl(prediction.output[0]);
            updateStatus("Image generation successful!");
            setPredictionId(null); // Clear the ID, task finished
            setShowFetchButton(false);
          } else {
            throw new Error(
              "Prediction succeeded but no output URL was found."
            );
          }
          setIsLoading(false);
          break;
        case "failed":
        case "canceled":
          clearPolling();
          throw new Error(
            `Image generation ${prediction.status}. Reason: ${
              prediction.error || "Unknown"
            }`
          );
          // Keep ID for potential debugging? Or clear? Let's clear.
          setPredictionId(null);
          setShowFetchButton(false);
          setIsLoading(false);
          break;
        case "processing":
        case "starting":
          // Status is processing, polling will continue automatically
          if (!isPolling) setIsLoading(false); // Turn off manual loading indicator
          setShowFetchButton(true); // Ensure fetch button stays visible
          break;
        default:
          // Unexpected status
          console.warn(`Unexpected prediction status: ${prediction.status}`);
          if (!isPolling) setIsLoading(false);
          setShowFetchButton(true); // Keep fetch button for manual retry
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      updateStatus(errorMessage, true);
      // Decide whether to stop polling on error
      // clearPolling(); // Uncomment to stop polling on ANY fetch error
      if (!isPolling) setIsLoading(false);
      // Maybe keep fetch button visible on error for retries?
      // setShowFetchButton(false);
    }
  };

  // Handler for subject type buttons - update to immediately create magic prompt if possible
  const handleSubjectSelect = (subjectType: SubjectType) => {
    setSelectedSubject(subjectType);
    updateStatus(`Selected subject type: ${subjectType}`);

    // If we already have location and weather data, update the prompt
    if (location && weather) {
      createAndSetPrompt(location, weather).catch((error) =>
        console.error("Error creating prompt after subject selection:", error)
      );
    }
  };

  // Main function triggered by the primary button
  const handleGenerateClick = async () => {
    setIsLoading(true);
    setError(null);
    setPrompt("");
    setImageUrl(null);
    setPredictionId(null);
    setShowFetchButton(false);
    clearPolling(); // Clear any existing polling

    try {
      const loc = await handleGetLocation();
      // Get location name before fetching weather
      const locWithName = await handleGetLocationName(loc);
      // Weather fetch failures are handled internally in handleGetWeather
      const weatherData = await handleGetWeather(locWithName);
      const generatedPrompt = await createAndSetPrompt(
        locWithName,
        weatherData
      );
      await handleStartGeneration(generatedPrompt);
      // No need to setIsLoading(false) here, handleStartGeneration/polling handles it
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      updateStatus(errorMessage, true);
      setIsLoading(false); // Ensure loading stops on error
      clearPolling(); // Stop polling if setup failed
      setShowFetchButton(false);
    }
  };

  // Handle ReRoll button click - generate new image with same location and weather
  const handleReRoll = async () => {
    setIsLoading(true);
    setError(null);
    setImageUrl(null);
    setPredictionId(null);
    setShowFetchButton(false);
    clearPolling();

    try {
      // We already have location and weather data, so just create a new prompt
      if (location && weather) {
        const generatedPrompt = await createAndSetPrompt(location, weather);
        await handleStartGeneration(generatedPrompt);
      } else {
        // If we somehow don't have location/weather, get it again
        handleGenerateClick();
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      updateStatus(errorMessage, true);
      setIsLoading(false);
      clearPolling();
      setShowFetchButton(false);
    }
  };

  // Handle Set New Location button click - clear the image and show map
  const handleSetNewLocation = () => {
    setImageUrl(null);
    // Keep the existing location data but allow user to change it on the map
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-[#1E1E1E] text-white">
      <div className="w-full max-w-md">
        {/* Header with new vibrant styling */}
        <div className="flex items-center justify-center mb-8">
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#b494ff] to-[#ffee00] tracking-tight">
            Image Generator
          </h1>
        </div>

        {/* Subject type selection buttons - updated with vibrant colors */}
        <div className="flex justify-center gap-4 mb-8">
          <button
            onClick={() => handleSubjectSelect("portrait")}
            className={`flex items-center px-4 py-3 rounded-xl border-2 transition-all ${
              selectedSubject === "portrait"
                ? "border-[#ffee00] bg-[#ffee00] text-black"
                : "border-[#b494ff] hover:bg-[#b494ff]/20"
            }`}
            title="Generate portrait image"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-2"
            >
              <circle cx="12" cy="8" r="5" />
              <path d="M20 21a8 8 0 0 0-16 0" />
            </svg>
            <span className="text-sm font-medium">Portrait</span>
          </button>

          <button
            onClick={() => handleSubjectSelect("humans")}
            className={`flex items-center px-4 py-3 rounded-xl border-2 transition-all ${
              selectedSubject === "humans"
                ? "border-[#ffee00] bg-[#ffee00] text-black"
                : "border-[#b494ff] hover:bg-[#b494ff]/20"
            }`}
            title="Generate image with people"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-2"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span className="text-sm font-medium">Humans</span>
          </button>

          <button
            onClick={() => handleSubjectSelect("nature")}
            className={`flex items-center px-4 py-3 rounded-xl border-2 transition-all ${
              selectedSubject === "nature"
                ? "border-[#ffee00] bg-[#ffee00] text-black"
                : "border-[#b494ff] hover:bg-[#b494ff]/20"
            }`}
            title="Generate landscape or scenery image"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-2"
            >
              <path d="M21 8a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
              <path d="M21 12c0 4.418-3.582 8-8 8s-8-3.582-8-8" />
              <path d="M12 20v-8" />
              <path d="M8 16c1 1 3 2 4 2s3-1 4-2" />
              <path d="M2 12s2 4 5 4" />
              <path d="M22 12s-2 4-5 4" />
            </svg>
            <span className="text-sm font-medium">Scenery</span>
          </button>
        </div>

        {/* Image preview or Map with enhanced styling */}
        <div className="relative w-full aspect-square rounded-3xl mb-6 overflow-hidden border-4 border-[#b494ff] shadow-lg shadow-[#b494ff]/20">
          {imageUrl ? (
            // Show generated image when available
            <Image
              src={imageUrl}
              alt="Generated image"
              fill
              sizes="(max-width: 768px) 100vw, 500px"
              className="object-cover"
              priority
            />
          ) : (
            // Show map when no image is generated
            <div
              className={`h-full w-full ${isLoading ? "animate-pulse" : ""}`}
            >
              <LocationMap
                initialLat={location?.latitude || 59.5225}
                initialLng={location?.longitude || 10.6866}
                onLocationChange={handleMapLocationChange}
              />
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm">
                  <div className="relative w-16 h-16">
                    <div className="absolute top-0 left-0 w-full h-full border-4 border-[#b494ff]/30 rounded-full"></div>
                    <div className="absolute top-0 left-0 w-full h-full border-4 border-t-[#ffee00] rounded-full animate-spin"></div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action buttons */}
        {!imageUrl ? (
          <button
            onClick={handleGenerateClick}
            disabled={isLoading}
            className="w-full py-4 bg-[#ffee00] text-black font-bold rounded-xl mb-4 hover:bg-[#ffee00]/90 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#ffee00]/20 transform hover:scale-[1.02]"
          >
            {location?.isManuallySet
              ? "Generate from Map Location"
              : "Generate from My Location"}
          </button>
        ) : (
          <div className="flex gap-4 mb-4">
            <button
              onClick={handleReRoll}
              disabled={isLoading}
              className="w-1/2 py-4 bg-[#ffee00] text-black font-bold rounded-xl hover:bg-[#ffee00]/90 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#ffee00]/20 transform hover:scale-[1.02]"
            >
              ReRoll
            </button>
            <button
              onClick={handleSetNewLocation}
              disabled={isLoading}
              className="w-1/2 py-4 border-2 border-[#b494ff] text-white font-bold rounded-xl hover:bg-[#b494ff]/20 disabled:bg-gray-800 disabled:border-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02]"
            >
              Set New Location
            </button>
          </div>
        )}

        {showFetchButton && !imageUrl && (
          <button
            onClick={() => handleFetchResult(predictionId)}
            disabled={isLoading}
            className="w-full mt-4 py-3 border-2 border-[#b494ff] text-white font-medium rounded-xl hover:bg-[#b494ff]/20 disabled:border-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed transition-all"
          >
            Check Status
          </button>
        )}
      </div>
    </main>
  );
}
