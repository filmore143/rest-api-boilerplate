module.exports = {
  server: process.env.DB_HOST_DEV,
  database: process.env.DB_DB_DEV,
  user: process.env.DB_USER_DEV,
  password: process.env.DB_PASS_DEV,
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
