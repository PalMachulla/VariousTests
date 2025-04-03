// src/app/page.tsx
"use client"; // This component uses client-side features (hooks, browser APIs)

import { useState, useEffect } from "react";
import Image from "next/image"; // Use Next.js Image component

interface LocationData {
  latitude: number;
  longitude: number;
}

interface WeatherData {
  city: string;
  description: string;
  temp: number | string; // Can be number or 'unknown'
  country: string;
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

export default function Home() {
  const [status, setStatus] = useState<string>(
    'Ready. Click "Generate Prompt" to begin.'
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [prompt, setPrompt] = useState<string>("");
  const [predictionId, setPredictionId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [showFetchButton, setShowFetchButton] = useState<boolean>(false);

  // Use error for conditional display in the UI
  const hasError = Boolean(error);

  // Interval timer for polling Replicate status
  const [pollingIntervalId, setPollingIntervalId] =
    useState<NodeJS.Timeout | null>(null);

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

  const handleGetLocation = (): Promise<LocationData> => {
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

  const handleGetWeather = async (loc: LocationData): Promise<WeatherData> => {
    updateStatus("Fetching weather data...");
    try {
      const response = await fetch(
        `/api/weather?lat=${loc.latitude}&lon=${loc.longitude}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch weather");
      }

      updateStatus(
        `Weather for ${data.city}: ${data.description}, ${data.temp}°C`
      );
      setWeather(data);
      return data;
    } catch (error: unknown) {
      // Create default weather data with unknown values
      updateStatus("Could not fetch weather data, using default values.");
      const defaultWeather: WeatherData = {
        city: "Unknown location",
        country: "",
        description: "unknown conditions",
        temp: "unknown",
      };
      setWeather(defaultWeather);
      return defaultWeather;
    }
  };

  const createAndSetPrompt = (
    loc: LocationData,
    weatherData: WeatherData
  ): string => {
    // --- Customize your prompt structure here! ---
    const generatedPrompt = `Lifestyle magazine cover photo of an outdoor scene in ${
      weatherData.city
    }, with people that resemble the essence of ${
      weatherData.country
    } in the way they dress. Add colorful tones in fabric and clothing. The clothes have clear, fashion style. Around there are street signs or signs with text that says "Dentsu" and "${weatherData.city.toUpperCase()}" printed on in bold. Easy-to-read font. The text appears as location or direction signs. One or more people are actively engaging with their mobile phones - taking selfies, texting, or showing each other content on their screens. The photo shows the locationduring ${
      weatherData.description
    } weather, with a temperature around ${
      typeof weatherData.temp === "number"
        ? Math.round(weatherData.temp)
        : weatherData.temp
    }°C. GPS coordinates: ${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(
      4
    )}. Style: Shot on Fujifilm GFX 50S medium format camera with GF 120mm F4 R LM OIS WR Macro lens. Fujifilm's signature color science with natural skin tone reproduction. Medium format sensor rendering with exceptional detail and subtle tonal gradations. Natural outdoor lighting creating directional soft illumination. Technical settings: f/14 for deep focus across frame, 1/500 sec shutter speed for crisp detail, ISO 640 maintaining clean image quality with medium format noise characteristics. Fujifilm's characteristic color rendition emphasizing warm tones while maintaining highlight detail. 4:3 medium format aspect ratio. Gentle falloff in corners typical of GF lens lineup. Sharp detail retention with medium format depth. Subtle micro-contrast typical of GFX system. The text on clothing must be perfectly legible and clear.`;
    // --- End of customization ---

    setPrompt(generatedPrompt);
    return generatedPrompt;
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
        updateStatus(
          `Image generation started (ID: ${prediction.id}). Status: ${prediction.status}. Checking periodically...`
        );
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
      updateStatus(
        `Manually checking status for prediction ID: ${idToCheck}...`
      );
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

      updateStatus(`Current status [${idToCheck}]: ${prediction.status}`);

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
      // Weather fetch failures are handled internally in handleGetWeather
      const weatherData = await handleGetWeather(loc);
      const generatedPrompt = createAndSetPrompt(loc, weatherData);
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

  return (
    <main className="flex min-h-screen flex-col items-center p-6 md:p-12 lg:p-24 bg-gray-100 text-gray-800">
      <div className="z-10 w-full max-w-4xl items-center justify-between font-mono text-sm flex flex-col gap-8">
        <h1 className="text-3xl md:text-4xl font-bold text-blue-600 mb-6">
          Context Aware Image Generator
        </h1>

        {/* Controls */}
        <div id="controls" className="flex flex-col sm:flex-row gap-4 mb-4">
          <button
            id="generatePromptBtn"
            onClick={handleGenerateClick}
            disabled={isLoading}
            className="px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition duration-200 ease-in-out"
          >
            {isLoading && !imageUrl
              ? "Generating..."
              : "Generate Prompt & Start Image"}
          </button>
          {showFetchButton && (
            <button
              id="fetchImageBtn"
              onClick={() => handleFetchResult(predictionId)} // Explicitly pass current ID for manual fetch
              disabled={isLoading} // Disable if already loading/fetching
              className="px-6 py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition duration-200 ease-in-out"
            >
              {isLoading ? "Checking..." : "Check Status / Fetch Image"}
            </button>
          )}
        </div>

        {/* Status Display */}
        <div
          id="status"
          className={`mt-4 text-center p-3 rounded-md min-h-[50px] w-full max-w-lg ${
            error ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
          }`}
        >
          <p>{status}</p>
        </div>

        {/* Prompt Display */}
        {prompt && (
          <div
            id="prompt-display"
            className="mt-6 p-4 bg-white rounded-lg shadow w-full max-w-lg"
          >
            <h2 className="text-xl font-semibold mb-2 text-gray-700">
              Generated Prompt:
            </h2>
            <textarea
              id="promptText"
              rows={5}
              readOnly
              value={prompt}
              className="w-full p-2 border border-gray-300 rounded bg-gray-50 text-sm font-mono"
            />
          </div>
        )}

        {/* Image Display */}
        {imageUrl && (
          <div
            id="image-display"
            className="mt-6 p-4 bg-white rounded-lg shadow w-full max-w-lg flex flex-col items-center"
          >
            <h2 className="text-xl font-semibold mb-3 text-gray-700">
              Generated Image:
            </h2>
            {/* Use Next.js Image component for optimization */}
            <Image
              id="resultImage"
              src={imageUrl} // The URL from Replicate
              alt="Generated Image based on location and weather"
              width={512} // Provide base width (adjust as needed)
              height={512} // Provide base height (adjust as needed)
              className="rounded-md border border-gray-300"
              priority // Load image faster if it's important
            />
          </div>
        )}
      </div>
    </main>
  );
}
