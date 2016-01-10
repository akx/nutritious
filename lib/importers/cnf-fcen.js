/* eslint-disable no-var */
const R = require("ramda");
const path = require("path");
const util = require("./util");
const infoods = require("../infoods");
const debug = require("debug")("import:cnf-fcen");

function readFileToCsv(dir, key) {
  const csvOptions = {delimiter: ",", columns: true, relax: true};
  return R.pipeP(
    (filename) => util.readCsv(filename, "ISO-8859-1", csvOptions),
    (obj) => {
      debug("CSV parsed: ", key, "(" + obj.length + " entries)");
      return obj;
    },
    (data) => R.objOf(key, data)
  )(path.join(dir, key + ".csv.gz"));
}

function importFromDir(dir) {
  debug("starting parse.")
  return util.importFilesFromDir(dir, [
    "FOOD NAME", "NUTRIENT NAME", "NUTRIENT AMOUNT",
  ], readFileToCsv).then((datas) => {
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
      var compId = componentIdMap[e.NutrientID] || ("#" + e.NutrientID);
      var value = parseFloat(e.NutrientValue);
      if (compId === "ENERC_KCAL") {  // Drop the kcals
        return;
      }
      if (compId === "ENERC_KJ") {
        compId = "ENERC";
      }
      if (compId === "VITD_ µG" || compId === "VITD_µG" || compId === "#328") { // TODO: why's that 328 glitching
        compId = "VITD";
      }
      if (compId === "VITD_IU") {
        compId = "VITD";
        value /= 40.0;  // "1 mcg vitamin D = 40 IU"
      }
      if (compId == "VITA_RAE") {
        compId = "VITA";
      }
      if (compId == "LUT+ZEA") { // Lutein + zeaxanthin, map to lutein
        compId = "LUTN";
      }
      if (compId === "F18D2CLA") { // FATTY ACIDS, CONJUGATED, 18:2 cla, LINOLEIC, OCTADECADIENOIC
        compId = "F18D2CN6F"; // fatty acid cis,cis 18:2 n-6; linoleic acid; octadecadienoic acid
      }
      if (!infoods[compId]) {
        if (!complainedNonInfoods[compId]) {
          complainedNonInfoods[compId] = true;
          debug("Component not in INFOODS: " + compId + "(value = " + value + ")");
        }
      }
      cHash[compId] = value;
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
