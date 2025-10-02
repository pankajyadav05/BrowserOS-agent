import type { SemanticWorkflow } from "@/lib/teach-mode/types";

/**
 * Generate comprehensive single-stage prompt for workflow synthesis
 */
export function generateWorkflowSynthesisPrompt(workflow: SemanticWorkflow): string {
  const stepDetails = workflow.steps.map((step, idx) => {
    return `
Step ${idx}:
  Intent: ${step.intent}
  Action Type: ${step.action.type}
  Description: ${step.action.description}
  Node Identification: ${step.action.nodeIdentificationStrategy || "N/A"}
  Validation: ${step.action.validationStrategy}
  Timeout: ${step.action.timeoutMs}ms
`;
  }).join('\n');

  return `You are an expert workflow synthesis agent. Your task is to convert a user-demonstrated browser automation workflow into clean, reliable, executable Python code that uses BrowserAgent tools.

# CRITICAL CONTEXT

## What User DEMONSTRATED (the recording):
${workflow.metadata.description || "User showed a workflow"}

## What User WANTS (the goal):
${workflow.metadata.goal}

## User's Transcript/Instructions:
${workflow.metadata.transcript || "No additional instructions"}

## Demonstrated Steps (what user actually did):
${stepDetails}

# YOUR TASK

Generate production-ready Python code that:
1. **Achieves the GOAL** (not just replays the demonstration)
2. **Uses exact BrowserAgent tool signatures** (see tool definitions below)
3. **Preserves metadata** (nodeIdentificationStrategy → find=, validationStrategy → verify=)
4. **Handles loops intelligently** (if goal says "ALL" but demo shows "ONE" → loop)
5. **Merges redundant steps** (multiple scrolls → skip, multiple clicks → consolidate)
6. **Uses data extraction** (extract data first, then loop on extracted results)
7. **Includes conditional logic** (check MCP availability, fallback to browser automation)
8. **Is atomic and reliable** (each step is a single, executable tool call)

# AVAILABLE BROWSERAGENT TOOLS

## Navigation
- navigate(url, verify="condition")
  Example: navigate("https://gmail.com", verify="URL contains gmail.com")

## Interaction
- click(description, find="how to identify element", verify="success condition")
  Example: click("login button", find="Blue button labeled 'Sign In'", verify="Dashboard page loads")

- type(description, text, find="how to identify field", verify="success condition")
  Example: type("email field", "user@example.com", find="Input with placeholder 'Email'", verify="Text appears in field")

- clear(description, find="how to identify field")

- scroll(direction="down", amount=500)
  OR scroll(description, find="element to scroll to")

- key(key_name)
  Example: key("Enter")

## Data Extraction
- extract(format={schema}, task="what to extract")
  Example: extract(format={"movies": [{"name": "string"}]}, task="Extract all movie names from the list")
  Returns: Dictionary matching the format schema

## Tab Operations
- tabs()  # List all tabs
- tab_open(url=None)  # Open new tab
- tab_focus(tab_id)  # Switch to tab
- tab_close(tab_id)  # Close tab

## MCP Integration (for Google Docs, Gmail, Calendar, etc.)
- mcp(action="getUserInstances")
  Returns: List of available MCP instances

- mcp(action="listTools", instanceId="id")
  Returns: Available tools for that instance

- mcp(action="callTool", instanceId="id", toolName="name", toolArgs={...})
  Executes the MCP tool

**MCP Pattern (3-step process):**
\`\`\`python
# Step 1: Check availability
instances = mcp(action="getUserInstances")
# Step 2: List tools
tools = mcp(action="listTools", instanceId=instance_id)
# Step 3: Call tool
result = mcp(action="callTool", instanceId=instance_id, toolName="create_document", toolArgs={...})
\`\`\`

## Completion
- done(success=True, message="completion message")

# SMART GENERATION RULES

## 1. Loop Detection
Compare GOAL vs DEMONSTRATION:
- Goal says "ALL newsletters", Demo shows "ONE newsletter" → Use while/for loop
- Goal says "20 people", Demo shows "1 person" → Use for loop with range(20)
- Goal matches demo exactly → No loop needed

## 2. Step Merging & Noise Removal
- Multiple consecutive scrolls → Remove or use single scroll
- Clicking elements to select them for extraction → Replace with extract() tool
- Redundant navigation or tab operations → Consolidate
- Unnecessary intermediate steps → Skip

## 3. Data Extraction Pattern
When goal involves processing multiple items:
\`\`\`python
# Extract data FIRST
items = extract(format={"items": [...]}, task="Extract all items")

# Then loop on extracted data
for item in items["items"]:
    # Process each item
\`\`\`

## 4. MCP Conditional Logic
For Google services (Docs, Sheets, Gmail, Calendar):
\`\`\`python
# Check MCP availability
instances = mcp(action="getUserInstances")
google_docs_available = any(i["name"] == "Google Docs" for i in instances["instances"])

if google_docs_available:
    # Use MCP
    doc_instance = next(i for i in instances["instances"] if i["name"] == "Google Docs")
    tools = mcp(action="listTools", instanceId=doc_instance["id"])
    result = mcp(action="callTool", instanceId=doc_instance["id"], toolName="create_document", toolArgs={...})
else:
    # Fallback to browser automation
    tab_open()
    navigate("https://docs.google.com/create")
    # ... manual steps
\`\`\`

## 5. Metadata Preservation
Always include find= and verify= from the semantic workflow:
- step.action.nodeIdentificationStrategy → find="..."
- step.action.validationStrategy → verify="..."

## 6. Tool Signature Accuracy
Use EXACT tool signatures - don't invent new tools or parameters.
- ✅ click("button", find="...", verify="...")
- ❌ bos.click("button", find="...", verify="...")  # No bos. prefix
- ❌ visual_click("button")  # Agent will choose visual fallback if needed

# OUTPUT FORMAT

Generate clean Python code with:
1. **Header comment** with workflow name and goal
2. **Phase comments** (# Setup, # Extract data, # Process items, # Cleanup)
3. **Proper indentation** (4 spaces)
4. **Clear variable names**
5. **Complete conditional flows** (MCP checks, loop conditions)
6. **Safety limits** on loops (max_iterations)
7. **Final done() call** with summary message

# EXAMPLE OUTPUT

\`\`\`python
# Workflow: IMDb Movie Research
# Goal: Extract all movies from Claude AI page, search each on IMDb, compile details in Google Doc

# Setup: Navigate to source page
navigate("https://claude.ai/chat/fd961e2a-df8c-42e3-94da-2df75b9b54e3",
    verify="URL matches and page title contains 'Best action movie'")

# Extract movie list from page
movies = extract(
    format={"movies": [{"name": "string"}]},
    task="Extract all movie names from the ordered list on the page"
)

# Check Google Docs MCP availability
instances = mcp(action="getUserInstances")
docs_available = any(i["name"] == "Google Docs" for i in instances.get("instances", []))

if docs_available:
    docs_instance = next(i for i in instances["instances"] if i["name"] == "Google Docs")
    tools = mcp(action="listTools", instanceId=docs_instance["id"])
    doc = mcp(action="callTool", instanceId=docs_instance["id"],
              toolName="create_document", toolArgs={"title": "Movie Details"})
    use_mcp = True
else:
    tab_open()
    navigate("https://docs.google.com/document/create",
        verify="Google Docs editor loads")
    use_mcp = False

# Process each movie
count = 0
max_iterations = 50

for movie_data in movies["movies"]:
    if count >= max_iterations:
        break

    movie_name = movie_data["name"]

    # Search IMDb
    tab_open()
    navigate("https://www.imdb.com/",
        verify="URL contains imdb.com")

    click("search bar",
        find="Input field at top with placeholder 'Search IMDb'",
        verify="Search bar is focused")

    type("search input", movie_name,
        find="Active search input field",
        verify=f"Text '{movie_name}' appears in field")

    click("first search result",
        find="First result containing movie title and actor names",
        verify="Movie page loads with title and details")

    # Extract movie details
    details = extract(
        format={"title": "string", "year": "number", "rating": "string", "summary": "string"},
        task="Extract movie title, year, rating, and plot summary"
    )

    # Write to Google Doc
    if use_mcp:
        mcp(action="callTool", instanceId=docs_instance["id"],
            toolName="append_text",
            toolArgs={"text": f"{details['title']} ({details['year']}): {details['summary']}\\n\\n"})
    else:
        type("document body", f"{details['title']} ({details['year']}): {details['summary']}",
            find="Main editable area of document",
            verify="Text appears in document")

    tab_close()
    count += 1

done(True, f"Compiled details for {count} movies in Google Doc")
\`\`\`

Now generate the executable workflow code for the provided semantic workflow. Output ONLY the Python code block, nothing else.
`;
}
