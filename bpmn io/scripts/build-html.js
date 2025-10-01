const fs = require('fs/promises');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const templatePath = path.join(projectRoot, 'src', 'bpmn.template.html');
const bundlePath = path.join(projectRoot, 'build', 'app.bundle.js');
const outputPath = path.join(projectRoot, 'bpmn.html');
const placeholder = '<!-- INLINE_BUNDLE -->';

async function run() {
  const [template, bundle] = await Promise.all([
    fs.readFile(templatePath, 'utf8'),
    fs.readFile(bundlePath, 'utf8')
  ]);

  if (!template.includes(placeholder)) {
    throw new Error(`Placeholder ${placeholder} not found in template`);
  }

  const inlineScript = `<script>\n${bundle}\n</script>`;
  const output = template.replace(placeholder, inlineScript);

  await fs.writeFile(outputPath, output, 'utf8');
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
