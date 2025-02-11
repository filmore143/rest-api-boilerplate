const mssql = require("mssql");

const {
  empty,
  isStr,
  isArr,
  isObj,
  objEmpty,
  changeCase,
  pascalToCamel,
  generateNumber,
  allPropsEmpty,
} = require("./util.js");

const __conns = {};

// Validates and supplies default values to an object
// column format:
// {
//   identity: true,
//   required: true,
//   default: null,
//   absoluteValue: "X"
// }
const createRow = (item, columns) => {
  for (const column of columns) {
    // false, "", 0 are valid values, only check for null or undefined
    if (item[column.name] == null) item[column.name] = column.default;

    if (column.absoluteValue !== undefined)
      item[column.name] = column.absoluteValue;

    // null and undefined are not allowed if required = true
    if (column.required && item[column.name] == null) {
      throw `${column.name} in item is required.`;
    }
  }
};

const formatQueryError = (error) => {
  const isSqlError =
    error instanceof mssql.ConnectionError ||
    error instanceof mssql.TransactionError ||
    error instanceof mssql.RequestError ||
    error instanceof mssql.PreparedStatementError;

  return { error: isSqlError ? "Database Error" : error };
};

const addConn = async (name, config) => {
  const newConn = new mssql.ConnectionPool(config);

  process.stdout.write(`Connecting to ${name} db connection... `);
  await newConn.connect();
  console.log("Connected.");

  __conns[name] = newConn;
};

const getConn = (name) => {
  return __conns[name];
};

// Used to generate SQL Where Clause using an object containing
// all the conditions for the query.
// IMPORTANT: Always use this in tandem with `args` helper.
const where = (obj) => {
  if (empty(obj)) return "";

  if (!isObj(obj))
    throw "`where` mssql helper: `obj` argument, when not empty, should be an object.";

  const ret = [];

  for (const key in obj) {
    ret.push(obj[key] == null ? `${key} IS NULL` : `${key} = ?`);
  }

  return `WHERE ${ret.join(" AND ")}`;
};

const args = (obj) => {
  if (empty(obj)) return [];

  if (!isObj(obj))
    throw "`args` mssql helper: `obj` argument, when not empty, should be an object.";

  const ret = [];

  for (const key in obj) {
    if (obj[key] == null) continue;
    ret.push(obj[key]);
  }

  return ret;
};

// Optimized/combined `where` and `args`
const cond = (obj, colPrefix = "") => {
  if (empty(obj)) {
    return {
      whereStr: "",
      whereArgs: [],
    };
  }

  if (!isStr(colPrefix)) throw "`colPrefix` should be a string.";
  if (!isObj(obj)) throw "`obj` should be an object.";

  const prefix = colPrefix ? colPrefix + "." : "";
  const whereStrArr = [];
  const whereArgs = [];

  for (const key in obj) {
    const colName = `${prefix}${key}`;

    if (obj[key] == null) {
      whereStrArr.push(`${colName} IS NULL`);
      continue;
    }

    whereStrArr.push(`${colName} = ?`);
    whereArgs.push(obj[key]);
  }

  return {
    whereStr: `WHERE ${whereStrArr.join(" AND ")}`,
    whereArgs,
  };
};

const query = async (command, args, conn, camelized = true) => {
  // NOTE: `conn` can be a mssql.ConnectionPool or a mssql.Transaction

  // console.log("sql query helper, command: ", command);
  // console.log("sql query helper, args: ", args);

  if (!args) args = [];
  if (!conn) conn = __conns.default;

  try {
    const result = await conn.request().query(command.split("?"), ...args);

    if (result.recordset) {
      if (camelized)
        return result.recordset.map((row) => changeCase(row, pascalToCamel));

      return result.recordset;
    }

    return result;
  } catch (error) {
    // console.log("`query` helper: ", error);
    // Let `transact` handle the error if this is ran inside `transact`
    if (conn instanceof mssql.Transaction) throw error;
    return formatQueryError(error);
  }
};

const transact = async (commands, conn) => {
  if (!conn) conn = __conns.default;

  try {
    const txn = new mssql.Transaction(conn);

    // IMPORTANT: begin transaction here as rolling back a transaction that
    // has not been started throws an error
    // console.log("Starting transaction...");
    await txn.begin();

    try {
      // IMPORTANT: Throw an error inside the `commands` arg to force a "rollback"
      const ret = await commands(txn);
      // console.log("Committing transaction...");
      await txn.commit();

      return ret;
    } catch (error) {
      // console.log("`transact` helper: ", error);
      // console.log("Error occured in a transaction. Rolling back...");
      await txn.rollback();
      // console.log("Rolled back.");
      return formatQueryError(error);
    }
  } catch (error) {
    // if (process.env.DEV) console.log("`transact` helper: ", error);
    return formatQueryError(error);
  }
};

const select = async (columns, table, conditions, txn, options) => {
  if (empty(columns) || !table)
    throw "`columns` and `table` arguments are required.";

  if (!options) options = { camelized: true };
  const { whereStr, whereArgs } = cond(conditions);

  const command = `SELECT ${options.limitTo ? "TOP " + options.limitTo : ""}
    ${isArr(columns) ? columns.join(",") : columns}
    FROM ${table}
    ${empty(conditions) ? "" : whereStr}
    ${options.orderBy ? `ORDER BY ${options.orderBy}` : ""};`;

  // console.log(command);
  // console.log(whereArgs);

  return await query(command, whereArgs, txn, options.camelized);
};

const selectOne = async (columns, table, conditions, txn, options) => {
  if (empty(columns) || !table || empty(conditions))
    throw "`columns`, `table` and `conditions` arguments are required.";

  if (!options) options = { camelized: true };
  const { whereStr, whereArgs } = cond(conditions);

  const command = `SELECT TOP 1
    ${isArr(columns) ? columns.join(",") : columns}
    FROM ${table}
    ${whereStr}
    ${options.orderBy ? `ORDER BY ${options.orderBy}` : ""};`;

  return (await query(command, whereArgs, txn, options.camelized))[0] ?? null;
};

const insert = async (
  table,
  item,
  txn,
  creationDateTimeField,
  camelized = true
) => {
  if (!table || empty(item) || !txn)
    throw "`table`, `item` and `txn` arguments are required.";

  if (!creationDateTimeField) creationDateTimeField = "dateTimeCreated";

  const sqlCols = [creationDateTimeField];
  const sqlValuePlaceholders = ["GETDATE()"];
  const sqlValues = [];

  for (const key in item) {
    sqlCols.push(key);
    sqlValuePlaceholders.push("?");
    sqlValues.push(item[key]);
  }

  const sqlCommand = `INSERT INTO ${table} (
    ${sqlCols.join(",")}
  ) OUTPUT INSERTED.* VALUES (
    ${sqlValuePlaceholders.join(",")}
  );`;

  // console.log("db helper insert, command: ", sqlCommand);
  // console.log("db helper insert, args: ", sqlValues);

  return (await query(sqlCommand, sqlValues, txn, camelized))[0] ?? null;
};

const insertMany = async (table, items, txn) => {
  if (!table || empty(items) || !txn)
    throw "`table`, `items` and `txn` arguments are required.";

  const ret = [];

  for (const item of items) {
    ret.push(await insert(table, item, txn));
  }

  return ret;
};

const update = async (table, item, conditions, txn, updateDateTimeField) => {
  if (!table || empty(item) || empty(conditions) || !txn)
    throw "`table`, `item`, `conditions` and `txn` arguments are required.";

  if (allPropsEmpty(conditions)) throw "All props of `conditions` are empty.";
  if (!updateDateTimeField) updateDateTimeField = "dateTimeUpdated";

  const setClauseArr = [`${updateDateTimeField} = GETDATE()`];
  const setClauseArgs = [];

  for (const key in item) {
    if (item[key] !== undefined) {
      setClauseArr.push(`${key} = ?`);
      setClauseArgs.push(item[key]);
    }
  }

  const { whereStr, whereArgs } = cond(conditions);

  const sqlCommand = `UPDATE ${table} SET
    ${setClauseArr.join(",")}
    ${whereStr};`;

  const sqlArgs = [...setClauseArgs, ...whereArgs];

  // console.log(sqlCommand);
  // console.log(sqlArgs);

  await query(sqlCommand, sqlArgs, txn);
  return await selectOne("*", table, conditions, txn);
};

const upsert = async (
  table,
  item,
  identityColumnsMap,
  createdOrUpdatedBy,
  txn,
  createdByField,
  creationDateTimeField,
  updatedByField,
  updateDateTimeField
) => {
  if (
    !table ||
    objEmpty(item) ||
    objEmpty(identityColumnsMap) ||
    !createdOrUpdatedBy ||
    !txn
  )
    throw "`table`, `item`, `identityColumnsMap`, `createdOrUpdatedBy` and `txn` arguments are required.";

  if (!createdByField) createdByField = "createdBy";
  if (!creationDateTimeField) creationDateTimeField = "dateTimeCreated";
  if (!updatedByField) updatedByField = "updatedBy";
  if (!updateDateTimeField) updateDateTimeField = "dateTimeUpdated";

  if (Object.keys(identityColumnsMap).length < 2)
    throw "`identityColumnsMap` should have two or more items.";

  const existingItem = await selectOne("*", table, identityColumnsMap, txn);

  if (existingItem) {
    let noChanges = true;

    for (const key in item) {
      if (item[key] !== existingItem[key]) {
        noChanges = false;
        break;
      }
    }

    if (noChanges) {
      // console.log("No Changes to the item. Returning the existing one...");
      return existingItem;
    }

    // console.log("upsert: Updating existing item...");
    return await update(
      table,
      { ...item, [updatedByField]: createdOrUpdatedBy },
      identityColumnsMap,
      txn,
      updateDateTimeField
    );
  }

  // console.log("upsert: Inserting new item...");
  return await insert(
    table,
    { ...item, ...identityColumnsMap, [createdByField]: createdOrUpdatedBy },
    txn,
    creationDateTimeField
  );
};

const del = async (table, conditions, txn) => {
  if (!table || empty(conditions) || !txn)
    throw "`table`, `conditions` and `txn` arguments are required.";

  const ret = await selectOne("*", table, conditions, txn);
  const { whereStr, whereArgs } = cond(conditions);

  await query(`DELETE FROM ${table} ${whereStr};`, whereArgs, txn);

  return ret;
};

const generateRowCode = async (table, column, prefix, seriesLength, txn) => {
  if (!txn) throw "generateRowCode: `txn` arg is required.";

  if (!seriesLength) seriesLength = 5;
  let code = "";
  let codeExists = true;

  // const dateTimeStr = (
  //   await query(`SELECT FORMAT(GETDATE(), 'yyyyMMddhhmmssfff') dateTimeStr;`)
  // )[0].dateTimeStr;

  const dateTimeStr = (
    await query(`SELECT FORMAT(GETDATE(), 'yyyyMMddhhmmss') dateTimeStr;`)
  )[0].dateTimeStr;

  while (codeExists) {
    code = `${prefix}${dateTimeStr}${generateNumber(seriesLength)}`;
    codeExists = await selectOne("*", table, { [column]: code }, txn);
  }

  return code;
};

const getDate = async (txn) => {
  return (await query(`SELECT GETDATE() AS now;`, [], txn, false))[0].now;
};

module.exports = {
  createRow,
  addConn,
  getConn,
  where,
  args,
  cond,
  query,
  transact,
  select,
  selectOne,
  insert,
  insertMany,
  update,
  upsert,
  del,
  generateRowCode,
  getDate,
};
