const fineliImport = require("../importers/fineli");
const Promise = require("bluebird");
const R = require("ramda");
const deepExtend = require("deep-extend");

const DIRS = [
  "data/fineli/foods",
  "data/fineli/raw",
];

module.exports = function exportFineli() {
  return Promise.all([
    Promise.map(DIRS, fineliImport.importFromDir).then(
      (foodLists) => R.objOf("foods", R.pipe(
        R.unnest,
        R.map((food) => [food.id, food]),
        R.fromPairs
      )(foodLists))
    ),
    Promise.map(DIRS, fineliImport.importMetadataFromDir).then(
      (metadatas) => R.objOf("metadata", deepExtend.apply(null, metadatas))
    ),
  ]).then(R.mergeAll);
};
