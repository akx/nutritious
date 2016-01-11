/* eslint-disable no-var */
const R = require("ramda");
const util = require("./util");
const infoods = require("../infoods");
const debug = require("debug")("import:fndds");
const inspect = require("util").inspect;

const csvOptions = {
  delimiter: "^",
  encoding: "ISO-8859-1",
  extension: ".txt.gz",
  quote: "~",
  relax: true,
};

function importFromDir(dir) {
  debug("starting parse.");
  return util.importFilesFromDir(dir, [
    "FNDDSNutVal", "FNDDSSRLinks", "NutDesc", "FoodPortionDesc",
  ], R.partialRight(util.readCsvAsKeyedObject, [csvOptions])).then((datas) => {
    debug("creating id map...");
    const nutCodeToInfoods = R.fromPairs(R.map((d) => [d[0], R.trim(d[2])], datas.NutDesc));
    debug("grouping components...");
    const foodComponents = {};
    const complainedNonInfoods = {};
    R.map((e) => {
      const cHash = (foodComponents[e[0]] = foodComponents[e[0]] || {});
      var code = nutCodeToInfoods[e[1]] || ("#" + e[1]);
      var value = parseFloat(e[4]);
      if (code === "#573") { // Added vitamin E, map to normal vitamin E
        code = "TOCPHA";
      }
      if (code === "#578") { // Added vitamin B-12, map to normal vitamin E
        code = "VITB12";
      }
      if (code === "LUT+ZEA") { // Lutein + zeaxanthin, map to lutein
        code = "LUTN";
      }
      if (code === "ENERC_KCAL") {  // Drop the kcals
        return;
      }
      if (code === "VITA_RAE") {
        code = "VITA";
      }
      if (!infoods[code]) {
        if (!complainedNonInfoods[code]) {
          complainedNonInfoods[code] = true;
          debug("Component not in INFOODS: <" + code + ">; e=" + inspect(e));
        }
      }
      cHash[code] = (cHash[code] || 0) + value;
    }, datas.FNDDSNutVal);
    debug("creating map");

    const outProds = datas.FNDDSSRLinks.map((datum) => {
      return {
        "id": "fndds:" + datum[0],
        "name": R.filter(R.identity, {
          "EN": datum[5],
        }),
        "components": foodComponents[datum[0]] || {},
      };
    });
    debug("complete!");
    return outProds;
  });
}

exports.importData = importFromDir;
exports.importMerged = function importMerged(dir) {
  dir = dir || "data/fndds"; // eslint-disable-line no-param-reassign
  return importFromDir(dir).then(R.objOf("data"));
};
