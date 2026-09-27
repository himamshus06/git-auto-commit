#!/usr/bin/env node
const { Command } = require('commander');
const readline = require('node:readline/promises');
const { stdin: input, stdout: output } = require('node:process');
const git = require('./git');
const ai = require('./ai');
const tree = require('./tree');
const security = require('./security');
require('dotenv').config();

const program = new Command();

program
    .name('git-auto')
    .description('AI-powered git commit tool')
    .version('1.0.0');

program
    .command('commit')
    .description('Automatically stage and commit changes with an AI-generated message')
    .option('-m, --message <message>', 'override the AI-generated commit message')
    .option('--dry-run', 'preview the generated message without committing')
    .action(async (options) => {
        const rl = readline.createInterface({ input, output });
        try {
            if (!(await git.isGitRepo())) {
                console.error('Error: Current directory is not a git repository.');
                process.exit(1);
            }

            console.log('Staging changes...');
            await git.stageAll();

            const diff = await git.getStagedDiff();
            if (!diff) {
                console.log('No changes to commit.');
                rl.close();
                return;
            }

            let commitMessage;
            if (options.message) {
                commitMessage = options.message;
                console.log(`Using custom message: ${commitMessage}`);
            } else {
                console.log('Generating AI commit message...');
                commitMessage = await ai.generateCommitMessage(diff);
                console.log(`\nGenerated message: ${commitMessage}\n`);

                if (!options.dryRun) {
                    const choice = await rl.question('(A)ccept, (E)dit, or (D)ecline? [a/e/d]: ');
                    const action = choice.toLowerCase().trim();

                    if (action === 'd') {
                        console.log('Commit cancelled by user.');
                        rl.close();
                        return;
                    } else if (action === 'e') {
                        const newMessage = await rl.question('Enter new commit message: ');
                        commitMessage = newMessage.trim() || commitMessage;
                        console.log(`Updated message: ${commitMessage}`);
                    } else {
                        // Default to accept
                    }
                }
            }

            if (options.dryRun) {
                console.log('Dry run enabled. Skipping commit.');
            } else {
                console.log('Committing changes...');
                await git.commit(commitMessage);
                console.log('Successfully committed changes!');
            }

        } catch (error) {
            console.error(`Error: ${error.message}`);
            process.exit(1);
        } finally {
            rl.close();
        }
    });

program
    .command('tree')
    .description('Create directories from a pasted directory tree')
    .action(async () => {
        const rl = readline.createInterface({ input, output });
        console.log('Paste your directory tree below. Type \'DONE\' on a new line to finish:');

        let treeText = '';
        while (true) {
            const line = await rl.question('');
            if (line.trim().toUpperCase() === 'DONE') break;
            treeText += line + '\n';
        }

        try {
            const result = await tree.parseAndCreateTree(treeText);
            if (result.created.length > 0) {
                console.log('\nSuccessfully created directories:');
                result.created.forEach(dir => console.log(`  - ${dir}`));
            }
            if (result.errors.length > 0) {
                console.log('\nErrors encountered:');
                result.errors.forEach(err => console.error(`  - ${err}`));
            }
        } catch (error) {
            console.error(`\nError: ${error.message}`);
        } finally {
            rl.close();
        }
    });


program
    .command('secure')
    .description('Scan for security lapses, generate a report, and update .gitignore')
    .action(async () => {
        await security.runSecure();
    });

program.parse(process.argv);
