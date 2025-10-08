import { Logging } from "@/lib/utils/Logging";
import { isMockLLMSettings } from "@/config";
import {
  BrowserOSProvider,
  BrowserOSProvidersConfig,
  BrowserOSProvidersConfigSchema,
  BrowserOSPrefObject,
  BROWSEROS_PREFERENCE_KEYS,
} from "./browserOSTypes";

// Type definitions for chrome.browserOS API
declare global {
  interface ChromeBrowserOS {
    getPref(name: string, callback: (pref: BrowserOSPrefObject) => void): void;
    setPref(
      name: string,
      value: any,
      pageId?: string,
      callback?: (success: boolean) => void
    ): void;
    getAllPrefs(callback: (prefs: BrowserOSPrefObject[]) => void): void;
  }

  interface Chrome {
    browserOS?: ChromeBrowserOS;
  }
}

// Default constants
const DEFAULT_OPENAI_MODEL = "gpt-4o";
const DEFAULT_ANTHROPIC_MODEL = "claude-3-5-sonnet-latest";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b";
const DEFAULT_OLLAMA_MODEL = "qwen3:4b";
const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";

// To use Gemini, set your GEMINI_LLM_API_KEY in the .env file
// The key will be injected at build time and available as process.env.GEMINI_LLM_API_KEY
// Current model: gemini-2.5-flash (fast and efficient)

/**
 * Reads LLM provider settings from BrowserOS preferences
 */
export class LLMSettingsReader {
  private static mockProvider: BrowserOSProvider | null = null;

  /**
   * Set mock provider for testing (DEV MODE ONLY)
   * @param provider - Mock provider configuration
   */
  static setMockProvider(provider: Partial<BrowserOSProvider>): void {
    if (!isMockLLMSettings()) {
      Logging.log(
        "LLMSettingsReader",
        "setMockProvider is only available in development mode",
        "warning"
      );
      return;
    }

    this.mockProvider = {
      ...this.getDefaultBrowserOSProvider(),
      ...provider,
    };
    Logging.log(
      "LLMSettingsReader",
      `Mock provider set: ${provider.name || provider.type}`
    );
  }
  /**
   * Read the default provider configuration
   * @returns Promise resolving to the default BrowserOS provider
   */
  static async read(): Promise<BrowserOSProvider> {
    try {
      Logging.log(
        "LLMSettingsReader",
        "Reading provider settings from BrowserOS preferences"
      );

      // Try chrome.browserOS.getPref API or storage (even in mock mode)
      const provider = await this.readFromBrowserOS();
      if (provider) {
        console.log("[LLMSettingsReader] Provider loaded:", {
          name: provider.name,
          type: provider.type,
          hasApiKey: !!provider.apiKey,
        });
        Logging.log(
          "LLMSettingsReader",
          `Provider loaded: ${provider.name} (${provider.type})`
        );
        return provider;
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      Logging.log(
        "LLMSettingsReader",
        `Failed to read settings: ${errorMessage}`,
        "error"
      );
    }

    // If in mock mode and no stored config, return default Gemini
    if (isMockLLMSettings()) {
      console.log(
        "[LLMSettingsReader] Mock mode: No stored config, using Gemini provider"
      );
      const mockProvider = this.getMockProvider();
      console.log("[LLMSettingsReader] Gemini mock provider:", {
        name: mockProvider.name,
        type: mockProvider.type,
        hasApiKey: !!mockProvider.apiKey,
      });
      return mockProvider;
    }

    // Return default BrowserOS provider if reading fails
    const defaultProvider = this.getDefaultBrowserOSProvider();
    console.log("[LLMSettingsReader] Using default BrowserOS provider");
    Logging.log("LLMSettingsReader", "Using default BrowserOS provider");
    return defaultProvider;
  }

  /**
   * Read all providers configuration
   * @returns Promise resolving to all providers configuration
   */
  static async readAllProviders(): Promise<BrowserOSProvidersConfig> {
    // Always try to read from storage first (even in mock mode)
    try {
      const config = await this.readProvidersConfig();
      if (config) {
        console.log("[LLMSettingsReader] Loaded providers config from storage:", {
          defaultProviderId: config.defaultProviderId,
          providersCount: config.providers.length
        });
        Logging.log(
          "LLMSettingsReader",
          `Loaded ${config.providers.length} providers from storage`
        );
        return config;
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      Logging.log(
        "LLMSettingsReader",
        `Failed to read providers: ${errorMessage}`,
        "error"
      );
    }

    // If in mock mode and no stored config, return default Gemini and Groq providers
    if (isMockLLMSettings()) {
      console.log("[LLMSettingsReader] No stored config, returning mock providers with Gemini as default");
      const geminiProvider = this.getMockProviderByType("gemini");
      const groqProvider = this.getMockProviderByType("groq");

      return {
        defaultProviderId: "mock_gemini", // Gemini is default
        providers: [geminiProvider, groqProvider],
      };
    }

    // Return default config with Gemini and Groq
    const geminiProvider = this.getMockProviderByType("gemini");
    const groqProvider = this.getMockProviderByType("groq");

    return {
      defaultProviderId: "mock_gemini",
      providers: [geminiProvider, groqProvider],
    };
  }

  /**
   * Read from chrome.browserOS.getPref API
   * @returns Promise resolving to the default provider or null
   */
  private static async readFromBrowserOS(): Promise<BrowserOSProvider | null> {
    // Always try chrome.storage.local first in development/mock mode
    try {
      const key = BROWSEROS_PREFERENCE_KEYS.PROVIDERS;
      const stored = await new Promise<any>((resolve) => {
        chrome.storage?.local?.get(key, (result) => resolve(result));
      });
      const raw = stored?.[key];
      if (raw) {
        const config = BrowserOSProvidersConfigSchema.parse(
          typeof raw === "string" ? JSON.parse(raw) : raw
        );
        const def =
          config.providers.find((p) => p.id === config.defaultProviderId) ||
          null;

        if (def) {
          console.log("[LLMSettingsReader] Found provider in storage:", {
            id: def.id,
            name: def.name,
            type: def.type,
            isDefault: def.isDefault,
          });
        }

        return def;
      }
    } catch (e) {
      console.error("[LLMSettingsReader] Error reading from storage:", e);
    }

    // Fallback: try chrome.browserOS.getPref if available
    const browserOS = (chrome as any)?.browserOS as ChromeBrowserOS | undefined;
    if (!browserOS?.getPref) {
      return null;
    }

    return new Promise<BrowserOSProvider | null>((resolve) => {
      browserOS!.getPref(
        BROWSEROS_PREFERENCE_KEYS.PROVIDERS,
        (pref: BrowserOSPrefObject) => {
          if (chrome.runtime.lastError) {
            Logging.log(
              "LLMSettingsReader",
              `Failed to read preference: ${chrome.runtime.lastError.message}`,
              "warning"
            );
            resolve(null);
            return;
          }

          if (!pref?.value) {
            Logging.log(
              "LLMSettingsReader",
              "No providers configuration found",
              "warning"
            );
            resolve(null);
            return;
          }

          try {
            // Parse the JSON string
            const config = BrowserOSProvidersConfigSchema.parse(
              JSON.parse(pref.value)
            );
            // Normalize isDefault flags for safety
            config.providers = config.providers.map((p) => ({
              ...p,
              isDefault: p.id === config.defaultProviderId,
            }));

            // Find and return the default provider
            const defaultProvider = config.providers.find(
              (p) => p.id === config.defaultProviderId
            );

            if (!defaultProvider) {
              Logging.log(
                "LLMSettingsReader",
                "Default provider not found in config",
                "warning"
              );
              resolve(null);
            } else {
              resolve(defaultProvider);
            }
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            Logging.log(
              "LLMSettingsReader",
              `Failed to parse providers config: ${errorMessage}`,
              "error"
            );
            resolve(null);
          }
        }
      );
    });
  }

  /**
   * Read full providers configuration
   * @returns Promise resolving to providers config or null
   */
  private static async readProvidersConfig(): Promise<BrowserOSProvidersConfig | null> {
    // Always try chrome.storage.local first in development/mock mode
    try {
      const key = BROWSEROS_PREFERENCE_KEYS.PROVIDERS;
      const stored = await new Promise<any>((resolve) => {
        chrome.storage?.local?.get(key, (result) => resolve(result));
      });
      const raw = stored?.[key];
      if (raw) {
        return BrowserOSProvidersConfigSchema.parse(
          typeof raw === "string" ? JSON.parse(raw) : raw
        );
      }
    } catch (e) {
      console.error(
        "[LLMSettingsReader] Error reading providers config from storage:",
        e
      );
    }

    // Fallback: try chrome.browserOS.getPref if available
    const browserOS = (chrome as any)?.browserOS as ChromeBrowserOS | undefined;
    if (!browserOS?.getPref) {
      return null;
    }

    return new Promise<BrowserOSProvidersConfig | null>((resolve) => {
      browserOS!.getPref(
        BROWSEROS_PREFERENCE_KEYS.PROVIDERS,
        (pref: BrowserOSPrefObject) => {
          if (chrome.runtime.lastError || !pref?.value) {
            resolve(null);
            return;
          }

          try {
            const config = BrowserOSProvidersConfigSchema.parse(
              JSON.parse(pref.value)
            );
            // Normalize isDefault flags for safety
            config.providers = config.providers.map((p) => ({
              ...p,
              isDefault: p.id === config.defaultProviderId,
            }));
            resolve(config);
          } catch (error) {
            resolve(null);
          }
        }
      );
    });
  }

  /**
   * Get default BrowserOS built-in provider
   * @returns Default BrowserOS provider configuration
   */
  private static getDefaultBrowserOSProvider(): BrowserOSProvider {
    return {
      id: "browseros",
      name: "BrowserOS",
      type: "browseros",
      isDefault: true,
      isBuiltIn: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Get mock provider by type
   * @param type - Provider type key
   * @returns Mock provider configuration
   */
  private static getMockProviderByType(type: string): BrowserOSProvider {
    const mockProviders: Record<string, BrowserOSProvider> = {
      browseros: this.getDefaultBrowserOSProvider(),
      openai: {
        id: "mock_openai",
        name: "Mock OpenAI",
        type: "openai",
        isDefault: true,
        isBuiltIn: false,
        baseUrl: "https://api.openai.com/v1",
        apiKey: "mock-key",
        modelId: DEFAULT_OPENAI_MODEL,
        capabilities: { supportsImages: true },
        modelConfig: { contextWindow: 128000, temperature: 0.7 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      anthropic: {
        id: "mock_anthropic",
        name: "Mock Anthropic",
        type: "anthropic",
        isDefault: true,
        isBuiltIn: false,
        baseUrl: "https://api.anthropic.com",
        apiKey: "mock-key",
        modelId: DEFAULT_ANTHROPIC_MODEL,
        capabilities: { supportsImages: true },
        modelConfig: { contextWindow: 200000, temperature: 0.7 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      gemini: {
        id: "mock_gemini",
        name: "Gemini",
        type: "google_gemini",
        isDefault: true,
        isBuiltIn: false,
        apiKey:
          process.env.GEMINI_LLM_API_KEY ||
          process.env.GEMINI_API_KEY ||
          "mock-key",
        modelId: DEFAULT_GEMINI_MODEL,
        capabilities: { supportsImages: true },
        modelConfig: { contextWindow: 1000000, temperature: 0.7 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      groq: {
        id: "mock_groq",
        name: "Groq",
        type: "groq",
        isDefault: false,
        isBuiltIn: false,
        apiKey: process.env.GROQ_API_KEY || "mock-key",
        modelId: DEFAULT_GROQ_MODEL,
        capabilities: { supportsImages: false },
        modelConfig: { contextWindow: 131072, temperature: 0.7 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      ollama: {
        id: "mock_ollama",
        name: "Mock Ollama",
        type: "ollama",
        isDefault: true,
        isBuiltIn: false,
        baseUrl: DEFAULT_OLLAMA_BASE_URL,
        modelId: DEFAULT_OLLAMA_MODEL,
        capabilities: { supportsImages: false },
        modelConfig: { contextWindow: 4096, temperature: 0.7 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };

    return mockProviders[type] || this.getDefaultBrowserOSProvider();
  }

  /**
   * Get mock provider for development (returns Gemini by default)
   * @returns Mock provider configuration
   */
  private static getMockProvider(): BrowserOSProvider {
    // Return custom mock if set
    if (this.mockProvider) {
      return this.mockProvider;
    }

    // Default to Gemini
    return this.getMockProviderByType("gemini");
  }
}
