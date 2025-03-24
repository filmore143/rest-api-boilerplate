require("dotenv").config();

const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const userAgent = require("express-useragent");
const app = express();

const db = require("./helpers/db.js");
const prodDbConfig = require("./config/prodDb.js");
const devDbConfig = require("./config/devDb.js");

(async () => {
  console.log(
    `Using ${
      process.env.DEV ? "DEVELOPMENT" : "PRODUCTION"
    } database as the default database.`
  );

  const defaultDbConfig = process.env.DEV ? devDbConfig : prodDbConfig;
  await db.addConn("default", defaultDbConfig);

  //ROUTERS
  const appRoutes = require("./routes/appRoutes");

  // MIDDLEWARES
  app.use(cors());
  app.use(express.json({ limit: "50mb" }));
  app.use(userAgent.express());
  if (process.env.DEV) app.use(morgan("dev"));

  // ROUTES
  app.use("/app", appRoutes);
  app.use("/public", express.static("public"));

  app.get("/", (req, res) => {
    res.json({ message: "Welcome to REST API BOILERPLATE" });
  });

  const port = process.env.DEV
    ? process.env.PORT_DEV
    : process.env.PORT;

  console.log(
    `App is running in ${process.env.DEV ? "DEVELOPMENT" : "PRODUCTION"} mode.`
  );

  if (process.env.DEV) {
    console.log(`Note: Saving logs is disabled in DEVELOPMENT mode.`);
  }

  app.listen(port, () => {
    console.log(`Express server is listening on port ${port}.`);
  });
})();
