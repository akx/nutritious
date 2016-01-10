/* eslint-disable no-console */
const Promise = require("bluebird");
const tomlify = require('tomlify-j0.4');
const fs = Promise.promisifyAll(require("fs"));
const path = require('path');

const formatterFuncs = {
  "json": (fn, data) => fs.writeFileAsync(fn + ".json", JSON.stringify(data, null, 2), "UTF-8"),
  "toml": (fn, data) => fs.writeFileAsync(fn + ".toml", tomlify(data, null, 2), "UTF-8"),
};


function run(opts) {
  const importer = require("../lib/importers/" + opts.importer).importMerged;
  const formatters = opts.formats.map((name) => {
    const func = formatterFuncs[name];
    if (!func) {
      throw new Error("Unknown formatter " + name);
    }
    return [name, func];
  });

  importer().then((data) => {
    Object.keys(data).forEach((key) => {
      const filenameTemplate = path.join(opts.dir, opts.importer + "." + key);
      formatters.forEach(([name, formatter]) => {
        formatter(filenameTemplate, data[key]).then(() => {
          console.log(filenameTemplate + ": Wrote " + name);
        });
      });
    });
  });
}

function cmdline() {
  const argv = require('yargs')
    .alias('dir', 'd')
    .alias('importer', 'i')
    .alias('format', 'f')
    .array('format')
    .default('dir', 'out')
    .demand(['importer', 'format'])
    .describe('dir', 'where to export')
    .describe('importer', 'which importer to use')
    .describe('format', 'which format(s) to export (json, toml)')
    .argv;
  run({
    importer: argv.importer,
    dir: argv.dir,
    formats: argv.format,
  });
}

if(module.parent === null) {
  cmdline();
}
