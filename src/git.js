const { simpleGit } = require('simple-git');
const git = simpleGit();

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

module.exports = {
    isGitRepo,
    stageAll,
    getStagedDiff,
    commit
};
