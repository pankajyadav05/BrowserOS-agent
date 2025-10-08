/**
 * NewTools - Migrated tools from NewAgent.ts
 *
 * IMPORTANT: These tools maintain EXACT functionality from NewAgent.ts
 * They are designed to work with an extended ExecutionContext that provides
 * all necessary dependencies.
 */

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { PubSubChannel } from "@/lib/pubsub/PubSubChannel";
import { Logging } from "@/lib/utils/Logging";
import { invokeWithRetry } from "@/lib/utils/retryable";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { CONFETTI_SCRIPT } from "@/lib/utils/confetti";

// Tool result schema - EXACT from NewAgent
const ToolResultSchema = z.object({
  ok: z.boolean(),
  output: z.any().optional(),
  error: z.string().optional(),
});

type ToolResult = z.infer<typeof ToolResultSchema>;

/**
 * Create all NewAgent tools with the provided context
 */
export function createNewTools(
  context: ExecutionContext,
): DynamicStructuredTool[] {
  return [
    createClickTool(context),
    createTypeTool(context),
    createClearTool(context),
    createScrollTool(context),
    createNavigateTool(context),
    createKeyTool(context),
    createWaitTool(context),
    createTodoSetTool(context),
    createTodoGetTool(context),
    createTabsTool(context),
    createTabOpenTool(context),
    createTabFocusTool(context),
    createTabCloseTool(context),
    createExtractTool(context),
    createHumanInputTool(context),
    createDoneTool(context),
    createCelebrationTool(context),
    createMoondreamVisualClickTool(context),
    createMoondreamVisualTypeTool(context),
    createClickAtCoordinatesTool(context),
    createTypeAtCoordinatesTool(context),
  ];
}

// ============= Individual Tool Implementations =============


// Click tool input schema
const ClickInputSchema = z.object({
  nodeId: z
    .number()
    .int()
    .min(1)
    .describe("The nodeId number from [brackets] in element list"),
});
type ClickInput = z.infer<typeof ClickInputSchema>;

export function createClickTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "click",
    description: "Click an element by its nodeId (number in brackets)",
    schema: ClickInputSchema,
    func: async (args: ClickInput) => {
      try {
        context.incrementMetric("toolCalls");

        // Get current page from browserContext
        const page = await context.browserContext.getCurrentPage();

        // Ensure element is in viewport
        const { element, scrollMessage } = await page.ensureElementInViewport(
          args.nodeId,
        );
        if (!element) {
          return JSON.stringify({
            ok: false,
            error: `Element not found`,
          });
        }

        await page.clickElement(args.nodeId);
        await page.waitForStability();

        return JSON.stringify({
          ok: true,
          output: `Successfully clicked element ${args.nodeId} ${scrollMessage}`,
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Failed to click : ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}

// Type tool input schema
const TypeInputSchema = z.object({
  nodeId: z
    .number()
    .int()
    .min(1)
    .describe("The nodeId number from [brackets] in element list"),
  text: z.string().describe("Text to type into the element"),
});
type TypeInput = z.infer<typeof TypeInputSchema>;

export function createTypeTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "type",
    description: "Type text into an input element",
    schema: TypeInputSchema,
    func: async (args: TypeInput) => {
      try {
        context.incrementMetric("toolCalls");
        
        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage(`Typing "${args.text}"...`, "thinking")
        );

        // Get current page from browserContext
        const page = await context.browserContext.getCurrentPage();

        // Ensure element is in viewport
        const { element, scrollMessage } = await page.ensureElementInViewport(
          args.nodeId,
        );
        if (!element) {
          return JSON.stringify({
            ok: false,
            error: `Element not found`,
          });
        }

        await page.inputText(args.nodeId, args.text);
        await page.waitForStability();

        return JSON.stringify({
          ok: true,
          output: `Successfully typed "${args.text}" into element ${args.nodeId} ${scrollMessage}`,
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Failed to type into : ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}

// Clear tool input schema
const ClearInputSchema = z.object({
  nodeId: z
    .number()
    .int()
    .min(1)
    .describe("The nodeId number from [brackets] in element list"),
});
type ClearInput = z.infer<typeof ClearInputSchema>;

export function createClearTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "clear",
    description: "Clear text from an input element",
    schema: ClearInputSchema,
    func: async (args: ClearInput) => {
      try {
        context.incrementMetric("toolCalls");
        
        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage("Clearing text...", "thinking")
        );

        // Get current page from browserContext
        const page = await context.browserContext.getCurrentPage();

        // Ensure element is in viewport
        const { element, scrollMessage } = await page.ensureElementInViewport(
          args.nodeId,
        );
        if (!element) {
          return JSON.stringify({
            ok: false,
            error: `Element not found`,
          });
        }

        await page.clearElement(args.nodeId);
        await page.waitForStability();

        return JSON.stringify({
          ok: true,
          output: `Successfully cleared element ${args.nodeId} ${scrollMessage}`,
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Failed to clear : ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}

// Scroll tool input schema
const ScrollInputSchema = z.object({
  nodeId: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("NodeId to scroll to (optional)"),
  direction: z
    .enum(["up", "down"])
    .optional()
    .describe("Direction to scroll page if no nodeId provided"),
  amount: z
    .number()
    .int()
    .min(1)
    .optional()
    .default(1)
    .describe("Number of viewport heights to scroll (default: 1)"),
});
type ScrollInput = z.infer<typeof ScrollInputSchema>;

export function createScrollTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "scroll",
    description: "Scroll to a specific element or scroll the page",
    schema: ScrollInputSchema,
    func: async (args: ScrollInput) => {
      try {
        context.incrementMetric("toolCalls");
        
        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage("Scrolling...", "thinking")
        );

        // Get current page from browserContext
        const page = await context.browserContext.getCurrentPage();

        const amount = args.amount || 1;

        if (args.nodeId) {
          const scrolled = await page.scrollToElement(args.nodeId);
          return JSON.stringify({
            ok: true,
            output: `Scrolled to element : ${args.nodeId} ${scrolled ? "success" : "already visible"}`,
          });
        } else if (args.direction) {
          let result;
          if (args.direction === "down") {
            result = await page.scrollDown(amount);
          } else {
            result = await page.scrollUp(amount);
          }

          const scrollMessage = result.didScroll
            ? `Scrolled ${args.direction} ${amount} viewport(s)`
            : `Already at ${args.direction === "down" ? "bottom" : "top"} of page - no space to scroll ${args.direction}`;

          return JSON.stringify({
            ok: true,
            output: scrollMessage,
          });
        } else {
          return JSON.stringify({
            ok: false,
            error: "Must provide either nodeId or direction",
          });
        }
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Scroll failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}

// Navigate tool input schema
const NavigateInputSchema = z.object({
  url: z
    .string()
    .url()
    .describe("Full URL to navigate to (must include https://)"),
});
type NavigateInput = z.infer<typeof NavigateInputSchema>;

export function createNavigateTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "navigate",
    description: "Navigate to a URL",
    schema: NavigateInputSchema,
    func: async (args: NavigateInput) => {
      try {
        context.incrementMetric("toolCalls");
        
        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage("Navigating...", "thinking")
        );

        // Get current page from browserContext
        const page = await context.browserContext.getCurrentPage();

        await page.navigateTo(args.url);
        await page.waitForStability();

        return JSON.stringify({
          ok: true,
          output: `Successfully navigated to ${args.url}`,
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Navigation failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}

// Key tool input schema
const KeyInputSchema = z.object({
  key: z
    .enum([
      "Enter",
      "Tab",
      "Escape",
      "Backspace",
      "Delete",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Home",
      "End",
      "PageUp",
      "PageDown",
    ])
    .describe("Keyboard key to press"),
});
type KeyInput = z.infer<typeof KeyInputSchema>;

export function createKeyTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "key",
    description: "Send a keyboard key press",
    schema: KeyInputSchema,
    func: async (args: KeyInput) => {
      try {
        context.incrementMetric("toolCalls");
        
        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage("Pressing key...", "thinking")
        );

        // Get current page from browserContext
        const page = await context.browserContext.getCurrentPage();

        await page.sendKeys(args.key);

        return JSON.stringify({
          ok: true,
          output: `Pressed ${args.key} key`,
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Key press failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}

// Wait tool input schema
const WaitInputSchema = z.object({
  seconds: z
    .number()
    .min(1)
    .optional()
    .default(1)
    .describe("Additional seconds to wait (default: 1)"),
});
type WaitInput = z.infer<typeof WaitInputSchema>;

export function createWaitTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "wait",
    description: "Wait for page to stabilize after actions",
    schema: WaitInputSchema,
    func: async (args: WaitInput) => {
      try {
        context.incrementMetric("toolCalls");
        
        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage(`Waiting for ${args.seconds}...`, "thinking")
        );

        // Get current page from browserContext
        const page = await context.browserContext.getCurrentPage();

        await page.waitForStability();
        const waitSeconds = args.seconds || 2;
        if (waitSeconds > 0) {
          await new Promise((resolve) =>
            setTimeout(resolve, waitSeconds * 1000),
          );
        }

        return JSON.stringify({
          ok: true,
          output: `Waited ${waitSeconds} seconds for stability`,
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Wait failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}

// TodoSet tool input schema
const TodoSetInputSchema = z.object({
  todos: z.string().describe("Markdown formatted todo list"),
});
type TodoSetInput = z.infer<typeof TodoSetInputSchema>;

export function createTodoSetTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "todo_set",
    description:
      "Set or update the TODO list with markdown checkboxes (- [ ] pending, - [x] done)",
    schema: TodoSetInputSchema,
    func: async (args: TodoSetInput) => {
      try {
        context.incrementMetric("toolCalls");
        
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage(args.todos, "thinking")
        );
        context.setTodoList(args.todos);

        Logging.log(
          "NewAgent",
          `Updated todo list: ${args.todos.split("\n").length} items`,
          "info",
        );

        return JSON.stringify({
          ok: true,
          output: "Todos updated",
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Failed to update todos: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}

// TodoGet tool input schema (no input)
const TodoGetInputSchema = z.object({});
type TodoGetInput = z.infer<typeof TodoGetInputSchema>;

export function createTodoGetTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "todo_get",
    description: "Get the current TODO list",
    schema: TodoGetInputSchema,
    func: async (args: TodoGetInput) => {
      try {
        context.incrementMetric("toolCalls");

        return JSON.stringify({
          ok: true,
          output: context.getTodoList() || "No todos yet",
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Failed to get todos: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}

// Tabs tool input schema (no input)
const TabsInputSchema = z.object({});
type TabsInput = z.infer<typeof TabsInputSchema>;

export function createTabsTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "tabs",
    description: "List all tabs in the current browser window",
    schema: TabsInputSchema,
    func: async (args: TabsInput) => {
      try {
        context.incrementMetric("toolCalls");
        
        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage("Listing browser tabs...", "thinking")
        );

        // Get current window
        const currentWindow = await chrome.windows.getCurrent();

        // Get tabs in current window
        const tabs = await chrome.tabs.query({
          windowId: currentWindow.id,
        });

        // Format tab info
        const tabList = tabs
          .filter((tab) => tab.id !== undefined)
          .map((tab) => ({
            id: tab.id!,
            title: tab.title || "Untitled",
            url: tab.url || "",
            active: tab.active || false,
          }));

        return JSON.stringify({
          ok: true,
          output: tabList,
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Failed to list tabs: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}

// TabOpen tool input schema
const TabOpenInputSchema = z.object({
  url: z
    .string()
    .url()
    .optional()
    .describe("URL to open (optional, defaults to new tab page)"),
});
type TabOpenInput = z.infer<typeof TabOpenInputSchema>;

export function createTabOpenTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "tab_open",
    description: "Open a new browser tab with optional URL",
    schema: TabOpenInputSchema,
    func: async (args: TabOpenInput) => {
      try {
        context.incrementMetric("toolCalls");
        
        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage("Opening tab...", "thinking")
        );

        const targetUrl = args.url || "chrome://newtab/";
        const page = await context.browserContext.openTab(targetUrl);

        return JSON.stringify({
          ok: true,
          output: {
            tabId: page.tabId,
            url: targetUrl,
          },
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Failed to open tab: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}

// TabFocus tool input schema
const TabFocusInputSchema = z.object({
  tabId: z.number().int().min(1).describe("Tab ID to focus"),
});
type TabFocusInput = z.infer<typeof TabFocusInputSchema>;

export function createTabFocusTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "tab_focus",
    description: "Switch focus to a specific tab by ID",
    schema: TabFocusInputSchema,
    func: async (args: TabFocusInput) => {
      try {
        context.incrementMetric("toolCalls");
        
        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage("Switching tab...", "thinking")
        );

        // Switch to tab using browserContext
        await context.browserContext.switchTab(args.tabId);

        // Get tab info for confirmation
        const tab = await chrome.tabs.get(args.tabId);

        // Note: In NewAgent, this updates this.page reference
        // The caller will need to handle updating the current page reference

        return JSON.stringify({
          ok: true,
          output: `Focused tab: ${tab.title || "Untitled"} (ID: ${args.tabId})`,
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Failed to focus tab ${args.tabId}: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}

// TabClose tool input schema
const TabCloseInputSchema = z.object({
  tabId: z.number().int().min(1).describe("Tab ID to close"),
});
type TabCloseInput = z.infer<typeof TabCloseInputSchema>;

export function createTabCloseTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "tab_close",
    description: "Close a specific tab by ID",
    schema: TabCloseInputSchema,
    func: async (args: TabCloseInput) => {
      try {
        context.incrementMetric("toolCalls");
        
        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage("Closing tab...", "thinking")
        );

        // Verify tab exists
        const tab = await chrome.tabs.get(args.tabId);
        const title = tab.title || "Untitled";

        // Close tab using browserContext
        await context.browserContext.closeTab(args.tabId);

        // Note: In NewAgent, this updates this.page reference
        // The caller will need to handle updating the current page reference

        return JSON.stringify({
          ok: true,
          output: `Closed tab: ${title} (ID: ${args.tabId})`,
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Failed to close tab ${args.tabId}: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}

export function createExtractTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "extract",
    description:
      "Extract structured data from current page using AI. Provide a JSON format object and description of what to extract.",
    schema: z.object({
      format: z
        .any()
        .describe(
          "JSON object showing desired output structure (e.g., {title: '', price: 0, items: []})",
        ),
      task: z
        .string()
        .describe("Description of what data to extract from the page"),
      extractionMode: z
        .enum(['text', 'text-with-links'])
        .optional()
        .default('text')
        .describe("Extraction mode: 'text' for content only, 'text-with-links' to include links section"),
    }),
    func: async ({ format, task, extractionMode = 'text' }: { format: any; task: string; extractionMode?: 'text' | 'text-with-links' }) => {
      try {
        context.incrementMetric("toolCalls");
        
        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage("Extracting data from page...", "thinking")
        );

        // Get current page from browserContext
        const page = await context.browserContext.getCurrentPage();

        // Get page details
        const pageDetails = await page.getPageDetails();

        // Get hierarchical text content
        const hierarchicalContent = await page.getHierarchicalText();

        // Get links only if extraction mode includes links
        const linksContent = extractionMode === 'text-with-links'
          ? await page.getLinksSnapshotString()
          : null;

        // Determine content limit based on message manager's max tokens
        const maxTokens = context.messageManager.getMaxTokens();
        let contentCharLimit: number;

        if (maxTokens >= 1000000) {
          // 1M+ tokens: no limit
          contentCharLimit = Number.MAX_SAFE_INTEGER;
        } else if (maxTokens >= 200000) {
          // 200K+ tokens: 100K char limit
          contentCharLimit = 100000;
        } else {
          // Less than 200K tokens: 16K char limit (≈4K tokens)
          contentCharLimit = 16000;
        }

        // Get LLM instance
        const llm = await context.getLLM({
          temperature: 0.1,
          maxTokens: 8000,
        });

        // Create extraction prompt
        const systemPrompt =
          "You are a data extraction specialist. Extract the requested information from the page content and return it in the exact JSON structure provided.";

        // Prepare content with truncation if needed
        const preparedContent = contentCharLimit === Number.MAX_SAFE_INTEGER ||
                                hierarchicalContent.length <= contentCharLimit
          ? hierarchicalContent
          : hierarchicalContent.substring(0, contentCharLimit) + "\n...[truncated]";

        // Build prompt with hierarchical content
        let userPrompt = `Task: ${task}

Desired output format:
${JSON.stringify(format, null, 2)}

Page content:
URL: ${pageDetails.url}
Title: ${pageDetails.title}

Content (hierarchical structure with tab indentation):
${preparedContent}`;

        // Add links section if requested
        if (extractionMode === 'text-with-links' && linksContent) {
          userPrompt += `\n\nLinks found:
${linksContent.substring(0, 2000)}${linksContent.length > 2000 ? "\n...[more links]" : ""}`;
        }

        userPrompt += `\n\nExtract the requested data and return it matching the exact structure of the format provided.`;

        Logging.log(
          "NewAgent",
          `Extracting data with format: ${JSON.stringify(format)}, mode: ${extractionMode}`,
          "info",
        );

        // Just invoke LLM without structured output - let it figure out the JSON
        const response = await llm.invoke([
          new SystemMessage(
            systemPrompt +
            "\n\nIMPORTANT: Return ONLY valid JSON, no explanations or markdown."
          ),
          new HumanMessage(userPrompt),
        ]);

        // Try to parse the JSON response
        try {
          const content = response.content as string;
          // Clean up response - remove markdown code blocks if present
          const cleanedContent = content
            .replace(/```json\s*/gi, "")
            .replace(/```\s*/g, "")
            .trim();

          const extractedData = JSON.parse(cleanedContent);

          return JSON.stringify({
            ok: true,
            output: extractedData,
          });
        } catch (parseError) {
          // If parsing fails, return the raw response with an error
          return JSON.stringify({
            ok: false,
            error: `Failed to parse extraction result as JSON. Raw output: ${response.content}`,
          });
        }
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Extraction failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}

// HumanInput tool input schema
const HumanInputSchema = z.object({
  prompt: z.string().describe("The situation requiring human intervention"),
});
type HumanInput = z.infer<typeof HumanInputSchema>;

export function createHumanInputTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "human_input",
    description: `Request human intervention when stuck or need manual action.

Use this when:
- You need the human to manually complete a step (enter credentials, solve CAPTCHA, etc.)
- You're blocked and need the human to take over temporarily  
- You encounter an error that requires human judgment
- You need confirmation before proceeding with a risky action

The human will either click "Done" (after taking action) or "Abort task" (to cancel).`,
    schema: HumanInputSchema,
    func: async (args: HumanInput) => {
      try {
        context.incrementMetric("toolCalls");
        
        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage("⏸️ Requesting human input...", "thinking")
        );

        // Generate unique request ID
        const requestId = PubSubChannel.generateId("human_input");

        // Store request ID in execution context for later retrieval
        context.setHumanInputRequestId(requestId);

        // Publish message to UI showing we're waiting
        const messageId = PubSubChannel.generateId("human_input_msg");
        context
          .getPubSub()
          .publishMessage(
            PubSubChannel.createMessageWithId(
              messageId,
              `⏸️ **Waiting for human input:** ${args.prompt}`,
              "thinking",
            ),
          );

        // Publish special event for UI to show the dialog
        context.getPubSub().publishHumanInputRequest({
          requestId,
          prompt: args.prompt,
        });

        // Return immediately with special flag
        return JSON.stringify({
          ok: true,
          output: `Waiting for human input: ${args.prompt}`,
          requiresHumanInput: true, // Special flag for execution loop
          requestId,
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  });
}

// Done tool input schema
const DoneInputSchema = z.object({
  success: z.boolean().describe("Whether the actions have been completed successfully"),
  message: z
    .string()
    .optional()
    .describe("Completion message or reason for failure"),
});
type DoneInput = z.infer<typeof DoneInputSchema>;

export function createDoneTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "done",
    description: "Mark the actions as complete",
    schema: DoneInputSchema,
    func: async (args: DoneInput) => {
      context.incrementMetric("toolCalls");

      return JSON.stringify({
        ok: true,
        output: {
          success: args.success,
        },
      });
    },
  });
}

// Celebration Tool
export function createCelebrationTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "celebration",
    description: "Shows a confetti celebration animation on the current page. Use this to celebrate successful actions like upvoting or starring.",
    schema: z.object({}),  // No parameters needed
    func: async () => {
      try {
        context.incrementMetric("toolCalls");

        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage("🎉 Celebrating...", "thinking")
        );

        // Get current page from browserContext
        const page = await context.browserContext.getCurrentPage();
        if (!page) {
          return JSON.stringify({
            ok: false,
            error: "No active page to show celebration"
          });
        }

        // Use shared confetti script

        // Execute confetti script
        await page.executeJavaScript(CONFETTI_SCRIPT);

        return JSON.stringify({
          ok: true,
          output: "Confetti celebration shown!"
        });

      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Failed to show celebration: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    }
  });
}

// Moondream Visual Click Tool
const MoondreamVisualClickInputSchema = z.object({
  instruction: z
    .string()
    .describe(
      "Describe what to click on (e.g., 'button', 'blue submit button', 'search icon')",
    ),
});
type MoondreamVisualClickInput = z.infer<
  typeof MoondreamVisualClickInputSchema
>;

// Moondream API response type
interface MoondreamPointResponse {
  request_id?: string;
  points: Array<{ x: number; y: number }>;
  error?: {
    message: string;
    type: string;
    param?: string;
    code?: string;
  };
}

export function createMoondreamVisualClickTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "visual_click",
    description:
      "Click on any element by describing what it looks like. Pass a clear description like 'blue submit button', 'search icon', 'first checkbox', 'close button in modal', etc.",
    schema: MoondreamVisualClickInputSchema,
    func: async (args: MoondreamVisualClickInput) => {
      try {
        context.incrementMetric("toolCalls");
        
        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage("🎯 Clicking...", "thinking")
        );

        // Get API key from args or environment
        const apiKey = process.env.MOONDREAM_API_KEY;
        if (!apiKey) {
          return JSON.stringify({
            ok: false,
            error: "Vision API key not provided.",
          });
        }

        // Get current page
        const page = await context.browserContext.getCurrentPage();

        // Get viewport dimensions
        const viewport = await page.executeJavaScript(`
          ({ width: window.innerWidth, height: window.innerHeight })
        `);

        // Take screenshot with exact viewport dimensions for accurate coordinate mapping
        const screenshot = await page.takeScreenshotWithDimensions(
          viewport.width,
          viewport.height,
          false, // no highlights
        );
        if (!screenshot) {
          return JSON.stringify({
            ok: false,
            error: "Failed to capture screenshot for Moondream visual click",
          });
        }

        // Call Moondream API
        const response = await fetch("https://api.moondream.ai/v1/point", {
          method: "POST",
          headers: {
            "X-Moondream-Auth": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            image_url: screenshot,
            object: args.instruction,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          const errorMessage =
            errorData.error?.message || `API error: ${response.status}`;
          return JSON.stringify({
            ok: false,
            error: `Moondream API error: ${errorMessage}`,
          });
        }

        const data: MoondreamPointResponse = await response.json();

        // Check if any points were found
        if (!data.points || data.points.length === 0) {
          return JSON.stringify({
            ok: false,
            error: `No "${args.instruction}" found on the page`,
          });
        }

        // Use the first point (most confident match)
        const point = data.points[0];

        // Convert normalized coordinates (0-1) to viewport pixels
        // Since we took screenshot with exact viewport dimensions, mapping is direct
        const x = Math.round(point.x * viewport.width);
        const y = Math.round(point.y * viewport.height);

        // Use the clickAtCoordinates method (which internally calls clickCoordinates API)
        await page.clickAtCoordinates(x, y);

        return JSON.stringify({
          ok: true,
          output: {
            coordinates: { x, y },
            description: `Clicked "${args.instruction}" at (${x}, ${y})`,
            pointsFound: data.points.length,
          },
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Moondream click failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}

// Moondream Visual Type Tool
const MoondreamVisualTypeInputSchema = z.object({
  instruction: z
    .string()
    .describe(
      "Describe the input field to type in (e.g., 'search box', 'email field', 'password input')",
    ),
  text: z.string().describe("Text to type into the identified field"),
});
type MoondreamVisualTypeInput = z.infer<typeof MoondreamVisualTypeInputSchema>;

export function createMoondreamVisualTypeTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "visual_type",
    description:
      "Type text into any input field by describing what it looks like. Pass a clear description like 'search box', 'email field', 'username input', 'comment textarea', etc.",
    schema: MoondreamVisualTypeInputSchema,
    func: async (args: MoondreamVisualTypeInput) => {
      try {
        context.incrementMetric("toolCalls");
        
        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage(`⌨️ Typing "${args.text}"...`, "thinking")
        );

        // Get API key from environment
        const apiKey = process.env.MOONDREAM_API_KEY;
        if (!apiKey) {
          return JSON.stringify({
            ok: false,
            error: "Vision API key not provided.",
          });
        }

        // Get current page
        const page = await context.browserContext.getCurrentPage();

        // Get viewport dimensions
        const viewport = await page.executeJavaScript(`
          ({ width: window.innerWidth, height: window.innerHeight })
        `);

        // Take screenshot with exact viewport dimensions
        const screenshot = await page.takeScreenshotWithDimensions(
          viewport.width,
          viewport.height,
          false, // no highlights
        );
        if (!screenshot) {
          return JSON.stringify({
            ok: false,
            error: "Failed to capture screenshot for Moondream visual type",
          });
        }

        // Call Moondream API to find the input field
        const response = await fetch("https://api.moondream.ai/v1/point", {
          method: "POST",
          headers: {
            "X-Moondream-Auth": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            image_url: screenshot,
            object: args.instruction,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          const errorMessage =
            errorData.error?.message || `API error: ${response.status}`;
          return JSON.stringify({
            ok: false,
            error: `Moondream API error: ${errorMessage}`,
          });
        }

        const data: MoondreamPointResponse = await response.json();

        // Check if any points were found
        if (!data.points || data.points.length === 0) {
          return JSON.stringify({
            ok: false,
            error: `No "${args.instruction}" found on the page`,
          });
        }

        // Use the first point (most confident match)
        const point = data.points[0];

        // Convert normalized coordinates (0-1) to viewport pixels
        const x = Math.round(point.x * viewport.width);
        const y = Math.round(point.y * viewport.height);

        // Use the typeAtCoordinates method (which internally calls typeAtCoordinates API)
        await page.typeAtCoordinates(x, y, args.text);

        return JSON.stringify({
          ok: true,
          output: {
            coordinates: { x, y },
            description: `Typed "${args.text}" into "${args.instruction}" at (${x}, ${y})`,
            pointsFound: data.points.length,
          },
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Moondream type failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}

// Click at coordinates tool
const ClickAtCoordinatesInputSchema = z.object({
  x: z.number().int().nonnegative().describe("X coordinate in viewport pixels"),
  y: z.number().int().nonnegative().describe("Y coordinate in viewport pixels"),
});
type ClickAtCoordinatesInput = z.infer<typeof ClickAtCoordinatesInputSchema>;

export function createClickAtCoordinatesTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "click_at_coordinates",
    description:
      "Click at specific viewport coordinates (x, y). Use when you have exact pixel coordinates where you want to click.",
    schema: ClickAtCoordinatesInputSchema,
    func: async (args: ClickAtCoordinatesInput) => {
      try {
        context.incrementMetric("toolCalls");
        
        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage("Clicking...", "thinking")
        );

        // Get current page from browserContext
        const page = await context.browserContext.getCurrentPage();

        // Get viewport dimensions for validation
        const viewport = await page.executeJavaScript(`
          ({ width: window.innerWidth, height: window.innerHeight })
        `);

        // Validate coordinates are within viewport bounds
        if (args.x < 0 || args.x > viewport.width) {
          return JSON.stringify({
            ok: false,
            error: `X coordinate ${args.x} is outside viewport width (0-${viewport.width})`,
          });
        }

        if (args.y < 0 || args.y > viewport.height) {
          return JSON.stringify({
            ok: false,
            error: `Y coordinate ${args.y} is outside viewport height (0-${viewport.height})`,
          });
        }

        // Execute the click
        await page.clickAtCoordinates(args.x, args.y);

        return JSON.stringify({
          ok: true,
          output: `Successfully clicked at (${args.x}, ${args.y})`,
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Failed to click at coordinates: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}

// Type at coordinates tool
const TypeAtCoordinatesInputSchema = z.object({
  x: z.number().int().nonnegative().describe("X coordinate in viewport pixels"),
  y: z.number().int().nonnegative().describe("Y coordinate in viewport pixels"),
  text: z.string().describe("Text to type at the specified coordinates"),
});
type TypeAtCoordinatesInput = z.infer<typeof TypeAtCoordinatesInputSchema>;

export function createTypeAtCoordinatesTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "type_at_coordinates",
    description:
      "Type text at specific viewport coordinates (x, y). The tool will first click at the coordinates to focus, then type the text. Use when you have exact pixel coordinates for a text input field.",
    schema: TypeAtCoordinatesInputSchema,
    func: async (args: TypeAtCoordinatesInput) => {
      try {
        context.incrementMetric("toolCalls");
        
        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage(`Typing "${args.text}"...`, "thinking")
        );

        // Get current page from browserContext
        const page = await context.browserContext.getCurrentPage();

        // Get viewport dimensions for validation
        const viewport = await page.executeJavaScript(`
          ({ width: window.innerWidth, height: window.innerHeight })
        `);

        // Validate coordinates are within viewport bounds
        if (args.x < 0 || args.x > viewport.width) {
          return JSON.stringify({
            ok: false,
            error: `X coordinate ${args.x} is outside viewport width (0-${viewport.width})`,
          });
        }

        if (args.y < 0 || args.y > viewport.height) {
          return JSON.stringify({
            ok: false,
            error: `Y coordinate ${args.y} is outside viewport height (0-${viewport.height})`,
          });
        }

        // Execute the type operation (which includes click for focus)
        await page.typeAtCoordinates(args.x, args.y, args.text);

        return JSON.stringify({
          ok: true,
          output: `Successfully typed "${args.text}" at (${args.x}, ${args.y})`,
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Failed to type at coordinates: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}

// GrepElements tool input schema with pagination
const GrepElementsInputSchema = z.object({
  pattern: z.string().describe("Regex pattern to search for (e.g., 'button.*login', 'input.*(email|user)')"),
  start: z.number().int().nonnegative().optional().default(0)
    .describe("Starting index for pagination (default: 0)"),
  limit: z.number().int().min(1).optional().default(15)
    .describe("Maximum number of results to return (default: 15)"),
});
type GrepElementsInput = z.infer<typeof GrepElementsInputSchema>;

// GrepElements tool with regex and pagination
export function createGrepElementsTool(context: ExecutionContext): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "grep_elements",
    description: `Search page elements using regex patterns. Browser state format: [nodeId] <C/T> <tag> "text" attributes

COMMON PATTERNS:
- Text search: "login|sign.?in" (flexible login text)
- Buttons: "button.*submit|input.*submit" (submit buttons)
- Inputs: "input.*(email|user|name)" (form fields)
- Links: "a.*href.*shop" (links containing 'shop')
- IDs: "\\\\[\\\\d+\\\\].*login" (any element with 'login')
- Attributes: 'type="email"|placeholder.*email' (email fields)

EXAMPLE: [42] <C> <button> "Submit" class="btn-primary"
Returns max 15 matches, shows total count if more exist.`,
    schema: GrepElementsInputSchema,
    func: async (args: GrepElementsInput) => {
      try {
        context.incrementMetric("toolCalls");

        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage(`Searching with pattern "${args.pattern}"...`, "thinking")
        );

        // Validate pattern
        let regex: RegExp;
        try {
          regex = new RegExp(args.pattern, 'i'); // Case-insensitive by default
        } catch (regexError) {
          return JSON.stringify({
            ok: false,
            error: `Invalid regex pattern: ${regexError instanceof Error ? regexError.message : String(regexError)}`
          });
        }

        // Get browser state string to parse
        const browserState = await context.browserContext.getBrowserStateString();
        const lines = browserState.split('\n');

        // Find all matching lines by applying regex at line level
        const matchingLines: string[] = [];
        for (const line of lines) {
          // Skip empty lines
          if (line.trim() === '') continue;

          // Apply regex to the full line
          if (regex.test(line)) {
            matchingLines.push(line.trim());
          }
        }

        // Limit to 15 matches
        const totalMatches = matchingLines.length;
        const limitedMatches = matchingLines.slice(0, 15);

        if (limitedMatches.length === 0) {
          return JSON.stringify({
            ok: false,
            error: `No elements found matching pattern "${args.pattern}". Try broader patterns like 'button', 'input', or check browser state format.`
          });
        }

        // Format results - just return the matching lines joined
        const truncationMessage = totalMatches > 15
          ? `\n\nShowing first 15 of ${totalMatches} matches.`
          : '';

        return JSON.stringify({
          ok: true,
          output: `${limitedMatches.join('\n')}${truncationMessage}`
        });

      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Grep elements failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}


// VisualClick coordinate type (no schema needed since we parse XML)
// type VisualClickCoordinate = {
//   x: number;
//   y: number;
//   confidence: number;
//   description: string;
//   notFound: boolean;
// };
//
// // VisualClick tool input schema
// const VisualClickInputSchema = z.object({
//   instruction: z
//     .string()
//     .describe(
//       "Describe what to click on (e.g., 'the blue login button', 'the search icon in the top right')",
//     ),
// });
// type VisualClickInput = z.infer<typeof VisualClickInputSchema>;

// export function createVisualClickTool(
//   context: ExecutionContext,
// ): DynamicStructuredTool {
//   return new DynamicStructuredTool({
//     name: "visual_click",
//     description:
//       "Click on any visual element by describing it. Takes a screenshot, asks AI for coordinates, places crosshair, then clicks.",
//     schema: VisualClickInputSchema,
//     func: async (args: VisualClickInput) => {
//       try {
//         context.incrementMetric("toolCalls");
//
//         // Get current page from browserContext
//         const page = await context.browserContext.getCurrentPage();
//
//         // Get viewport dimensions
//         const viewport = await page.executeJavaScript(`
//           ({ width: window.innerWidth, height: window.innerHeight })
//         `);
//
//         // Take screenshot with fixed dimensions
//         const screenshot = await page.takeScreenshotWithDimensions(
//           1024,
//           768,
//           false,
//         );
//         if (!screenshot) {
//           return JSON.stringify({
//             ok: false,
//             error: "Failed to capture screenshot for visual click",
//           });
//         }
//
//         // Get coordinates from LLM using XML tags for deterministic extraction
//         const llm = await context.getLLM({
//           temperature: 0.1,
//           maxTokens: 1000,
//         });
//
//         // Use invokeWithRetry for reliability (3 retries, same as InteractionTool)
//         const messages = [
//           new SystemMessage(`You are a visual element locator. Given a screenshot and instruction, you need to find the element and return its coordinates.
//
// Analyze the screenshot and provide your response with coordinates in the following XML format:
//
// <coordinates>
// {
//   "notFound": false,
//   "x": 512,
//   "y": 384,
//   "confidence": 0.95,
//   "description": "Found the blue button in the center"
// }
// </coordinates>
//
// The JSON inside <coordinates> tags MUST include:
// - notFound: boolean (true if element cannot be found, false if found)
// - x: number between 0-1024 (horizontal position)
// - y: number between 0-768 (vertical position)
// - confidence: number between 0-1 (how confident you are)
// - description: string (what you found or why not found)
//
// If you CANNOT find the element:
// - Set notFound: true
// - Set x: 0, y: 0
// - Set confidence: 0
// - Set description to explain why it wasn't found
//
// If you CAN find the element:
// - Set notFound: false
// - Provide precise x,y coordinates for the element's center
// - Set confidence based on how sure you are
// - Describe what you found
//
// You can explain your reasoning before the <coordinates> tag, but the coordinates MUST be in valid JSON format inside the XML tags.`),
//           new HumanMessage({
//             content: [
//               {
//                 type: "text",
//                 text: `Find and click on: "${args.instruction}"
//
// Remember to provide the coordinates in <coordinates>JSON</coordinates> format.`,
//               },
//               { type: "image_url", image_url: { url: screenshot } },
//             ],
//           }),
//         ];
//
//         const response = await invokeWithRetry<any>(
//           llm,
//           messages,
//           3, // 3 retries, same as InteractionTool
//           { signal: context.abortSignal },
//         );
//
//         // Extract JSON from XML tags
//         const content =
//           typeof response.content === "string"
//             ? response.content
//             : JSON.stringify(response.content);
//         const coordinatesMatch = content.match(
//           /<coordinates>([\s\S]*?)<\/coordinates>/,
//         );
//
//         if (!coordinatesMatch) {
//           return JSON.stringify({
//             ok: false,
//             error: `Failed to extract coordinates from response. LLM did not provide <coordinates> tags.`,
//           });
//         }
//
//         let result: VisualClickCoordinate;
//         try {
//           result = JSON.parse(
//             coordinatesMatch[1].trim(),
//           ) as VisualClickCoordinate;
//         } catch (parseError) {
//           return JSON.stringify({
//             ok: false,
//             error: `Failed to parse coordinates JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
//           });
//         }
//
//         // Check if element was found
//         if (result.notFound) {
//           return JSON.stringify({
//             ok: false,
//             error: `Element not found: "${args.instruction}". ${result.description}`,
//           });
//         }
//
//         // Check confidence
//         if (result.confidence < 0.3) {
//           return JSON.stringify({
//             ok: false,
//             error: `Cannot find "${args.instruction}" with sufficient confidence (${result.confidence}). ${result.description}`,
//           });
//         }
//
//         // Adjust coordinates for viewport
//         const x = Math.round(result.x * (viewport.width / 1024));
//         const y = Math.round(result.y * (viewport.height / 768));
//
//         // Place crosshair
//         await page.executeJavaScript(`
//           (function() {
//             const existing = document.getElementById('ai-crosshair');
//             if (existing) existing.remove();
//
//             const crosshair = document.createElement('div');
//             crosshair.id = 'ai-crosshair';
//             crosshair.style.cssText = \`
//               position: fixed;
//               left: ${x - 15}px;
//               top: ${y - 15}px;
//               width: 30px;
//               height: 30px;
//               border: 3px solid red;
//               border-radius: 50%;
//               background: rgba(255, 0, 0, 0.2);
//               z-index: 999999;
//               pointer-events: none;
//             \`;
//             document.body.appendChild(crosshair);
//
//             setTimeout(() => {
//               const el = document.getElementById('ai-crosshair');
//               if (el) el.remove();
//             }, 30000);
//           })();
//         `);
//
//         // Small delay for visual feedback
//         await new Promise((resolve) => setTimeout(resolve, 200));
//
//         // Click using synthetic events
//         const clickResult = await page.executeJavaScript(`
//           (function() {
//             const x = ${x};
//             const y = ${y};
//             const element = document.elementFromPoint(x, y);
//
//             if (!element) {
//               return { clicked: false, error: 'No element at coordinates' };
//             }
//
//             // Dispatch mouse events
//             const events = ['mousedown', 'mouseup', 'click'];
//             events.forEach(eventType => {
//               const event = new MouseEvent(eventType, {
//                 view: window,
//                 bubbles: true,
//                 cancelable: true,
//                 clientX: x,
//                 clientY: y
//               });
//               element.dispatchEvent(event);
//             });
//
//             // Also try native click
//             if (element.click) element.click();
//
//             return {
//               clicked: true,
//               element: element.tagName.toLowerCase()
//             };
//           })();
//         `);
//
//         await page.waitForStability();
//
//         if (!clickResult.clicked) {
//           return JSON.stringify({
//             ok: false,
//             error: clickResult.error || "Click failed",
//           });
//         }
//
//         return JSON.stringify({
//           ok: true,
//           output: {
//             coordinates: { x, y },
//             confidence: result.confidence,
//             description: result.description,
//             element: clickResult.element,
//           },
//         });
//       } catch (error) {
//         context.incrementMetric("errors");
//         return JSON.stringify({
//           ok: false,
//           error: `Visual click failed: ${error instanceof Error ? error.message : String(error)}`,
//         });
//       }
//     },
//   });
// }
