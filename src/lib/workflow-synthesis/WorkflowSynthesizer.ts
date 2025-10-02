import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { getLLM } from "@/lib/llm/LangChainProvider";
import { invokeWithRetry } from "@/lib/utils/retryable";
import { Logging } from "@/lib/utils/Logging";
import type { SemanticWorkflow } from "@/lib/teach-mode/types";
import {
  ExecutableWorkflowSchema,
  type ExecutableWorkflow
} from "./types";
import { generateWorkflowSynthesisPrompt } from "./prompts";

/**
 * WorkflowSynthesizer converts semantic workflows into executable Python code
 *
 * Single-stage generation that:
 * - Analyzes goal vs demonstration
 * - Detects loops, merges steps, removes noise
 * - Generates clean Python code with BrowserAgent tool calls
 * - Includes conditional logic (MCP availability checks)
 * - Preserves metadata (find=, verify=)
 */
export class WorkflowSynthesizer {

  /**
   * Main entry point: Convert semantic workflow to executable workflow
   */
  async synthesize(workflow: SemanticWorkflow): Promise<ExecutableWorkflow> {
    Logging.log("WorkflowSynthesizer", `Synthesizing workflow: ${workflow.metadata.name}`, "info");

    try {
      // Generate executable code in single stage
      Logging.log("WorkflowSynthesizer", "Generating executable Python code...", "info");
      const dslCode = await this._generateExecutableCode(workflow);
      Logging.log("WorkflowSynthesizer", `Code generated: ${dslCode.split('\n').length} lines`, "info");

      // Create executable workflow
      const executableWorkflow: ExecutableWorkflow = {
        dsl: dslCode,
        metadata: {
          name: workflow.metadata.name,
          goal: workflow.metadata.goal,
          description: workflow.metadata.description || "",
          stepCount: workflow.steps.length
        }
      };

      // Validate schema
      const validated = ExecutableWorkflowSchema.parse(executableWorkflow);

      Logging.log("WorkflowSynthesizer", "Synthesis complete!", "info");
      return validated;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logging.log("WorkflowSynthesizer", `Synthesis failed: ${errorMessage}`, "error");
      throw new Error(`Failed to synthesize workflow: ${errorMessage}`);
    }
  }

  /**
   * Generate executable Python code using BrowserAgent tools
   */
  private async _generateExecutableCode(workflow: SemanticWorkflow): Promise<string> {
    try {
      const llm = await getLLM({
        temperature: 0.3,
        maxTokens: 8192
      });

      const prompt = generateWorkflowSynthesisPrompt(workflow);

      const messages = [
        new SystemMessage(prompt),
        new HumanMessage("Generate the executable Python workflow code. Output only the code, nothing else.")
      ];

      const response = await invokeWithRetry(
        llm,
        messages,
        3
      );

      // Extract code block from response
      const codeBlock = this._extractCodeBlock((response as any)?.content as string || "");

      if (!codeBlock || codeBlock.trim().length === 0) {
        throw new Error("Generated code is empty");
      }

      return codeBlock;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logging.log("WorkflowSynthesizer", `Code generation failed: ${errorMessage}`, "error");
      throw new Error(`Code generation failed: ${errorMessage}`);
    }
  }

  /**
   * Extract code from markdown code block
   */
  private _extractCodeBlock(content: string): string {
    // Try to extract from code block
    const codeBlockRegex = /```(?:python)?\s*\n([\s\S]*?)\n```/;
    const match = content.match(codeBlockRegex);

    if (match && match[1]) {
      return match[1].trim();
    }

    // If no code block found, check if content starts with # or common Python patterns
    if (content.trim().startsWith('#') ||
        content.trim().startsWith('navigate(') ||
        content.trim().startsWith('click(') ||
        content.trim().startsWith('extract(')) {
      return content.trim();
    }

    // Last resort: return as-is
    return content.trim();
  }
}
