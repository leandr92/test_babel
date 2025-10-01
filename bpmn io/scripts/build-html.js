const fs = require('fs/promises');
const path = require('path');
const babel = require('@babel/core');

const projectRoot = path.resolve(__dirname, '..');
const templatePath = path.join(projectRoot, 'src', 'bpmn.template.html');
const bundlePath = path.join(projectRoot, 'build', 'app.bundle.js');
const outputHtmlPath = path.join(projectRoot, 'bpmn.html');
const outputAllInOnePath = path.join(projectRoot, 'bpmn_all_in_one.html');
const outputAllInOneJsPath = path.join(projectRoot, 'bpmn_all_in_one.js');
const bpmnDistroPath = path.join(projectRoot, 'dist', 'bpmn-modeler.development.js');
const jqueryPath = path.join(projectRoot, 'dist', 'jquery.js');
const placeholder = '<!-- INLINE_BUNDLE -->';

const scriptTagPatterns = [
  /[ \t]*<script src="dist\/bpmn-modeler\.development\.js"><\/script>\s*/g,
  /[ \t]*<script src="dist\/jquery\.js"><\/script>\s*/g
];

const cssAssets = [
  {
    href: 'dist/assets/bpmn-js.css',
    path: path.join(projectRoot, 'dist', 'assets', 'bpmn-js.css')
  },
  {
    href: 'dist/assets/diagram-js.css',
    path: path.join(projectRoot, 'dist', 'assets', 'diagram-js.css')
  },
  {
    href: 'dist/assets/bpmn-font/css/bpmn.css',
    path: path.join(projectRoot, 'dist', 'assets', 'bpmn-font', 'css', 'bpmn.css'),
    stripFontFace: true
  }
];

const cssLinkPatterns = cssAssets.map((asset) => new RegExp(
  `[ \t]*<link rel="stylesheet" href="${escapeRegExp(asset.href)}">\s*\n?`,
  'g'
));

const fontAssets = [
  {
    family: 'bpmn',
    weight: 'normal',
    style: 'normal',
    sources: [
      {
        format: 'woff2',
        path: path.join(projectRoot, 'dist', 'assets', 'bpmn-font', 'font', 'bpmn.woff2'),
        mime: 'font/woff2'
      },
      {
        format: 'woff',
        path: path.join(projectRoot, 'dist', 'assets', 'bpmn-font', 'font', 'bpmn.woff'),
        mime: 'font/woff'
      }
    ]
  }
];

function replacePlaceholder(source, value) {
  if (!source.includes(placeholder)) {
    throw new Error(`Placeholder ${placeholder} not found in template`);
  }

  return source.replace(placeholder, () => value);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function indentLines(content, indent = '      ') {
  return content
    .split('\n')
    .map((line) => (line ? `${indent}${line}` : ''))
    .join('\n');
}

function createInlineCssBlock(content) {
  const indented = indentLines(content);
  return `    <style>\n${indented}\n    </style>`;
}

function insertBeforeClosingHead(html, block) {
  const needle = '\n  </head>';

  if (html.includes(needle)) {
    return html.replace(needle, `\n${block}\n\n  </head>`);
  }

  return html.replace('</head>', `${block}\n</head>`);
}

async function renderFontFaceBlocks() {
  const blocks = await Promise.all(fontAssets.map(async (font) => {
    const sources = await Promise.all(font.sources.map(async (source) => {
      const fontBuffer = await fs.readFile(source.path);
      const dataUrl = `data:${source.mime};base64,${fontBuffer.toString('base64')}`;
      return `url(${dataUrl}) format('${source.format}')`;
    }));

    const srcDeclaration = sources.join(',\n         ');

    return `@font-face {\n  font-family: '${font.family}';\n  src: ${srcDeclaration};\n  font-weight: ${font.weight};\n  font-style: ${font.style};\n  font-display: swap;\n}`;
  }));

  return blocks;
}

function sanitizeCssContent(content, { stripFontFace } = {}) {
  let sanitized = content;

  sanitized = sanitized.replace(/@charset\s+"[^"]+";?/gi, '').trim();

  if (stripFontFace) {
    sanitized = sanitized.replace(/@font-face\s*{[^}]*}\s*/gi, '').trim();
  }

  return sanitized;
}

async function run() {
  const [template, bundle, bpmnDistro, jquery, cssContents] = await Promise.all([
    fs.readFile(templatePath, 'utf8'),
    fs.readFile(bundlePath, 'utf8'),
    fs.readFile(bpmnDistroPath, 'utf8'),
    fs.readFile(jqueryPath, 'utf8'),
    Promise.all(cssAssets.map((asset) => fs.readFile(asset.path, 'utf8')))
  ]);

  const inlineAppScript = `<script>\n${bundle}\n</script>`;
  const outputHtml = replacePlaceholder(template, inlineAppScript);

  const banner = '/*! Auto-generated bundle: includes BPMN modeler distro, jQuery and app code. */';
  const combinedSource = [
    bpmnDistro.trimEnd(),
    jquery.trimEnd(),
    bundle.trimEnd()
  ].join('\n\n');
  const { code: transpiledBundle } = await babel.transformAsync(combinedSource, {
    filename: 'bpmn_all_in_one.js',
    presets: [
      [
        '@babel/preset-env',
        {
          targets: { safari: '9' },
          modules: false,
          bugfixes: true,
          useBuiltIns: false
        }
      ]
    ],
    shouldPrintComment: (value) => value.startsWith('!'),
    configFile: false,
    babelrc: false,
    comments: false,
    compact: false,
    sourceMaps: false
  });

  const finalBundle = `${banner}\n${transpiledBundle.trimStart()}`;
  const allInOneInlineScript = `<script>\n${finalBundle}\n</script>`;
  const fontFaceBlocks = await renderFontFaceBlocks();
  const combinedCss = cssAssets
    .map((asset, index) => {
      const sanitized = sanitizeCssContent(cssContents[index], asset);
      return sanitized
        ? `/*! Inlined CSS: ${asset.href} */\n${sanitized}`
        : '';
    })
    .filter(Boolean);
  const cssWithFonts = [
    ...fontFaceBlocks.map((block, index) => `/*! Inlined Font Face ${index + 1} */\n${block}`),
    ...combinedCss
  ].join('\n\n');
  const inlineCssBlock = createInlineCssBlock(cssWithFonts);
  const templateWithoutVendorScripts = scriptTagPatterns.reduce(
    (html, pattern) => html.replace(pattern, ''),
    template
  );
  const templateWithoutVendorAssets = cssLinkPatterns.reduce(
    (html, pattern) => html.replace(pattern, ''),
    templateWithoutVendorScripts
  );
  const templateWithInlineCss = insertBeforeClosingHead(
    templateWithoutVendorAssets,
    inlineCssBlock
  );
  const outputAllInOneHtml = replacePlaceholder(
    templateWithInlineCss,
    allInOneInlineScript
  );

  await Promise.all([
    fs.writeFile(outputHtmlPath, outputHtml, 'utf8'),
    fs.writeFile(outputAllInOnePath, outputAllInOneHtml, 'utf8'),
    fs.writeFile(outputAllInOneJsPath, `${finalBundle}\n`, 'utf8')
  ]);
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
