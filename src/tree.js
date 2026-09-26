const fs = require('node:fs');
const path = require('node:path');

/**
 * Custom error for tree parsing failures
 */
class TreeParseError extends Error {
    constructor(message, line) {
        super(line ? `Line ${line}: ${message}` : message);
        this.name = 'TreeParseError';
    }
}

/**
 * Symbols used to define tree structures
 */
const SYMBOLS = {
    unicode: {
        vertical: '│',
        branch: '├',
        leaf: '└',
        space: ' '
    },
    ascii: {
        vertical: '|',
        branch: '+',
        leaf: '`',
        space: ' '
    }
};

/**
 * Parses a visual tree string into a structured array of items.
 *
 * @param {string} text - The visual directory tree string.
 * @returns {Array<{name: string, depth: number, isDirectory: boolean, fullPath: string}>}
 * @throws {TreeParseError}
 */
function parseTree(text) {
    if (!text || text.trim() === '') {
        throw new TreeParseError('No tree provided');
    }

    const lines = text.split('\n').filter(line => line.trim() !== '');
    const stack = [];
    const result = [];
    let currentDepth = -1;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;

        // Regex to split prefix symbols/spaces from the actual name
        const match = line.match(/^([│\s├└| \+`-]*) (.*)$/) || line.match(/^([│\s├└| \+`-]*)(.*)$/);
        if (!match) continue;

        const prefix = match[1];
        let name = match[2].trim();

        if (!name) continue;

        // Calculate depth based on "indentation units"
        // A unit is typically 4 characters (symbol + 3 spaces) or similar.
        // We count how many vertical bars or space blocks exist before the branch symbol.
        const depth = calculateDepth(prefix);

        // Logical Validation: Continuity Check
        if (depth > currentDepth + 1) {
            throw new TreeParseError(`Nesting depth jump detected (from ${currentDepth + 1} to ${depth})`, lineNum);
        }

        // Adjust stack to current depth
        while (stack.length > depth) {
            stack.pop();
        }

        // Reliable Type Detection
        const isDirectory = name.endsWith('/') || (!name.includes('.') && !name.startsWith('.'));
        const cleanName = isDirectory ? name.replace(/\/$/, '') : name;

        stack.push(cleanName);
        const fullPath = path.join(...stack);

        result.push({
            name: cleanName,
            depth,
            isDirectory,
            fullPath
        });

        currentDepth = depth;
    }

    return result;
}

/**
 * Determines the depth of a line based on its prefix.
 * Supports both Unicode and ASCII styles.
 *
 * @param {string} prefix
 * @returns {number}
 */
function calculateDepth(prefix) {
    if (!prefix) return 0;

    // Standard visual trees use blocks of 4 characters per level (e.g., "│   " or "    ")
    // We count these blocks.
    let depth = 0;
    let i = 0;
    while (i < prefix.length) {
        // Check if we've reached the terminal branch symbol (├ or └ or + or `)
        if (prefix[i] === SYMBOLS.unicode.branch || prefix[i] === SYMBOLS.unicode.leaf ||
            prefix[i] === SYMBOLS.ascii.branch || prefix[i] === SYMBOLS.ascii.leaf) {
            break;
        }

        // Increment depth for every "unit" of indentation
        // We assume a unit is 4 characters wide in most common formats
        depth++;
        i += 4;
    }

    // Because we increment depth for every 4-char block,
    // we need to handle cases where the prefix is shorter than a full block.
    // A more robust way is to count actual vertical markers.
    const markers = (prefix.match(/[│|]/g) || []).length;

    // Heuristic: If we have markers, that's our depth.
    // Otherwise, we use the space-based block count.
    if (markers > 0) return markers;

    return Math.floor(prefix.length / 4);
}

/**
 * Parses a visual directory tree and creates the corresponding directories/files.
 *
 * @param {string} text - The visual directory tree string.
 * @returns {Promise<{created: string[], errors: string[]}>}
 */
async function parseAndCreateTree(text) {
    const created = [];
    const errors = [];

    try {
        const treeStructure = parseTree(text);

        for (const item of treeStructure) {
            try {
                if (item.isDirectory) {
                    fs.mkdirSync(item.fullPath, { recursive: true });
                } else {
                    const parentDir = path.dirname(item.fullPath);
                    fs.mkdirSync(parentDir, { recursive: true });
                    fs.writeFileSync(item.fullPath, '');
                }
                created.push(item.fullPath);
            } catch (err) {
                errors.push(`Failed to create ${item.fullPath}: ${err.message}`);
            }
        }
    } catch (err) {
        if (err instanceof TreeParseError) {
            throw err; // Rethrow parsing errors for the CLI to handle
        }
        throw new Error(`Unexpected error: ${err.message}`);
    }

    return { created, errors };
}

module.exports = {
    parseAndCreateTree,
    parseTree,
    TreeParseError
};
