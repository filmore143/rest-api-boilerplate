module.exports = {
  server: process.env.DB_HOST,
  database: process.env.DB_DB,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  options: {
    enableArithAbort: true,
    encrypt: false,
    appName: "rest-api-boilerplate",
    useUTC: false,
  },
  dialectOptions: {
    appName: "rest-api-boilerplate",
  },
  connectionTimeout: 30000,
  requestTimeout: 30000,
  pool: {
    idleTimeoutMillis: 30000,
    max: 100,
  },
};
