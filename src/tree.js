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
 * Parse a visual directory tree.
 *
 * Supported format:
 *
 * my-project/
 * ├── src/
 * │   ├── index.js
 * │   └── utils.js
 * ├── public/
 * │   └── index.html
 * └── package.json
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

        let name;
        let depth;

        // --------------------------------------------------
        // ROOT
        // --------------------------------------------------

        if (i === 0) {
            name = line.trim();
            depth = 0;
        }

        // --------------------------------------------------
        // CHILD
        // --------------------------------------------------

        else {
            /*
             * Match:
             *
             * ├── src/
             * └── package.json
             *
             * │   ├── index.js
             * │   └── utils.js
             *
             * │   │   └── Button.jsx
             */

            const match = line.match(
                /^((?:│   |    )*)(?:├── |└── |\+-- |`-- )(.*)$/
            );

            if (!match) {
                throw new TreeParseError(
                    `Could not parse line: "${line}"`,
                    lineNum
                );
            }

            const indentation = match[1];
            name = match[2].trim();

            /*
             * Every 4 characters of indentation
             * represents one level.
             *
             * ├── src/              depth 1
             * │   ├── index.js      depth 2
             * │   │   └── x.js      depth 3
             */

            depth = indentation.length / 4 + 1;
        }

        if (!name) {
            throw new TreeParseError(
                'Empty file/directory name',
                lineNum
            );
        }

        // --------------------------------------------------
        // STACK
        // --------------------------------------------------

        /*
         * If we're moving back up the tree,
         * remove deeper entries.
         *
         * Example:
         *
         * │   ├── index.js
         * │   └── utils.js
         *
         * When utils.js is processed, index.js
         * must be removed from the stack.
         */

        while (stack.length > depth) {
            stack.pop();
        }

        /*
         * Make sure we aren't jumping over a level.
         */
        if (depth > stack.length) {
            throw new TreeParseError(
                `Invalid nesting at depth ${depth}`,
                lineNum
            );
        }

        // --------------------------------------------------
        // FILE / DIRECTORY
        // --------------------------------------------------

        const isDirectory = name.endsWith('/');

        const cleanName = name.replace(/\/$/, '');

        // --------------------------------------------------
        // PATH
        // --------------------------------------------------

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
 * Create files and directories from parsed tree.
 */
async function parseAndCreateTree(text) {
    const created = [];
    const errors = [];

    let treeStructure;

    try {
        treeStructure = parseTree(text);
    } catch (err) {
        if (err instanceof TreeParseError) {
            throw err;
        }

        throw new Error(`Unexpected parsing error: ${err.message}`);
    }

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

    return {
        created,
        errors
    };
}

module.exports = {
    parseTree,
    parseAndCreateTree,
    TreeParseError
};