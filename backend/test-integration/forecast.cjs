// Requires the local ML service. Synthetic menu/sales/account fixtures are removed afterward.
process.env.RUN_ML_INTEGRATION = "1";
require("../test/forecast.test.cjs");
