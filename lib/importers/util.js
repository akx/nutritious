const Promise = require("bluebird");
const R = require("ramda");
const fs = Promise.promisifyAll(require("fs"));
const zlib = Promise.promisifyAll(require("zlib"));
const iconvlite = require("iconv-lite");
const parseCsvAsync = Promise.promisify(require("csv-parse"));
const debug = require("debug")("import:util");
const path = require("path");

function importFilesFromDir(dir, keys, reader) {
  return Promise.map(keys, (key) => reader(dir, key)).then(R.mergeAll);
}

function readPossiblyCompressedFile(filename, encoding) {
  return R.pipeP(
    (fn) => fs.readFileAsync(fn),
    (buf) => (/\.gz$/.test(filename) ? zlib.gunzipAsync(buf) : buf),
    (buf) => iconvlite.decode(buf, encoding)
  )(filename);
}

function readCsv(filename, encoding, csvOptions) {
  return R.pipeP(
    (fn) => readPossiblyCompressedFile(fn, encoding),
    (data) => parseCsvAsync(data, csvOptions)
  )(filename);
}

function readCsvAsKeyedObject(dir, key, options) {
  const encoding = options.encoding || "ISO-8859-1";
  const extension = options.extension || ".csv.gz";
  const csvOptions = R.mergeAll([{}, options, {encoding: null, extension: null}]);
  return R.pipeP(
    (filename) => readCsv(filename, encoding, csvOptions),
    (obj) => {
      debug("CSV parsed: ", key, "(" + obj.length + " entries)");
      return obj;
    },
    (data) => R.objOf(key, data)
  )(path.join(dir, key + extension));
}

exports.importFilesFromDir = importFilesFromDir;
exports.readPossiblyCompressedFile = readPossiblyCompressedFile;
exports.readCsv = readCsv;
exports.readCsvAsKeyedObject = readCsvAsKeyedObject;
