// TODO: Ensure that the units in Fineli data match INFOODS units!
const deepExtend = require("deep-extend");
const path = require("path");
const Promise = require("bluebird");
const R = require("ramda");
const util = require("./util");
const infoods = require("../infoods");

const csvOptions = {delimiter: ";", columns: true, relax: true, encoding: "ISO-8859-1"};

const mapNames = R.pipe(R.map(R.props(["FOODID", "FOODNAME"])), R.fromPairs);

const mapNumberPair = (keyField, numField) => R.pipe(
  R.map((datum) => [datum[keyField], parseFloat(datum[numField].replace(",", "."))]),
  R.fromPairs
);

const seen = {};

const infoodsRemap = {
  "PROT": "PROCNT",  // protein, total; we know Fineli calculates this from nitrogen
  "FIBT": "FIBTG", // fiber, total
  "VITPYRID": "PYRXN",  // pyridoxine ("VITPYRID;vitamers pyridoxine (hydrochloride);EN")
  "CAROTENS": "CARTOID",  // carotenoids, total
  "FACIDCTG": "FACID",  // fatty acids, total
  "FAMCIS": "FAMSCIS", // fatty acids, monounsaturated, total cis (still not in INFOODS though)
  "FAS18": "F18D0", // "fatty acid isomers 18:0"
  "F16D0T": "F16D0", // TODO: probably?
  "MYRIC": "MYRIC", // Myricetin
  "QUERCE": "QUERCE", // Quercetin
  "SUGOH": "POLYL", // Sugar alcohols (polyols) -- not in my data set, of course
};

const mapComponents = R.pipe(
  mapNumberPair("EUFDNAME", "BESTLOC"),
  (hash) => {
    Object.keys(hash).forEach((key) => {
      if (infoodsRemap[key]) {
        if (infoodsRemap[key] !== key) {
          hash[infoodsRemap[key]] = hash[key];
          delete hash[key];
        }
        return;
      }
      if (!infoods[key]) {
        if (!seen[key]) {
          console.log("Not in INFOODS:", key);
          seen[key] = true;
        }
      }
    });
    return hash;
  }
);
const mapFoodUnits = mapNumberPair("FOODUNIT", "MASS");


function importFromDir(dir) {
  return util.importFilesFromDir(dir, [
    "component_value", "food", "foodaddunit",
    "foodname_EN", "foodname_SV", "foodname_TX",
  ], R.partialRight(util.readCsvAsKeyedObject, [csvOptions])).then((datas) => {
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
  return util.importFilesFromDir(
    dir,
    keysWithLanguages,
    R.partialRight(util.readCsvAsKeyedObject, [csvOptions])
  ).then((datas) => {
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
