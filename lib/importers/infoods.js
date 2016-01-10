/* eslint-disable no-var */
const R = require("ramda");
const path = require("path");
const Promise = require("bluebird");
const fs = Promise.promisifyAll(require("fs"));
const debug = require("debug")("import:infoods");

function importCodes(file) {
  return fs.readFileAsync(file, "UTF-8")
    .then((data) => data.split("\n"))
    .then(R.map(R.trim))
    .then((lines) => {
      const codes = {};
      var current = null;
      lines.forEach((line) => {
        var m;
        if ((m = /^<([^>]+)>\s*(.*)$/.exec(line))) {
          current = {code: m[1], name: null, unit: null};
          codes[current.code] = current;
          m[2] = R.trim(m[2] || "");
          if (m[2] && m[2].length) {
            current.name = m[2].split(";")[0];
          }
          return;
        }
        if (current && !current.name) {
          current.name = R.trim(line.split(";")[0]);
        }
        if (current && (m = /^\s*Unit[:]?\s*([^).]+)$/.exec(line))) {
          current.unit = R.trim(m[1]);
        }
      });
      return codes;
    });
}

module.exports.importCodes = importCodes;
