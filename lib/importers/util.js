const Promise = require("bluebird");
const R = require("ramda");
const fs = Promise.promisifyAll(require("fs"));
const zlib = Promise.promisifyAll(require("zlib"));
const iconvlite = require("iconv-lite");
const parseCsvAsync = Promise.promisify(require("csv-parse"));


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

exports.importFilesFromDir = importFilesFromDir;
exports.readPossiblyCompressedFile = readPossiblyCompressedFile;
exports.readCsv = readCsv;
