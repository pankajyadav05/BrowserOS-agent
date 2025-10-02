import { z } from "zod";

/**
 * Executable workflow schema
 */
export const ExecutableWorkflowSchema = z.object({
  dsl: z.string(),  // The generated executable Python code using BrowserAgent tools
  metadata: z.object({
    name: z.string(),  // Workflow name
    goal: z.string(),  // What user wants to accomplish
    description: z.string(),  // What user demonstrated
    stepCount: z.number()  // Number of steps in original workflow
  })
});

export type ExecutableWorkflow = z.infer<typeof ExecutableWorkflowSchema>;
