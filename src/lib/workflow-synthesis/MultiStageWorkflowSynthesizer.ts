import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { getLLM } from "@/lib/llm/LangChainProvider";
import { invokeWithRetry } from "@/lib/utils/retryable";
import { Logging } from "@/lib/utils/Logging";
import type { SemanticWorkflow } from "@/lib/teach-mode/types";
import {
  MultiStageExecutableWorkflowSchema,
  type MultiStageExecutableWorkflow,
  type SemanticAnalysis,
  type ActionConsolidation,
  type ToolMapping
} from "./multistage-types";
import {
  generateSemanticAnalysisPrompt,
  generateActionConsolidationPrompt,
  generateToolMappingPrompt,
  generateCodeGenerationPrompt
} from "./multistage-prompts";

/**
 * MultiStageWorkflowSynthesizer converts semantic workflows into executable Python code
 * using a 4-stage reasoning-based pipeline for maximum reliability.
 *
 * Pipeline:
 * 1. Stage 1: Semantic Analysis - Deep reasoning about goal vs demonstration
 * 2. Stage 2: Action Consolidation - Design clean action sequence
 * 3. Stage 3: Tool Mapping - Map actions to exact BrowserAgent tools
 * 4. Stage 4: Code Generation - Synthesize final executable Python code
 *
 * Each stage produces a reasoning document that feeds into the next stage.
 */
export class MultiStageWorkflowSynthesizer {

  /**
   * Main entry point: Convert semantic workflow to executable workflow
   */
  async synthesize(workflow: SemanticWorkflow): Promise<MultiStageExecutableWorkflow> {
    Logging.log("MultiStageWorkflowSynthesizer", `Synthesizing workflow: ${workflow.metadata.name}`, "info");
    Logging.log("MultiStageWorkflowSynthesizer", "Using 4-stage reasoning-based pipeline", "info");

    try {
      // Stage 1: Semantic Analysis
      Logging.log("MultiStageWorkflowSynthesizer", "Stage 1: Semantic Analysis...", "info");
      const stage1 = await this._performSemanticAnalysis(workflow);
      Logging.log("MultiStageWorkflowSynthesizer", `Stage 1 complete. Reasoning: ${stage1.reasoning.length} chars`, "info");

      // Stage 2: Action Consolidation
      Logging.log("MultiStageWorkflowSynthesizer", "Stage 2: Action Consolidation...", "info");
      const stage2 = await this._performActionConsolidation(workflow, stage1.reasoning);
      Logging.log("MultiStageWorkflowSynthesizer", `Stage 2 complete. Reasoning: ${stage2.reasoning.length} chars`, "info");

      // Stage 3: Tool Mapping
      Logging.log("MultiStageWorkflowSynthesizer", "Stage 3: Tool Mapping...", "info");
      const stage3 = await this._performToolMapping(workflow, stage1.reasoning, stage2.reasoning);
      Logging.log("MultiStageWorkflowSynthesizer", `Stage 3 complete. Reasoning: ${stage3.reasoning.length} chars`, "info");

      // Stage 4: Code Generation
      Logging.log("MultiStageWorkflowSynthesizer", "Stage 4: Code Generation...", "info");
      const dslCode = await this._performCodeGeneration(
        workflow,
        stage1.reasoning,
        stage2.reasoning,
        stage3.reasoning
      );
      Logging.log("MultiStageWorkflowSynthesizer", `Stage 4 complete. Generated: ${dslCode.split('\n').length} lines`, "info");

      // Create executable workflow with all reasoning
      const executableWorkflow: MultiStageExecutableWorkflow = {
        dsl: dslCode,
        metadata: {
          name: workflow.metadata.name,
          goal: workflow.metadata.goal,
          description: workflow.metadata.description || "",
          stepCount: workflow.steps.length
        },
        reasoning: {
          stage1: stage1.reasoning,
          stage2: stage2.reasoning,
          stage3: stage3.reasoning,
          stage4Context: this._buildStage4Context(stage1.reasoning, stage2.reasoning, stage3.reasoning)
        }
      };

      // Validate schema
      const validated = MultiStageExecutableWorkflowSchema.parse(executableWorkflow);

      Logging.log("MultiStageWorkflowSynthesizer", "Multi-stage synthesis complete!", "info");
      return validated;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logging.log("MultiStageWorkflowSynthesizer", `Synthesis failed: ${errorMessage}`, "error");
      throw new Error(`Failed to synthesize workflow: ${errorMessage}`);
    }
  }

  /**
   * Stage 1: Semantic Analysis
   * Deep reasoning about goal vs demonstration, loop detection, extraction opportunities
   */
  private async _performSemanticAnalysis(workflow: SemanticWorkflow): Promise<SemanticAnalysis> {
    try {
      const llm = await getLLM({
        temperature: 0.3,
        maxTokens: 4096
      });

      const prompt = generateSemanticAnalysisPrompt(workflow);

      const messages = [
        new SystemMessage(prompt),
        new HumanMessage("Provide your detailed semantic analysis. Think step by step and explain your reasoning.")
      ];

      const response = await invokeWithRetry(
        llm,
        messages,
        3
      );

      const reasoning = this._extractContent(response);

      if (!reasoning || reasoning.trim().length === 0) {
        throw new Error("Stage 1: Generated reasoning is empty");
      }

      return {
        reasoning,
        timestamp: Date.now()
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logging.log("MultiStageWorkflowSynthesizer", `Stage 1 failed: ${errorMessage}`, "error");
      throw new Error(`Stage 1 (Semantic Analysis) failed: ${errorMessage}`);
    }
  }

  /**
   * Stage 2: Action Consolidation
   * Design clean action sequence based on Stage 1 analysis
   */
  private async _performActionConsolidation(
    workflow: SemanticWorkflow,
    stage1Reasoning: string
  ): Promise<ActionConsolidation> {
    try {
      const llm = await getLLM({
        temperature: 0.3,
        maxTokens: 4096
      });

      const prompt = generateActionConsolidationPrompt(workflow, stage1Reasoning);

      const messages = [
        new SystemMessage(prompt),
        new HumanMessage("Provide your detailed action consolidation analysis. Think step by step and build on Stage 1 reasoning.")
      ];

      const response = await invokeWithRetry(
        llm,
        messages,
        3
      );

      const reasoning = this._extractContent(response);

      if (!reasoning || reasoning.trim().length === 0) {
        throw new Error("Stage 2: Generated reasoning is empty");
      }

      return {
        reasoning,
        timestamp: Date.now()
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logging.log("MultiStageWorkflowSynthesizer", `Stage 2 failed: ${errorMessage}`, "error");
      throw new Error(`Stage 2 (Action Consolidation) failed: ${errorMessage}`);
    }
  }

  /**
   * Stage 3: Tool Mapping
   * Map each action to exact BrowserAgent tool with parameters
   */
  private async _performToolMapping(
    workflow: SemanticWorkflow,
    stage1Reasoning: string,
    stage2Reasoning: string
  ): Promise<ToolMapping> {
    try {
      const llm = await getLLM({
        temperature: 0.2,
        maxTokens: 6144
      });

      const prompt = generateToolMappingPrompt(workflow, stage1Reasoning, stage2Reasoning);

      const messages = [
        new SystemMessage(prompt),
        new HumanMessage("Provide your detailed tool mapping analysis. Think step by step and map each action to exact BrowserAgent tools.")
      ];

      const response = await invokeWithRetry(
        llm,
        messages,
        3
      );

      const reasoning = this._extractContent(response);

      if (!reasoning || reasoning.trim().length === 0) {
        throw new Error("Stage 3: Generated reasoning is empty");
      }

      return {
        reasoning,
        timestamp: Date.now()
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logging.log("MultiStageWorkflowSynthesizer", `Stage 3 failed: ${errorMessage}`, "error");
      throw new Error(`Stage 3 (Tool Mapping) failed: ${errorMessage}`);
    }
  }

  /**
   * Stage 4: Code Generation
   * Final synthesis into executable Python code
   */
  private async _performCodeGeneration(
    workflow: SemanticWorkflow,
    stage1Reasoning: string,
    stage2Reasoning: string,
    stage3Reasoning: string
  ): Promise<string> {
    try {
      const llm = await getLLM({
        temperature: 0.2,
        maxTokens: 8192
      });

      const prompt = generateCodeGenerationPrompt(
        workflow,
        stage1Reasoning,
        stage2Reasoning,
        stage3Reasoning
      );

      const messages = [
        new SystemMessage(prompt),
        new HumanMessage("Generate the executable Python code. Output ONLY the code, nothing else.")
      ];

      const response = await invokeWithRetry(
        llm,
        messages,
        3
      );

      const code = this._extractContent(response);

      if (!code || code.trim().length === 0) {
        throw new Error("Stage 4: Generated code is empty");
      }

      // Code might have markdown code blocks, extract if present
      const cleanedCode = this._extractCodeBlock(code);

      return cleanedCode;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logging.log("MultiStageWorkflowSynthesizer", `Stage 4 failed: ${errorMessage}`, "error");
      throw new Error(`Stage 4 (Code Generation) failed: ${errorMessage}`);
    }
  }

  /**
   * Extract content from LLM response
   */
  private _extractContent(response: any): string {
    if (typeof response === 'string') {
      return response;
    }
    if (response && typeof response.content === 'string') {
      return response.content;
    }
    if (response && response.content && Array.isArray(response.content)) {
      const textContent = response.content.find((c: any) => c.type === 'text');
      if (textContent && textContent.text) {
        return textContent.text;
      }
    }
    return String(response);
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

  /**
   * Build Stage 4 context summary for debugging
   */
  private _buildStage4Context(
    stage1: string,
    stage2: string,
    stage3: string
  ): string {
    return `Stage 4 synthesized code from:\n- Stage 1 reasoning (${stage1.length} chars)\n- Stage 2 reasoning (${stage2.length} chars)\n- Stage 3 reasoning (${stage3.length} chars)`;
  }
}
