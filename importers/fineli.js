const R = require("ramda");
const path = require("path");
const util = require("./util");

function readFileToCsv(dir, key) {
  const csvOptions = {delimiter: ";", columns: true, relax: true};
  return R.pipeP(
    (filename) => util.readCsv(filename, "ISO-8859-1", csvOptions),
    (data) => R.objOf(key, data)
  )(path.join(dir, key + ".csv.gz"));
}

const mapNames = R.pipe(R.map(R.props(["FOODID", "FOODNAME"])), R.fromPairs);

const mapComponents = R.pipe(
  R.map((comp) => [comp.EUFDNAME, parseFloat(comp.BESTLOC.replace(",", "."))]),
  R.fromPairs
);

function importFromDir(dir) {
  return util.importFilesFromDir(dir, [
    "component_value", "food", "foodaddunit",
    "foodname_EN", "foodname_SV", "foodname_TX",
  ], readFileToCsv).then((datas) => {
    const foodComponents = R.groupBy(R.prop("FOODID"))(datas.component_value);
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

exports.importFromDir = importFromDir;
exports.importMetadataFromDir = importMetadataFromDir;
