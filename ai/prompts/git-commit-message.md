Run `git diff --cached` to see what is staged, and `git log --oneline -5` to see recent commit style.

Before writing the commit message, run the pre-commit checks (e.g. `npx lint-staged` or the project's pre-commit hook) to see if there are any errors. If there are, fix all errors in the relevant files first. Do not fix warnings unless they are blocking. Once the staged changes are clean, write a concise commit message that:

1. Starts with a verb (add, update, fix, refactor, remove)
2. Focuses on **why** the change was made, not what files changed
3. Keeps the subject line under 72 characters
4. Adds a body only if the change needs explanation beyond the subject line

Output the commit message in chat for the user to run themselves. Do NOT run git commit.
