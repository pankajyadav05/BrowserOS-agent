import { MessageType } from '@/lib/types/messaging'
import { PortMessage } from '@/lib/runtime/PortMessaging'
import { LLMSettingsReader } from '@/lib/llm/settings/LLMSettingsReader'
import { LangChainProvider } from '@/lib/llm/LangChainProvider'
import { BrowserOSProvidersConfigSchema, BROWSEROS_PREFERENCE_KEYS } from '@/lib/llm/settings/browserOSTypes'
import { Logging } from '@/lib/utils/Logging'

/**
 * Handles LLM provider configuration messages:
 * - GET_LLM_PROVIDERS: Get current provider configuration
 * - SAVE_LLM_PROVIDERS: Save provider configuration
 */
export class ProvidersHandler {
  private lastProvidersConfigJson: string | null = null

  /**
   * Handle GET_LLM_PROVIDERS message
   */
  async handleGetProviders(
    message: PortMessage,
    port: chrome.runtime.Port
  ): Promise<void> {
    try {
      const config = await LLMSettingsReader.readAllProviders()
      this.lastProvidersConfigJson = JSON.stringify(config)
      
      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: { 
          status: 'success', 
          data: { providersConfig: config } 
        },
        id: message.id
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      Logging.log('ProvidersHandler', `Error getting providers: ${errorMessage}`, 'error')
      
      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: { 
          status: 'error', 
          error: `Failed to read providers: ${errorMessage}` 
        },
        id: message.id
      })
    }
  }

  /**
   * Handle SAVE_LLM_PROVIDERS message
   */
  handleSaveProviders(
    message: PortMessage,
    port: chrome.runtime.Port
  ): void {
    try {
      const config = BrowserOSProvidersConfigSchema.parse(message.payload)

      // Always use chrome.storage.local in development/mock mode
      // Skip browserOS.setPref since it may not be available or functional
      {
        // Use chrome.storage.local
        try {
          const key = BROWSEROS_PREFERENCE_KEYS.PROVIDERS

          console.log('[ProvidersHandler] Saving provider config to storage:', {
            defaultProviderId: config.defaultProviderId,
            providersCount: config.providers.length,
            providers: config.providers.map(p => ({ id: p.id, name: p.name, type: p.type, isDefault: p.isDefault }))
          })

          chrome.storage?.local?.set({ [key]: JSON.stringify(config) }, () => {
            try { LangChainProvider.getInstance().clearCache() } catch (_) {}
            this.lastProvidersConfigJson = JSON.stringify(config)
            this.broadcastProvidersConfig(config)

            console.log('[ProvidersHandler] Provider config saved successfully')

            port.postMessage({
              type: MessageType.WORKFLOW_STATUS,
              payload: { status: 'success' },
              id: message.id
            })
          })
        } catch (_e) {
          port.postMessage({
            type: MessageType.WORKFLOW_STATUS,
            payload: { status: 'error', error: 'Save failed' },
            id: message.id
          })
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: { status: 'error', error: errorMessage },
        id: message.id
      })
    }
  }

  /**
   * Broadcast provider config to all connected panels
   */
  private broadcastProvidersConfig(config: unknown): void {
    // This would be handled by PortManager in the new architecture
    // For now, keeping empty as placeholder
    Logging.log('ProvidersHandler', 'Provider config updated')
  }
}