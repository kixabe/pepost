const { dirname, extname } = require('path');
const { copySync, removeSync } = require('fs-extra');
const { readFileSync, writeFileSync } = require('fs');

process.chdir(dirname(__dirname));
const config = require('../.buildrc');

const exts = ['js', 'css', 'html'];
// TODO: Add hash to enable long caching
async function transform(ext, src, out) {
  let data = readFileSync(src, 'utf8');
  let cfg = config[ext] || {};
  try {
    if (ext == 'js') {
      data = require('buble').transform(data, cfg).code;
      data = require('uglify-js').minify(data).code;
    }
    if (ext == 'css') {
      data = (await require('clean-css').process(data, cfg)).css;
    }
    if (ext == 'html') {
      data = require('html-minifier').minify(data, cfg);
    }
    writeFileSync(out, data, 'utf8');
  } catch (err) {
    console.error(`ERROR transforming '${src}.`, err);
  }
}

removeSync('public');
copySync('src', 'public', {
  filter(src, out) {
    const ext = extname(src).substr(1);
    if (exts.includes(ext)) {
      transform(ext, src, out);
      return false;
    }
    return true;
  },
});
