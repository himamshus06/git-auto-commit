const OpenAI = require('openai');
require('dotenv').config();

const openai = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1"
});

/**
 * Generates a professional commit message based on the provided git diff.
 * For large diffs, it uses a map-reduce approach:
 * 1. Splits the diff into manageable chunks.
 * 2. Summarizes each chunk.
 * 3. Combines summaries into one final commit message.
 *
 * @param {string} diff - The git diff of staged changes.
 * @returns {Promise<string>} - The generated commit message.
 * @throws {Error} - If API key is missing or API call fails.
 */
async function generateCommitMessage(diff) {
    if (!process.env.GROQ_API_KEY) {
        throw new Error('GROQ_API_KEY is missing from .env file.');
    }

    const CHUNK_SIZE = 8000; // Characters per chunk to stay under token limits
    const isLargeDiff = diff.length > CHUNK_SIZE;

    if (!isLargeDiff) {
        return await getSingleCommitMessage(diff);
    }

    console.log(`Large diff detected (${diff.length} chars). Using chunked summary approach...`);

    // 1. Map: Split diff into chunks and generate summaries for each
    const chunks = [];
    for (let i = 0; i < diff.length; i += CHUNK_SIZE) {
        chunks.push(diff.substring(i, i + CHUNK_SIZE));
    }

    const summaryPromises = chunks.map(async (chunk, index) => {
        const prompt = `Analyze this portion (${index + 1}/${chunks.length}) of a git diff and provide a 1-sentence summary of the changes.
Diff snippet:
${chunk}`;

        try {
            const response = await openai.chat.completions.create({
                model: 'qwen/qwen3.8-27b',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.2,
                max_tokens: 100,
            });
            return response.choices[0].message.content.trim();
        } catch (e) {
            return `Error summarizing chunk ${index + 1}: ${e.message}`;
        }
    });

    const summaries = await Promise.all(summaryPromises);
    const combinedSummaries = summaries.join('\n');

    // 2. Reduce: Combine all summaries into one final professional commit message
    const finalPrompt = `
Based on the following summaries of changes across multiple files, write one professional, concise commit message.
Follow the Conventional Commits specification (e.g., feat: ..., fix: ..., chore: ..., docs: ..., style: ..., refactor: ..., perf: ..., test: ...).
Only return the commit message string itself, without any quotes or explanation.

Summaries:
${combinedSummaries}
    `.trim();

    try {
        const response = await openai.chat.completions.create({
            model: 'qwen/qwen3.8-27b',
            messages: [{ role: 'user', content: finalPrompt }],
            temperature: 0.2,
            max_tokens: 100,
        });

        return response.choices[0].message.content.trim();
    } catch (error) {
        throw new Error(`Final reduction failed: ${error.message}`);
    }
}

/**
 * Helper to generate a commit message from a single diff (used for small changes).
 */
async function getSingleCommitMessage(diff) {
    const prompt = `
Analyze the following git diff and write a professional, concise commit message.
Follow the Conventional Commits specification (e.g., feat: ..., fix: ..., chore: ..., docs: ..., style: ..., refactor: ..., perf: ..., test: ...).
Only return the commit message string itself, without any quotes or explanation.

Diff:
${diff}
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
