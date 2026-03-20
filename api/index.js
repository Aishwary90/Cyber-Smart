const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "../backend/.env") });

const app = require("../backend/app");

module.exports = app;
