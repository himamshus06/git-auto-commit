#!/usr/bin/env node
const { Command } = require('commander');
const readline = require('node:readline/promises');
const { stdin: input, stdout: output } = require('node:process');
const git = require('./git');
const ai = require('./ai');
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

program.parse(process.argv);
