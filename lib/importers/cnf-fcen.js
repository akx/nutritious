/* eslint-disable no-var */
const R = require("ramda");
const util = require("./util");
const infoods = require("../infoods");
const debug = require("debug")("import:cnf-fcen");

const csvOptions = {delimiter: ",", columns: true, relax: true, encoding: "ISO-8859-1"};

function importFromDir(dir) {
  debug("starting parse.");
  return util.importFilesFromDir(dir, [
    "FOOD NAME", "NUTRIENT NAME", "NUTRIENT AMOUNT",
  ], R.partialRight(util.readCsvAsKeyedObject, [csvOptions])).then((datas) => {
    debug("creating id map...");
    const componentIdMap = R.pipe(
      R.map((d) => [d.NutrientID, (d.Tagname || d.NutrientSymbol).replace(/\s+/g, '')]),
      R.fromPairs
    )(datas["NUTRIENT NAME"]);
    debug("grouping components...");
    const foodComponents = {};
    const complainedNonInfoods = {};
    R.map((e) => {
      const cHash = (foodComponents[e.FoodID] = foodComponents[e.FoodID] || {});
      var code = componentIdMap[e.NutrientID] || ("#" + e.NutrientID);
      var value = parseFloat(e.NutrientValue);
      if (code === "ENERC_KCAL") {  // Drop the kcals
        return;
      }
      if (code === "ENERC_KJ") {
        code = "ENERC";
      }
      if (code === "VITD_ µG" || code === "VITD_µG" || code === "#328") {
        code = "VITD";
      }
      if (code === "VITD_IU") {
        code = "VITD";
        value /= 40.0;  // "1 mcg vitamin D = 40 IU"
      }
      if (code === "VITA_RAE") {
        code = "VITA";
      }
      if (code === "LUT+ZEA") { // Lutein + zeaxanthin, map to lutein
        code = "LUTN";
      }
      if (code === "F18D2CLA") { // FATTY ACIDS, CONJUGATED, 18:2 cla, LINOLEIC, OCTADECADIENOIC
        code = "F18D2CN6F"; // fatty acid cis,cis 18:2 n-6; linoleic acid; octadecadienoic acid
      }
      if (!infoods[code]) {
        if (!complainedNonInfoods[code]) {
          complainedNonInfoods[code] = true;
          debug("Component not in INFOODS: " + code + "(value = " + value + ")");
        }
      }
      cHash[code] = (cHash[code] || 0) + value;
    }, datas["NUTRIENT AMOUNT"]);
    debug("creating map");

    return datas["FOOD NAME"].map((datum) => {
      return {
        "id": "cnf:" + datum.FoodID,
        "name": R.filter(R.identity, {
          "EN": datum.FoodDescription,
          "FR": datum.FoodDescriptionF,
          "taxonomy": datum.ScientificName,
        }),
        "components": foodComponents[datum.FoodID] || {},
      };
    });
  });
}

exports.importData = importFromDir;
exports.importMerged = function importMerged(dir) {
  dir = dir || "data/cnf-fcen"; // eslint-disable-line no-param-reassign
  return importFromDir(dir).then(R.objOf("data"));
};
