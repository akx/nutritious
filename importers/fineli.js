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

exports.importFromDir = importFromDir;
