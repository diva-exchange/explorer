"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const explorer_1 = require("./explorer");
const config_1 = require("./config");
const explorer = new explorer_1.Explorer(new config_1.Config()).listen();
process.once('SIGINT', async () => {
    await explorer.shutdown();
    process.exit(0);
});
process.once('SIGTERM', async () => {
    await explorer.shutdown();
    process.exit(0);
});
