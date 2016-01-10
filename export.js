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
  const exporter = require("./exporters/" + opts.exporter);
  const formatters = opts.formats.map((name) => {
    const func = formatterFuncs[name];
    if (!func) {
      throw new Error("Unknown formatter " + name);
    }
    return [name, func];
  });

  exporter().then((data) => {
    Object.keys(data).forEach((key) => {
      const filenameTemplate = path.join(opts.dir, opts.exporter + "." + key);
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
    .alias('exporter', 'x')
    .alias('format', 'f')
    .array('format')
    .default('dir', 'out')
    .demand(['exporter', 'format'])
    .describe('dir', 'where to export')
    .describe('exporter', 'which exporter to use')
    .describe('format', 'which format(s) to export (json, toml)')
    .argv;
  run({
    exporter: argv.exporter,
    dir: argv.dir,
    formats: argv.format,
  });
}

if(module.parent === null) {
  cmdline();
}
