import path from 'node:path';

const cwd = process.cwd();

function relTo(dir, files) {
  return files.map((f) => path.relative(path.join(cwd, dir), f)).join(' ');
}

export default {
  'frontend/src/**/*.{ts,html}': (files) => {
    const rel = relTo('frontend', files);
    return [
      `bash -c 'cd frontend && ./node_modules/.bin/eslint --fix ${rel}'`,
      `./node_modules/.bin/prettier --write ${files.join(' ')}`,
    ];
  },
  'backend/src/**/*.ts': (files) => {
    const rel = relTo('backend', files);
    return [
      `bash -c 'cd backend && ./node_modules/.bin/eslint --fix ${rel}'`,
      `./node_modules/.bin/prettier --write ${files.join(' ')}`,
    ];
  },
  '**/*.{json,yaml,yml,md}': (files) =>
    `./node_modules/.bin/prettier --write ${files.join(' ')}`,
  '**/*': (files) =>
    `./node_modules/.bin/secretlint --secretlintignore .secretlintignore ${files.join(' ')}`,
};
