const deepExtend = require("deep-extend");
const path = require("path");
const Promise = require("bluebird");
const R = require("ramda");
const util = require("./util");

function readFileToCsv(dir, key) {
  const csvOptions = {delimiter: ";", columns: true, relax: true};
  return R.pipeP(
    (filename) => util.readCsv(filename, "ISO-8859-1", csvOptions),
    (data) => R.objOf(key, data)
  )(path.join(dir, key + ".csv.gz"));
}

const mapNames = R.pipe(R.map(R.props(["FOODID", "FOODNAME"])), R.fromPairs);

const mapNumberPair = (keyField, numField) => R.pipe(
  R.map((datum) => [datum[keyField], parseFloat(datum[numField].replace(",", "."))]),
  R.fromPairs
);

const mapComponents = mapNumberPair("EUFDNAME", "BESTLOC");
const mapFoodUnits = mapNumberPair("FOODUNIT", "MASS");

function importFromDir(dir) {
  return util.importFilesFromDir(dir, [
    "component_value", "food", "foodaddunit",
    "foodname_EN", "foodname_SV", "foodname_TX",
  ], readFileToCsv).then((datas) => {
    const groupByFoodId = R.groupBy(R.prop("FOODID"));
    const foodComponents = groupByFoodId(datas.component_value);
    const foodAddUnits = groupByFoodId(datas.foodaddunit);
    const namesEn = mapNames(datas.foodname_EN);
    const namesTx = mapNames(datas.foodname_TX);
    const namesSv = mapNames(datas.foodname_SV);
    return datas.food.map((datum) => {
      return {
        "id": "fineli:" + datum.FOODID,
        "type": datum.FOODTYPE,
        "process": datum.PROCESS,
        "ingredientClass": datum.IGCLASS,
        "ingredientParentClass": datum.IGCLASSP,
        "usageClass": datum.FUCLASS,
        "usageParentClass": datum.FUCLASSP,
        "ediblePortion": parseFloat(datum.EDPORT) / 100.0,
        "name": R.filter(R.identity, {
          "FI": datum.FOODNAME,
          "SV": namesSv[datum.FOODID],
          "EN": namesEn[datum.FOODID],
          "taxonomy": namesTx[datum.FOODID],
        }),
        "components": mapComponents(foodComponents[datum.FOODID] || []),
        "units": mapFoodUnits(foodAddUnits[datum.FOODID] || []),
      };
    });
  });
}

function importMetadataFromDir(dir) {
  const keyToName = {
    "cmpclass": "componentClass",
    "compunit": "componentUnit",
    "eufdname": "component",
    "foodtype": "foodType",
    "foodunit": "foodUnit",
    "fuclass": "usageClass",
    "igclass": "ingredientClass",
    "process": "process",
  };
  const keysWithLanguages = ["component"].concat(R.flatten(R.map(
    (key) => R.map(R.add(key), ["_EN", "_FI", "_SV"]),
    Object.keys(keyToName)
  )));
  return util.importFilesFromDir(dir, keysWithLanguages, readFileToCsv).then((datas) => {
    const metadata = R.fromPairs(R.map(([key, destName]) => {
      const langMap = {};
      Object.keys(datas).forEach((dkey) => {
        if (dkey.indexOf(key + "_") !== 0) return;
        datas[dkey].forEach((ent) => {
          const id = ent.THSCODE;
          (langMap[id] = langMap[id] || {})[ent.LANG] = ent.DESCRIPT;
        });
      });
      const outMap = R.fromPairs(R.map((pair) => [pair[0], {name: pair[1]}], R.toPairs(langMap)));
      return [destName, outMap];
    }, R.toPairs(keyToName)));
    datas.component.forEach((comp) => {
      metadata.component[comp.EUFDNAME] = R.merge(metadata.component[comp.EUFDNAME], {
        unit: comp.COMPUNIT,
        componentClass: comp.CMPCLASS,
        componentParentClass: comp.CMPCLASSP,
      });
    });
    return metadata;
  });
}

function importMerged(baseDir) {
  baseDir = baseDir || "data/fineli"; // eslint-disable-line no-param-reassign
  const DIRS = [
    path.join(baseDir, "foods"),
    path.join(baseDir, "raw"),
  ];

  return Promise.all([
    Promise.map(DIRS, importFromDir).then(
      (foodLists) => R.objOf("foods", R.pipe(
        R.unnest,
        R.map((food) => [food.id, food]),
        R.fromPairs
      )(foodLists))
    ),
    Promise.map(DIRS, importMetadataFromDir).then(
      (metadatas) => R.objOf("metadata", deepExtend.apply(null, metadatas))
    ),
  ]).then(R.mergeAll);
}

exports.importData = importFromDir;
exports.importMetadata = importMetadataFromDir;
exports.importMerged = importMerged;
