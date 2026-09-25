const OpenAI = require('openai');
require('dotenv').config();

const openai = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1"
});

/**
 * Generates a professional commit message based on the provided git diff.
 * @param {string} diff - The git diff of staged changes.
 * @returns {Promise<string>} - The generated commit message.
 * @throws {Error} - If API key is missing or API call fails.
 */
async function generateCommitMessage(diff) {
    if (!process.env.GROQ_API_KEY) {
        throw new Error('GROQ_API_KEY is missing from .env file.');
    }

    // TRUNCATION LOGIC:
    // Prevent "Request too large" errors by limiting the diff size.
    // 10,000 characters is usually enough to understand the changes
    // while staying safely under free-tier token limits.
    const MAX_DIFF_LENGTH = 10000;
    let processedDiff = diff;
    if (diff.length > MAX_DIFF_LENGTH) {
        processedDiff = diff.substring(0, MAX_DIFF_LENGTH) +
                        '\n\n... (diff truncated due to size)';
    }

    const prompt = `
Analyze the following git diff and write a professional, concise commit message.
Follow the Conventional Commits specification (e.g., feat: ..., fix: ..., chore: ..., docs: ..., style: ..., refactor: ..., perf: ..., test: ...).
Only return the commit message string itself, without any quotes or explanation.

Diff:
${processedDiff}
    `.trim();

    try {
        const response = await openai.chat.completions.create({
            model: 'qwen/qwen3.8-27b',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.2,
            max_tokens: 100,
        });

        return response.choices[0].message.content.trim();
    } catch (error) {
        throw new Error(`AI generation failed: ${error.message}`);
    }
}

module.exports = {
    generateCommitMessage
};
