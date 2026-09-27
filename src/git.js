const { simpleGit } = require('simple-git');
const git = simpleGit();
const fs = require('fs').promises;
const path = require('path');

/**
 * Checks if the current directory is a git repository.
 * @returns {Promise<boolean>}
 */
async function isGitRepo() {
    try {
        await git.revparse(['--is-inside-work-tree']);
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Stages all changes in the repository.
 * @returns {Promise<void>}
 */
async function stageAll() {
    await git.add('.');
}

/**
 * Retrieves the diff of currently staged changes.
 * @returns {Promise<string>}
 */
async function getStagedDiff() {
    return await git.diff(['--cached']);
}

/**
 * Commits the staged changes with the given message.
 * @param {string} message - The commit message to use.
 * @returns {Promise<void>}
 */
async function commit(message) {
    await git.commit(message);
}

/**
 * Safely appends a file path to .gitignore if it's not already present.
 * @param {string} filePath - The path to the file to ignore.
 */
async function appendToGitignore(filePath) {
    const relativePath = path.relative(process.cwd(), filePath);
    try {
        let content = '';
        try {
            content = await fs.readFile('.gitignore', 'utf8');
        } catch (e) {
            // File doesn't exist, which is fine
        }

        if (!content.includes(relativePath)) {
            await fs.appendFile('.gitignore', `\n${relativePath}`);
        }
    } catch (e) {
        console.error(`Error updating .gitignore: ${e.message}`);
    }
}

module.exports = {
    isGitRepo,
    stageAll,
    getStagedDiff,
    commit,
    appendToGitignore
};
