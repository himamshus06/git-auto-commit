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
        // We find the first character that isn't a tree symbol or whitespace
        const match = line.match(/^([│\s├└]*)(.*)$/);
        if (!match) continue;

        const prefix = match[1];
        let name = match[2].trim();

        if (!name) continue;

        // Depth is determined by the number of "blocks" of indentation.
        // Most trees use 4 chars per level (e.g., "│   " or "├── ").
        const depth = Math.floor(prefix.length / 4);

        // 2. Adjust stack to current depth
        while (stack.length > depth) {
            stack.pop();
        }

        // 3. Clean name (remove trailing slash for directory creation)
        const isDirectory = name.endsWith('/') || !name.includes('.');
        const cleanName = isDirectory ? name.replace(/\/$/, '') : name;

        stack.push(cleanName);

        // 4. Form full path
        const fullPath = path.join(...stack);
        try {
            if (isDirectory) {
                fs.mkdirSync(fullPath, { recursive: true });
            } else {
                // Ensure parent directory exists
                const parentDir = path.dirname(fullPath);
                fs.mkdirSync(parentDir, { recursive: true });
                fs.writeFileSync(fullPath, ''); // Create empty file
            }
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
