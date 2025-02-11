const db = require("../helpers/db.js");

const columns = [
  { name: "code", required: true, size: 100 },
  { name: "name", required: true, size: 255 },
  { name: "remarks", default: null, size: 255 },
];

const select = async () => {
  return await db.query(`SELECT 'HELLO WORLD!' greeting;`);
};

module.exports = {
  columns,
  select,
};
