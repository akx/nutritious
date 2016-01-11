/* eslint-disable no-var,vars-on-top */
const R = require("ramda");
const util = require("./util");
const infoods = require("../infoods");
const debug = require("debug")("import:mccance");
const inspect = require("util").inspect;

const csvOptions = {
  delimiter: ",",
  encoding: "ISO-8859-1",
  extension: ".gz",
  quote: "\"",
};

const infoodsRemap = {
  "13CISRET": "RETOL13", // 13-cis-retinol (Âµg)
  "25OHD3": "25OHD3", // 25-hydroxy vitamin D3 (Âµg)
  "5METHF": "5METHF", // 5-mehtyl folate (Âµg)
  "ACAR": "CARTA", // Alpha-carotene (Âµg)
  "ALCO": "ALC", // Alcohol,
  "ALTRET": "ALTRET", // All-trans-retinol (Âµg)
  "AOACFIB": "FIBTG", // Total AOAC fibre
  "ATOPH": "TOCPHA", // Alpha-tocopherol (mg)
  "ATOTR": "TOCTRA", // Alpha-tocotrienol (mg)
  "BCAR": "CARTB", // Beta-carotene (Âµg)
  "BRASPHYTO": "BRASTR", // Brassicasterol (mg)
  "BSITPHYTO": "SITSTR", // Beta-sitosterol (mg)
  "BTOPH": "TOCPHB", // Beta-tocopherol (mg)
  "CAMPHYTO": "CAMD5", // Campesterol (mg)
  "CAREQU": "CAROT", // Carotene, total
  "CHO": "CHOCSM", // Total carbohydrate
  "CHOL": "CHOLE", // Cholesterol
  "CITA": "CITAC", // Citric acid (g)
  "CL": "CLD", // Chloride
  "CRYPT": "CRYPX", // Cryptoxanthins (Âµg)
  "D5AVEN": "AVED5", // Delta-5-avenasterol (mg)
  "D7AVEN": "AVED7", // Delta-7-avenasterol (mg)
  "D7STIG": "STID7", // Delta-7-stigmastenol (mg)
  "DEHYRET": "DEHYRET", // Dehydroretinol (Âµg)
  "DTOPH": "TOCPHD", // Delta-tocopherol (mg)
  "ENGFIB": "PSACNS", // Non-starch polysaccharides
  "FOLT": "FOL", // Folate (Âµg)
  "FRUCT": "FRUS", // Fructose
  "GALACT": "GALS", // Galactose
  "GLUC": "GLUS", // Total glucose
  "GTOPH": "TOCPHG", // Gamma-tocopherol (mg)
  "GTOTR": "TOCTRG", // Gamma-tocotrienol (mg)
  "I": "ID", // Iodine
  "KJ": "ENERC", // Total energy (kJ),
  "LACT": "LACS", // Lactose
  "LUT": "LUTN", // Lutein (Âµg)
  "LYCO": "LYCPN", // Lycopene (Âµg)
  "MALA": "MALAC", // Malic acid (g)
  "MALT": "MALS", // Maltose
  "MONOFODtr": "MONOFODtr", // trans monounsaturated /100g food (g)
  "NIAC": "NIA", // Niacin
  "NIACEQU": "NIAEQ", // Niacin equivalent (mg)
  "OLIGO": "OLSAC", // Oligosaccharides
  "PANTO": "PANTAC", // Pantothenate (mg)
  "PHYTO": "PHYTO", // Phytosterol (mg)
  "POLYFODtr": "POLYFODtr", // trans poly /100g food (g)
  "PROT": "PROCNT", // Total protein
  "RET": "RETOL", // Retinol
  "RETEQU": "RETOL", // Retinol eqv
  "RIBO": "RIBF", // Riboflavin
  "SATFOD": "FASAT", // Total saturated fatty acids
  "STAR": "STARCH", // Starch
  "STIGPHYTO": "STID7", // Stigmasterol (mg)
  "SUCR": "SUCS", // Sucrose
  "Total PHYTO": "PHYSTR",
  "TOTNIT": "NT",  // Total nitrogen
  "TOTSUG": "SUGAR", // Total sugar
  "TRYP60": "TRP", // Tryptophan/60 (mg)
  "VITB6": "VITB6C", // Vitamin B6 (mg)
  "VITD3": "CHOCAL", // Cholecalciferol (Âµg)
  "VITK1": "VITK", // Vitamin K
};

function importFromDir(dir) {
  debug("starting parse.");
  return util.importFilesFromDir(dir, [
    "mccance.csv.1",
    "mccance.csv.2",
    "mccance.csv.3",
    "mccance.csv.4",
    "mccance.csv.6",
    "mccance.csv.8",
    "mccance.csv.10",
    "mccance.csv.11",
    "mccance.csv.12",
  ], R.partialRight(util.readCsvAsKeyedObject, [csvOptions])).then((datas) => {
    const outProdMap = {};
    const complainedNonInfoods = {};
    R.toPairs(datas).forEach((pair) => {
      const name = pair[0];
      const rows = pair[1];
      const codeMap = rows[1];
      const verboseMap = rows[0];
      debug("processing", name, rows.length);
      R.slice(3, Infinity, rows).forEach((row) => {
        const foodId = row[0];
        const food = (outProdMap[foodId] || (outProdMap[foodId] = {components: {}}));
        food.name = {"EN": row[1]};
        for (var x = 7; x < row.length; x++) {
          var code = codeMap[x];
          if (code === "KCALS") continue; // No need; we get kJ
          code = infoodsRemap[code] || code;
          if (code) {
            if (code.indexOf(":") == -1 && !infoods[code] && !complainedNonInfoods[code]) {
              complainedNonInfoods[code] = 1;
              debug("Not in INFOODS: " + code + "(" + verboseMap[x] + ")");
            }
            var value = parseFloat(row[x]);
            if (!isNaN(value)) {
              food.components[code] = (food.components[code] || 0) + value;
            }
          }
        }
      });
    });
    /*
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
     */
    return R.values(outProdMap);
  });
}

exports.importData = importFromDir;
exports.importMerged = function importMerged(dir) {
  dir = dir || "data/mccance"; // eslint-disable-line no-param-reassign
  return importFromDir(dir).then(R.objOf("data"));
};
