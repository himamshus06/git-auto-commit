const fs = require('node:fs');
const path = require('node:path');

/**
 * Parses a visual directory tree and creates the corresponding directories.
 * @param {string} text - The visual directory tree string.
 * @returns {Promise<{created: string[], errors: string[]}>}
 */
async function parseAndCreateTree(text) {
    if (!text || text.trim() === '') {
        throw new Error('No tree provided');
    }

    const lines = text.split('\n').filter(line => line.trim() !== '');
    const stack = [];
    const created = [];
    const errors = [];

    for (const line of lines) {
        // 1. Determine depth
        // Depth is based on the number of leading spaces/tree characters.
        // Standard tree indentation is typically 4 spaces or characters.
        const match = line.match(/^([│\s├└]*)(.*)$/);
        if (!match) continue;

        const prefix = match[1];
        const name = match[2].trim();

        if (!name) continue;

        // Calculate depth based on the prefix.
        // Each 'level' in a standard tree is usually 4 characters.
        const depth = Math.floor(prefix.length / 4);

        // 2. Adjust stack to current depth
        while (stack.length > depth) {
            stack.pop();
        }

        // 3. Push clean name to stack
        stack.push(name.endsWith('/') ? name.slice(0, -1) : name);

        // 4. Form full path and create directory
        const fullPath = path.join(...stack);
        try {
            fs.mkdirSync(fullPath, { recursive: true });
            created.push(fullPath);
        } catch (err) {
            errors.push(`Failed to create ${fullPath}: ${err.message}`);
        }
    }

    return { created, errors };
}

module.exports = {
    parseAndCreateTree
};
