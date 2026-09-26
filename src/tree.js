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
 * Parse a visual directory tree into structured items.
 */
function parseTree(text) {
    if (!text || text.trim() === '') {
        throw new TreeParseError('No tree provided');
    }

    const lines = text
        .split(/\r?\n/)
        .filter(line => line.trim() !== '');

    const result = [];
    const stack = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;

        const parsed = parseLine(line);

        if (!parsed) {
            throw new TreeParseError(
                `Unable to parse tree line: "${line}"`,
                lineNum
            );
        }

        const { name, depth } = parsed;

        // Root must be depth 0
        if (i === 0 && depth !== 0) {
            throw new TreeParseError(
                'Root item must have depth 0',
                lineNum
            );
        }

        // Prevent impossible jumps
        if (depth > stack.length) {
            throw new TreeParseError(
                `Nesting depth jump detected`,
                lineNum
            );
        }

        // Remove anything deeper than the current item
        while (stack.length > depth) {
            stack.pop();
        }

        // Detect directory/file
        const isDirectory = detectDirectory(name);

        const cleanName = isDirectory
            ? name.replace(/\/$/, '')
            : name;

        // Add current item to stack
        stack.push(cleanName);

        const fullPath = path.join(...stack);

        result.push({
            name: cleanName,
            depth,
            isDirectory,
            fullPath
        });
    }

    return result;
}

/**
 * Parse one line of a tree.
 */
function parseLine(line) {
    // Root:
    // project/
    if (!/^[│|├└+`]/.test(line)) {
        return {
            name: line.trim(),
            depth: 0
        };
    }

    /*
     * Match tree indentation.
     *
     * Examples:
     *
     * ├── src/
     * └── package.json
     *
     * │   ├── components/
     * │   └── App.jsx
     *
     * │   │   └── Button.jsx
     */

    const match = line.match(/^((?:│   |    )*)(?:├── |└── |\+-- |`-- )(.*)$/);

    if (!match) {
        return null;
    }

    const indentation = match[1];
    const name = match[2].trim();

    // Every 4-character indentation block = one level.
    const depth = indentation.length / 4 + 1;

    return {
        name,
        depth
    };
}

/**
 * Determine whether an item is a directory.
 *
 * Best case: directories end with /.
 *
 * For trees that don't include /, this falls back to
 * extension-based detection.
 */
function detectDirectory(name) {
    // Explicit directory marker
    if (name.endsWith('/')) {
        return true;
    }

    // Hidden files like .gitignore are files
    if (name.startsWith('.')) {
        return false;
    }

    // Files with extensions are files
    if (path.extname(name) !== '') {
        return false;
    }

    // Otherwise assume directory
    return true;
}

/**
 * Parse tree and create files/directories.
 */
async function parseAndCreateTree(text) {
    const created = [];
    const errors = [];

    try {
        const treeStructure = parseTree(text);

        for (const item of treeStructure) {
            try {
                if (item.isDirectory) {
                    fs.mkdirSync(item.fullPath, {
                        recursive: true
                    });
                } else {
                    const parentDir = path.dirname(item.fullPath);

                    fs.mkdirSync(parentDir, {
                        recursive: true
                    });

                    fs.writeFileSync(item.fullPath, '');
                }

                created.push(item.fullPath);
            } catch (err) {
                errors.push(
                    `Failed to create ${item.fullPath}: ${err.message}`
                );
            }
        }
    } catch (err) {
        if (err instanceof TreeParseError) {
            throw err;
        }

        throw new Error(`Unexpected error: ${err.message}`);
    }

    return {
        created,
        errors
    };
}

module.exports = {
    parseAndCreateTree,
    parseTree,
    TreeParseError
};