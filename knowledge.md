# Knowledge Base: git-auto AI Implementation

This document serves as a technical reference for the AI architecture of `git-auto`, ensuring future maintainers can extend the provider system without breaking existing functionality.

## Architecture: The Strategy Pattern

The AI system is implemented using the **Strategy Pattern**. This decouples the high-level commit message generation logic from the low-level API communication details.

### Component Breakdown

#### 1. `AIProvider` (Abstract Base Class)
- **Purpose**: Defines the contract for all AI providers.
- **Key Method**: `generate(prompt, options)` - Must be implemented by all subclasses.

#### 2. `OpenAICompatibleProvider` (Concrete Strategy)
- **Purpose**: Handles any AI service that follows the OpenAI chat completion API specification.
- **Scope**: Covers Groq, OpenAI, LM Studio, and Ollama's `/v1` endpoint.
- **Implementation**: Uses the `openai` NPM package.

#### 3. `getAIProvider()` (Factory)
- **Purpose**: Instantiates the correct provider based on environment variables.
- **Logic**: 
    - Checks `AI_PROVIDER` to determine the strategy.
    - Configures `baseURL` and `model` with sensible defaults based on the provider.
    - Performs validation (e.g., ensures `AI_API_KEY` exists for cloud providers).

#### 4. `generateCommitMessage` (Client Logic)
- **Purpose**: Orchestrates the actual commit message generation.
- **Workflow**:
    - Retrieves a provider instance via `getAIProvider()`.
    - Implements a **Map-Reduce** approach for large diffs:
        - **Map**: Splits the diff into chunks ($\approx 8000$ characters) and generates 1-sentence summaries for each.
        - **Reduce**: Combines these summaries into a final, professional commit message.

## Configuration Mapping

| Variable | Purpose | Default (Groq) | Default (Ollama) |
| :--- | :--- | :--- | :--- |
| `AI_PROVIDER` | Determines the strategy class | `groq` | `ollama` |
| `AI_BASE_URL` | API endpoint | `https://api.groq.com/openai/v1` | `http://localhost:11434/v1` |
| `AI_MODEL` | Model Identifier | `qwen/qwen3.8-27b` | `llama3` |

## Future Extension Guide

### How to add a non-OpenAI compatible provider
If a new provider (e.g., Anthropic Claude) is added that does not use the OpenAI spec:
1. Create a new class `ClaudeProvider` extending `AIProvider`.
2. Implement the `generate()` method using the provider's specific SDK.
3. Add the new provider type to the `getAIProvider()` factory switch statement.
4. Update the `.env` documentation in `README.md`.

### How to adjust token limits
To handle larger diffs or more complex models, modify the `CHUNK_SIZE` constant in `generateCommitMessage`.
