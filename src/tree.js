const fs = require('node:fs');
const path = require('node:path');

class TreeParseError extends Error {
    constructor(message, line) {
        super(line ? `Line ${line}: ${message}` : message);
        this.name = 'TreeParseError';
    }
}

// Every character that can appear in a branch-drawing prefix, unicode or ascii style.
// Note the U+2500 box-drawing horizontal (─) — NOT an ascii hyphen (-). Real tree
// output (and most pasted trees) uses U+2500, which is why the old regex silently
// failed to strip prefixes correctly.
const PREFIX_CHARS = /[│├└|+`\-─\s]/;
const CONNECTOR_CHARS = new Set(['├', '└', '+', '`']);

function parseTree(text) {
    if (!text || text.trim() === '') {
        throw new TreeParseError('No tree provided');
    }
    const lines = text.split('\n').filter(line => line.trim() !== '');
    const stack = [];
    const result = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;

        // Find the connector character (├ / └ / ascii + / `), if any.
        let connectorIdx = -1;
        for (let c = 0; c < line.length; c++) {
            if (CONNECTOR_CHARS.has(line[c])) { connectorIdx = c; break; }
        }

        let depth, rest;
        if (connectorIdx === -1) {
            // No connector at all -> this is the root line itself.
            depth = 0;
            rest = line.trim();
        } else {
            const prefix = line.slice(0, connectorIdx);
            // Each ancestor level draws a fixed 4-char block ("│   " or "    ").
            // +1 because having a connector at all means "at least one level below root".
            depth = Math.round(prefix.length / 4) + 1;
            rest = line.slice(connectorIdx);
        }

        // Strip any remaining connector/line-drawing/space characters to get the name.
        const name = rest.replace(new RegExp(`^${PREFIX_CHARS.source}+`), '').trim();
        if (!name) continue;

        if (depth > stack.length) {
            throw new TreeParseError(
                `Nesting depth jump detected (from ${stack.length} to ${depth})`, lineNum
            );
        }

        while (stack.length > depth) stack.pop();

        const isDirectory = name.endsWith('/') || (!name.includes('.') && !name.startsWith('.'));
        const cleanName = isDirectory ? name.replace(/\/$/, '') : name;

        stack.push(cleanName);
        const fullPath = path.join(...stack);

        result.push({ name: cleanName, depth, isDirectory, fullPath });
    }
    return result;
}

async function parseAndCreateTree(text) {
    const created = [];
    const errors = [];
    const treeStructure = parseTree(text); // let TreeParseError propagate to caller

    for (const item of treeStructure) {
        try {
            if (item.isDirectory) {
                fs.mkdirSync(item.fullPath, { recursive: true });
            } else {
                fs.mkdirSync(path.dirname(item.fullPath), { recursive: true });
                fs.writeFileSync(item.fullPath, '');
            }
            created.push(item.fullPath);
        } catch (err) {
            errors.push(`Failed to create ${item.fullPath}: ${err.message}`);
        }
    }
    return { created, errors };
}

module.exports = { parseAndCreateTree, parseTree, TreeParseError };