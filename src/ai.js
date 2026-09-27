const OpenAI = require('openai');
require('dotenv').config();

/**
 * Base class for AI Providers.
 * Defines the interface that all providers must implement.
 */
class AIProvider {
    async generate(prompt, options = {}) {
        throw new Error('Method generate() must be implemented');
    }
}

/**
 * Provider for any service that follows the OpenAI API specification.
 * This covers Groq, OpenAI, LM Studio, and Ollama (/v1).
 */
class OpenAICompatibleProvider extends AIProvider {
    constructor(config) {
        super();
        this.client = new OpenAI({
            apiKey: config.apiKey || 'ollama',
            baseURL: config.baseURL
        });
        this.model = config.model;
    }

    async generate(prompt, options = {}) {
        const response = await this.client.chat.completions.create({
            model: this.model,
            messages: [{ role: 'user', content: prompt }],
            temperature: options.temperature ?? 0.2,
            max_tokens: options.maxTokens ?? 100,
        });
        return response.choices[0].message.content.trim();
    }
}

/**
 * Factory to instantiate the appropriate AI provider based on configuration.
 */
function getAIProvider() {
    const providerType = process.env.AI_PROVIDER || 'groq';
    const apiKey = process.env.AI_API_KEY || process.env.GROQ_API_KEY;
    const baseURL = process.env.AI_BASE_URL || (providerType === 'groq' ? 'https://api.groq.com/openai/v1' : 'http://localhost:11434/v1');
    const model = process.env.AI_MODEL || (providerType === 'groq' ? 'qwen/qwen3.8-27b' : 'llama3');

    // Validation for cloud providers
    if (!apiKey && providerType !== 'ollama' && providerType !== 'local') {
        throw new Error(`API key is missing for provider "${providerType}". Please set AI_API_KEY in your .env file.`);
    }

    switch (providerType.toLowerCase()) {
        case 'openai':
        case 'groq':
        case 'ollama':
        case 'local':
            return new OpenAICompatibleProvider({ apiKey, baseURL, model });
        default:
            throw new Error(`Unsupported AI provider: ${providerType}`);
    }
}

/**
 * Generates a professional commit message based on the provided git diff.
 */
async function generateCommitMessage(diff) {
    const provider = getAIProvider();
    const CHUNK_SIZE = 8000;
    const isLargeDiff = diff.length > CHUNK_SIZE;

    if (!isLargeDiff) {
        return await getSingleCommitMessage(provider, diff);
    }

    console.log(`Large diff detected (${diff.length} chars). Using chunked summary approach...`);

    const chunks = [];
    for (let i = 0; i < diff.length; i += CHUNK_SIZE) {
        chunks.push(diff.substring(i, i + CHUNK_SIZE));
    }

    const summaryPromises = chunks.map(async (chunk, index) => {
        const prompt = `Analyze this portion (${index + 1}/${chunks.length}) of a git diff and provide a 1-sentence summary of the changes.\nDiff snippet:\n${chunk}`;
        try {
            return await provider.generate(prompt);
        } catch (e) {
            return `Error summarizing chunk ${index + 1}: ${e.message}`;
        }
    });

    const summaries = await Promise.all(summaryPromises);
    const combinedSummaries = summaries.join('\n');

    const finalPrompt = `
Based on the following summaries of changes across multiple files, write one professional, concise commit message.
Follow the Conventional Commits specification (e.g., feat: ..., fix: ..., chore: ..., docs: ..., style: ..., refactor: ..., perf: ..., test: ...).
Only return the commit message string itself, without any quotes or explanation.

Summaries:
${combinedSummaries}
    `.trim();

    try {
        return await provider.generate(finalPrompt);
    } catch (error) {
        throw new Error(`Final reduction failed: ${error.message}`);
    }
}

/**
 * Helper to generate a commit message from a single diff.
 */
async function getSingleCommitMessage(provider, diff) {
    const prompt = `
Analyze the following git diff and write a professional, concise commit message.
Follow the Conventional Commits specification (e.g., feat: ..., fix: ..., chore: ..., docs: ..., style: ..., refactor: ..., perf: ..., test: ...).
Only return the commit message string itself, without any quotes or explanation.

Diff:
${diff}
    `.trim();

    try {
        return await provider.generate(prompt);
    } catch (error) {
        throw new Error(`AI generation failed: ${error.message}`);
    }
}

module.exports = {
    generateCommitMessage,
    getAIProvider
};
