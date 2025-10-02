import type { SemanticWorkflow } from "@/lib/teach-mode/types";

/**
 * Stage 1: Semantic Analysis
 * Deep reasoning about goal vs demonstration
 */
export function generateSemanticAnalysisPrompt(workflow: SemanticWorkflow): string {
  const stepSummary = workflow.steps.map((step, idx) => {
    return `Step ${idx}:
  Intent: ${step.intent}
  Action: ${step.action.type}
  Description: ${step.action.description}
  Node Identification: ${step.action.nodeIdentificationStrategy || "N/A"}
  Validation: ${step.action.validationStrategy}`;
  }).join('\n\n');

  return `You are a workflow analysis expert. Your task is to deeply analyze a user-demonstrated browser automation workflow and provide comprehensive reasoning about what the user wants to achieve.

# CRITICAL CONTEXT

## What User DEMONSTRATED (the recording):
${workflow.metadata.description || "User showed a workflow"}

## What User WANTS (the actual goal):
${workflow.metadata.goal}

## User's Transcript/Instructions:
${workflow.metadata.transcript || "No additional instructions"}

## Demonstrated Steps (what user actually did):
${stepSummary}

# YOUR TASK

Provide a DETAILED, STEP-BY-STEP reasoning document analyzing this workflow. Think deeply and explain your reasoning.

## Required Analysis Sections

### 1. Goal vs Demonstration Comparison
**Think step by step:**
- What exactly does the user's GOAL say they want to accomplish?
- What did the user actually DEMONSTRATE in their recording?
- What are the KEY DIFFERENCES between goal and demonstration?
- Are there any quantitative differences? (e.g., "all" vs "one", "20" vs "1")
- Are there any qualitative differences? (e.g., "summarize" vs "copy", "analyze" vs "view")

### 2. Loop Detection Analysis
**Think step by step:**
- Does the goal indicate multiple items but demo shows only one? Explain.
- Does the goal mention "all", "every", "each", or a specific number?
- If yes, what TYPE of loop is needed? (for-loop with count, while-loop until condition, foreach over data)
- What specific steps should be inside the loop? Which steps are setup (before loop) and which are repeated?
- Should we loop over extracted data? If yes, what data needs to be extracted first?
- Provide clear reasoning for your loop decision.

### 3. Data Extraction Opportunities
**Think step by step:**
- Look at the demonstrated steps. Are there places where the user clicked or scrolled through data?
- Could any of these actions be replaced with a single \`extract()\` call?
- What data needs to be extracted? When in the workflow?
- For each extraction point, describe:
  - WHAT to extract (e.g., "list of launch items", "product details")
  - WHEN to extract it (e.g., "after navigating to page", "inside loop on each item")
  - WHY extract is better than the demonstrated clicking/scrolling
  - What FORMAT/SCHEMA the extracted data should have

### 4. MCP Service Detection
**Think step by step:**
- Does the goal mention any Google services? (Google Docs, Gmail, Google Sheets, Google Calendar, etc.)
- Does the goal mention Notion, Slack, or other services?
- For each service mentioned:
  - Should we check if MCP is available for this service?
  - What would be the MCP path? (create document, send email, etc.)
  - What would be the browser automation fallback?
- Explain your reasoning for MCP usage.

### 5. Step Quality Analysis
**Think step by step:**
- Go through each demonstrated step (Step 0, Step 1, ..., Step N)
- For each step, classify it:
  - **ESSENTIAL**: This step is necessary to achieve the goal
  - **NOISE**: This step is unnecessary (e.g., excessive scrolling, redundant clicks)
  - **MERGEABLE**: This step could be merged with other steps into a single action
- For mergeable steps, explain which steps should merge together and why
- Explain your reasoning for each classification

### 6. Overall Reasoning & Strategy
**Provide a comprehensive summary:**
- What is the high-level strategy for achieving the user's goal?
- How does this strategy differ from the literal demonstration?
- What are the key transformations needed? (e.g., "Replace clicking 5 items with extract(), add loop")
- What are potential edge cases or challenges?
- Any other important insights?

# OUTPUT FORMAT

Provide your analysis as a detailed markdown document with clear sections and sub-sections. Use the headings above.

**IMPORTANT**:
- Think deeply and explain your reasoning at each step
- Don't just state conclusions - explain HOW you arrived at them
- Be specific with step numbers and concrete examples
- If you're uncertain about something, explain your uncertainty and reasoning

Now provide your detailed semantic analysis.`;
}

/**
 * Stage 2: Action Consolidation
 * Design clean action sequence based on analysis
 */
export function generateActionConsolidationPrompt(
  workflow: SemanticWorkflow,
  stage1Reasoning: string
): string {
  const stepSummary = workflow.steps.map((step, idx) => {
    return `Step ${idx}: ${step.intent} (${step.action.type})`;
  }).join('\n');

  return `You are a workflow consolidation expert. Your task is to design a clean, essential action sequence based on semantic analysis.

# CONTEXT

## User's Goal:
${workflow.metadata.goal}

## Demonstrated Steps:
${stepSummary}

## Stage 1 Semantic Analysis (your foundation):
${stage1Reasoning}

# YOUR TASK

Based on Stage 1 analysis, design a CONSOLIDATED action sequence that achieves the user's goal efficiently. Think step by step.

## Required Analysis Sections

### 1. High-Level Action Sequence Design
**Think step by step:**
- Review Stage 1's loop detection. What phases are needed? (setup, loop, cleanup)
- For SETUP phase: What actions must happen before any looping? List them with reasoning.
- For LOOP phase: What actions repeat for each item? List them with reasoning.
- For CLEANUP phase: What actions happen at the end? List them with reasoning.
- For each action, explain:
  - **Intent**: What is this action trying to accomplish?
  - **Original Steps**: Which demonstrated steps (by number) does this replace?
  - **Why Essential**: Why is this action necessary?
  - **Metadata to Preserve**: What validation/identification info should carry forward?

### 2. Step Consolidation Decisions
**Think step by step:**
- Review Stage 1's step quality analysis
- For each group of NOISE steps: Explain why we're removing them
- For each group of MERGEABLE steps:
  - Which steps are being merged? (list step numbers)
  - What single action replaces them?
  - Why is the consolidated version better?
  - What metadata from original steps should be preserved?
- Provide clear before/after examples

### 3. Data Extraction Integration
**Think step by step:**
- Review Stage 1's extraction opportunities
- For each extraction point:
  - Where in the action sequence does it fit? (which phase, which position)
  - What does it replace from the original demo?
  - What variable name should store the result?
  - How is this data used in subsequent actions?
- Show the data flow clearly

### 4. MCP Integration Planning
**Think step by step:**
- Review Stage 1's MCP service detection
- For each MCP service:
  - Where in the action sequence do we check availability?
  - What actions are in the "MCP available" path?
  - What actions are in the "fallback browser" path?
  - Are both paths functionally equivalent? Explain.
- Design the conditional structure

### 5. Loop Structure Design
**Think step by step:**
- If Stage 1 detected a loop:
  - What is the loop type? (for, while, foreach)
  - What data does it iterate over? (variable name from extraction)
  - What is the loop counter variable name?
  - What is the safety limit (max_iterations)?
  - Which actions (from section 1) are inside the loop?
  - Show the loop structure clearly
- If no loop: Explain why the sequence is linear

### 6. Complete Action Sequence
**Provide the final consolidated sequence:**
- List ALL actions in order, numbered
- Group by phase (Setup, Loop, Cleanup)
- For each action include:
  - Action ID (e.g., "setup-1", "loop-2")
  - Intent (what it does)
  - Original step numbers it replaces
  - Phase it belongs to
  - Whether it's inside loop
  - Any conditionals (MCP, etc.)
  - Key metadata to preserve

# OUTPUT FORMAT

Provide your analysis as a detailed markdown document with clear sections and sub-sections. Use the headings above.

**IMPORTANT**:
- Build directly on Stage 1 reasoning - reference it explicitly
- Think step by step through consolidation decisions
- Show your reasoning, not just the final sequence
- Be specific with step numbers and action details

Now provide your detailed action consolidation analysis.`;
}

/**
 * Stage 3: Tool Mapping
 * Map each action to exact BrowserAgent tool
 */
export function generateToolMappingPrompt(
  workflow: SemanticWorkflow,
  stage1Reasoning: string,
  stage2Reasoning: string
): string {
  const stepDetails = workflow.steps.map((step, idx) => {
    return `Step ${idx}:
  Intent: ${step.intent}
  Action Type: ${step.action.type}
  Description: ${step.action.description}
  Node Identification Strategy: ${step.action.nodeIdentificationStrategy || "N/A"}
  Validation Strategy: ${step.action.validationStrategy}
  Timeout: ${step.action.timeoutMs}ms`;
  }).join('\n\n');

  return `You are a tool mapping expert. Your task is to map each consolidated action to exact BrowserAgent tool calls with proper parameters.

# CONTEXT

## User's Goal:
${workflow.metadata.goal}

## Original Step Details (for metadata extraction):
${stepDetails}

## Stage 1 Analysis:
${stage1Reasoning}

## Stage 2 Consolidated Actions:
${stage2Reasoning}

# AVAILABLE BROWSERAGENT TOOLS

## Navigation
- **navigate(url, verify="condition")**
  - url: The URL to navigate to
  - verify: Success condition to check after navigation

## Interaction
- **click(description, find="identification", verify="success")**
  - description: Human-readable description of what's being clicked
  - find: How to identify the element (from nodeIdentificationStrategy)
  - verify: Success condition after click (from validationStrategy)

- **type(description, text, find="identification", verify="success")**
  - description: Human-readable description of the field
  - text: Text to type (can be variable like movie_name)
  - find: How to identify the field
  - verify: Success condition after typing

- **clear(description, find="identification")**
  - description: Field description
  - find: How to identify the field

- **scroll(direction="down", amount=500)**
  OR **scroll(description, find="element")**

- **key(key_name)**
  - key_name: "Enter", "Tab", "Escape", etc.

## Data Extraction
- **extract(format={schema}, task="what to extract")**
  - format: Dictionary schema defining structure (e.g., {"items": [{"name": "string", "url": "string"}]})
  - task: Clear description of what to extract
  - Returns: Dictionary matching the format schema

## Tab Operations
- **tabs()** - List all tabs
- **tab_open(url=None)** - Open new tab
- **tab_focus(tab_id)** - Switch to tab
- **tab_close(tab_id)** - Close tab

## MCP Integration
- **mcp(action="getUserInstances")**
  - Returns: List of available MCP instances

- **mcp(action="listTools", instanceId="id")**
  - Returns: Available tools for that instance

- **mcp(action="callTool", instanceId="id", toolName="name", toolArgs={...})**
  - Executes the MCP tool

## Completion
- **done(success=True, message="completion message")**

# YOUR TASK

For each consolidated action from Stage 2, map it to exact BrowserAgent tool(s) with parameters. Think step by step.

## Required Analysis Sections

### 1. Tool Mapping for Setup Phase
**Think step by step:**
- Review Stage 2's setup phase actions
- For EACH setup action:
  - **Action Reference**: Quote the action from Stage 2 (action ID and intent)
  - **Tool Choice**: Which BrowserAgent tool(s) to use? Why this tool?
  - **Parameter Design**:
    - List each parameter
    - For find= parameters: Extract from original step's nodeIdentificationStrategy
    - For verify= parameters: Extract from original step's validationStrategy
    - For extract format= parameters: Design the schema carefully
    - Show exact parameter values
  - **Variable Storage**: If this tool returns data, what variable name stores it?
  - **Conditional Logic**: Is this tool call conditional? (if/else based on MCP)
  - **Source Step Reference**: Which original step(s) provided the metadata?

### 2. Tool Mapping for Loop Phase
**Think step by step:**
- Review Stage 2's loop phase actions
- For EACH loop action:
  - (Same analysis structure as setup phase)
  - Additionally: How does this action use loop variables?

### 3. MCP Conditional Flow Design
**Think step by step:**
- Review Stage 2's MCP integration plan
- Design the complete MCP checking sequence:
  - Tool call 1: Check instances (show exact call)
  - Conditional check: What Python expression checks availability?
  - If TRUE path: List all MCP tool calls with exact parameters
  - If FALSE path: List all browser fallback tool calls with exact parameters
- Explain how both paths achieve the same goal

### 4. Complete Tool Sequence
**Provide the final tool sequence:**
- List ALL tool calls in execution order
- Number them (tool-1, tool-2, ...)
- For each tool call show:
  - Tool ID
  - Phase (setup/loop/cleanup)
  - Tool name
  - All parameters with exact values
  - Conditional (if/else/none)
  - Variable storage (if applicable)
  - Loop context (if inside loop)

### 5. Data Flow Diagram
**Show how data flows through the workflow:**
- What variables are created? (from extract, mcp, etc.)
- How are they used in subsequent tool calls?
- Show the flow clearly (e.g., "launches variable → loop iteration → launch['url'] used in navigate")

### 6. Metadata Preservation Verification
**Verify all metadata is preserved:**
- List all original steps that had nodeIdentificationStrategy
- Show how each was mapped to find= parameter in tool calls
- List all original steps that had validationStrategy
- Show how each was mapped to verify= parameter in tool calls
- Flag any metadata that might be lost

# OUTPUT FORMAT

Provide your analysis as a detailed markdown document with clear sections and sub-sections. Use the headings above.

**IMPORTANT**:
- Build on Stage 1 and Stage 2 reasoning
- Extract metadata from ORIGINAL steps (use step numbers)
- Use EXACT tool signatures - no invented parameters
- Think through parameter values carefully
- Show your reasoning for tool choices

Now provide your detailed tool mapping analysis.`;
}

/**
 * Stage 4: Code Generation
 * Final synthesis into executable Python
 */
export function generateCodeGenerationPrompt(
  workflow: SemanticWorkflow,
  stage1Reasoning: string,
  stage2Reasoning: string,
  stage3Reasoning: string
): string {
  return `You are a code generation expert. Your task is to synthesize all previous analysis into clean, executable Python code using BrowserAgent tools.

# CONTEXT

## User's Goal:
${workflow.metadata.goal}

## Workflow Name:
${workflow.metadata.name}

## Stage 1 - Semantic Analysis:
${stage1Reasoning}

## Stage 2 - Action Consolidation:
${stage2Reasoning}

## Stage 3 - Tool Mapping:
${stage3Reasoning}

# YOUR TASK

Generate production-ready, executable Python code that implements the workflow. Think step by step about code structure.

## Code Generation Guidelines

### 1. Code Structure Planning
**Think step by step:**
- What's the overall code structure? (header comment, setup, loop, cleanup, done)
- How should phases be organized? (comments for each phase)
- What variables need to be declared? (counters, flags, extracted data)
- What's the proper indentation strategy? (4 spaces)

### 2. Header and Metadata
- Start with comment block showing workflow name and goal
- Format:
  \`\`\`python
  # Workflow: {name}
  # Goal: {goal}
  \`\`\`

### 3. Setup Phase Code Generation
**Think step by step:**
- Review Stage 3's setup phase tool sequence
- For each tool call:
  - Write the exact tool call with parameters
  - Proper indentation (4 spaces per level)
  - Multi-line parameters should align nicely
  - Add variable assignments where needed
- Add phase comment: \`# Setup: [brief description]\`

### 4. MCP Conditional Block
**Think step by step:**
- Review Stage 3's MCP conditional flow
- Generate the if/else structure:
  \`\`\`python
  instances = mcp(action="getUserInstances")
  service_available = any(i["name"] == "Service" for i in instances.get("instances", []))

  if service_available:
      # MCP path tool calls
  else:
      # Browser fallback tool calls
  \`\`\`
- Ensure both branches are functionally equivalent

### 5. Loop Structure Code Generation
**Think step by step:**
- Review Stage 2's loop structure design
- If loop needed:
  - Declare counter and max_iterations variables
  - Generate loop header (for/while)
  - Add safety check inside loop
  - Indent loop body properly (4 spaces)
  - Add loop phase comment: \`# Process each [item]\`
- If no loop: Skip this section

### 6. Loop Body Code Generation
**Think step by step:**
- Review Stage 3's loop phase tool sequence
- For each tool call in loop:
  - Write exact tool call with proper indentation (8 spaces for loop body)
  - Use loop variables correctly (e.g., launch["url"])
  - Handle nested conditionals if needed (MCP writes inside loop)
  - Increment counter at end of loop

### 7. Cleanup and Completion
**Think step by step:**
- Add any cleanup actions (close tabs, etc.)
- Generate final done() call:
  - success=True
  - Meaningful message (can include counter: f"Processed {count} items")

### 8. Code Quality Checks
**Verify:**
- All tool calls use exact signatures from Stage 3
- All parameters are properly quoted (strings in quotes)
- Python syntax is valid (colons, indentation, f-strings)
- Variable names are used consistently
- Comments are helpful but not excessive

# OUTPUT FORMAT

Generate ONLY the Python code. No markdown code blocks, no explanations, just the raw Python code.

**IMPORTANT**:
- Use exact tool signatures from Stage 3 (no bos. prefix, no invented tools)
- Preserve all find= and verify= parameters
- 4-space indentation throughout
- Clean, readable, production-ready code
- Valid Python syntax

Now generate the executable Python code.`;
}
