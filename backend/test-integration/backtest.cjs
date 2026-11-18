// Runs the saved-snapshot workflow against MySQL and the local Python service.
process.env.RUN_BACKTEST_ML = "1";
require("../test/backtest.test.cjs");
