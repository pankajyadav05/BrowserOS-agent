import { z } from "zod";

/**
 * Stage 1: Semantic Analysis reasoning document
 */
export const SemanticAnalysisSchema = z.object({
  reasoning: z.string(),  // Full markdown reasoning document
  timestamp: z.number()  // When this was generated
});

export type SemanticAnalysis = z.infer<typeof SemanticAnalysisSchema>;

/**
 * Stage 2: Action Consolidation reasoning document
 */
export const ActionConsolidationSchema = z.object({
  reasoning: z.string(),  // Full markdown reasoning document
  timestamp: z.number()
});

export type ActionConsolidation = z.infer<typeof ActionConsolidationSchema>;

/**
 * Stage 3: Tool Mapping reasoning document
 */
export const ToolMappingSchema = z.object({
  reasoning: z.string(),  // Full markdown reasoning document
  timestamp: z.number()
});

export type ToolMapping = z.infer<typeof ToolMappingSchema>;

/**
 * Multi-stage executable workflow (includes all reasoning)
 */
export const MultiStageExecutableWorkflowSchema = z.object({
  dsl: z.string(),  // Final generated Python code
  metadata: z.object({
    name: z.string(),
    goal: z.string(),
    description: z.string(),
    stepCount: z.number()
  }),
  reasoning: z.object({
    stage1: z.string(),  // Semantic analysis reasoning
    stage2: z.string(),  // Action consolidation reasoning
    stage3: z.string(),  // Tool mapping reasoning
    stage4Context: z.string()  // Context used for final generation
  })
});

export type MultiStageExecutableWorkflow = z.infer<typeof MultiStageExecutableWorkflowSchema>;
