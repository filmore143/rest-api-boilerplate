// const mssql = require("mssql"); //comment muna to since mysql gamit ko - filmore

const prodDbConfig = require("../config/devDb.js");
const testDbConfig = require("../config/prodDb.js");

const defaultDbConfig =
  process.env.NODE_ENV === "dev" || process.env.DEV
    ? testDbConfig
    : prodDbConfig;

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

const mysql = require('mysql2');  // Use mysql2 instead of mssql

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


//THIS IS FOR MYSQL
const formatQueryError = (error) => {
  // Check if the error object has properties typical for MySQL errors
  const isSqlError = error && error.code && error.sqlMessage;
  console.error("Database Error Details: ", error);
  return { error: isSqlError ? "Database Error" : error.message || error };
};



///THIS IS FOR MSSQL
// const formatQueryError = (error) => {
//   const isSqlError =
//     error instanceof mssql.ConnectionError ||
//     error instanceof mssql.TransactionError ||
//     error instanceof mssql.RequestError ||
//     error instanceof mssql.PreparedStatementError;

//   return { error: isSqlError ? "Database Error" : error };
// };

//CONNECTION FOR MYSQL SERVER
const addConn = async (name, config) => {
  if (!name) name = "default";

  try {
    // Create a connection pool (which supports promises)
    const newConn = mysql.createPool(config);

    console.log(`Connecting to ${name} db connection...`);

    // Store the pool in the __conns object
    __conns[name] = newConn;

    console.log(`Successfully connected to ${name} database.`);
    
    return newConn;  // Return the pool for later use
  } catch (error) {
    console.error(`Failed to connect to ${name} database:`, error.message);
    throw new Error(`Database connection failed: ${error.message}`);
  }
};


const query = async (command, args, conn, camelized = true) => {
  if (!args) args = [];
  if (!conn) conn = __conns.default;  // Default to the "default" connection pool

  try {
    // Use promise-based query execution from a pool
    
    const [rows, fields] = await conn.query(command, args);  // conn is a pool here, so .promise() works

    if (rows.length > 0) {
      if (camelized) {
        return rows.map((row) => changeCase(row, pascalToCamel));  // Camelize if needed
      }
      return rows;
    }

    return rows;
  } catch (error) {
    return formatQueryError(error);
  }
};







// CONNECTION FOR MSSQL SERVER
// const addConn = async (name, config) => {
//   const newConn = new mssql.ConnectionPool(config);

//   process.stdout.write(`Connecting to ${name} db connection... `);
//   await newConn.connect();
//   console.log("Connected.");

//   __conns[name] = newConn;
// };

// const getConn = (name) => {
//   return __conns[name];
// };

const where = (obj) => {
  if (empty(obj)) return "";

  if (!isObj(obj)) 
    throw "`where` MySQL helper: `obj` argument, when not empty, should be an object.";

  const ret = [];
  const whereArgs = [];

  for (const key in obj) {
    if (obj[key] == null) {
      ret.push(`${key} IS NULL`);
    } else {
      ret.push(`${key} = ?`);
      whereArgs.push(obj[key]);
    }
  }

  return {
    whereStr: `WHERE ${ret.join(" AND ")}`,
    whereArgs
  };
};


const args = (obj) => {
  if (empty(obj)) return [];

  if (!isObj(obj))
    throw "`args` MySQL helper: `obj` argument, when not empty, should be an object.";

  const ret = [];

  for (const key in obj) {
    // Ignore null or undefined values
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




const transact = async (commands, conn = __conns.default) => {
  if (!conn) conn = __conns.default;  // Default connection pool if none is provided
  
  const connection = await conn.promise().getConnection(); // Get a connection from the pool

  try {
    // Begin transaction
    await connection.beginTransaction();
    console.log('Transaction started');
    
    try {
      // Execute the commands (which should be a function returning a promise)
      const ret = await commands(connection);  // Pass the connection with transaction to the commands

      // Commit the transaction if successful
      await connection.commit();
      console.log('Transaction committed');

      return ret;
    } catch (error) {
      // Rollback the transaction in case of error
      await connection.rollback();
      console.log('Transaction rolled back');
      // return formatQueryError(error);  

      return formatQueryError("SAMPLE error"); 
    }
  } catch (error) {
    // return formatQueryError(error);  
    return formatQueryError('SAMPLE error'); 
  } finally {
    // Release the connection back to the pool
    connection.release();
  }
};

//ETO YUNG PANG MSSQL
// const transact = async (commands, conn) => {
//   if (!conn) conn = __conns.default;
//   try {
//     const txn = new mssql.Transaction(conn);
//     await txn.begin();
//     try {
//       const ret = await commands(txn);
//       await txn.commit();
//       return ret;
//     } catch (error) {
//       await txn.rollback();
//       return formatQueryError(error);
//     }
//   } catch (error) {
//     return formatQueryError(error);
//   }
// };

const select = async (columns, table, conditions, txn, options) => {
  if (empty(columns) || !table)
    throw "`columns` and `table` arguments are required.";

  if (!options) options = { camelized: true };
  const { whereStr, whereArgs } = cond(conditions);

  const command = `SELECT ${options.limitTo ? "LIMIT " + options.limitTo : ""}
    ${isArr(columns) ? columns.join(",") : columns}
    FROM ${table}
    ${empty(conditions) ? "" : whereStr}
    ${options.orderBy ? `ORDER BY ${options.orderBy}` : ""};`;

  return await query(command, whereArgs, txn, options.camelized);
};

// const select = async (columns, table, conditions, txn, options) => {
//   if (empty(columns) || !table)
//     throw "`columns` and `table` arguments are required.";

//   if (!options) options = { camelized: true };
//   const { whereStr, whereArgs } = cond(conditions);

//   const command = `SELECT ${options.limitTo ? "TOP " + options.limitTo : ""}
//     ${isArr(columns) ? columns.join(",") : columns}
//     FROM ${table}
//     ${empty(conditions) ? "" : whereStr}
//     ${options.orderBy ? `ORDER BY ${options.orderBy}` : ""};`;

//   return await query(command, whereArgs, txn, options.camelized);
// };

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

const insert = async (table, item, txn, creationDateTimeField = "completion_date", camelized = true) => {
  if (!table || !item || !txn) {
    throw new Error("`table`, `item`, and `txn` arguments are required.");
  }

  // Add the creation timestamp field
  const sqlCols = [creationDateTimeField, ...Object.keys(item)];
  const sqlValuePlaceholders = ["NOW()", ...Object.keys(item).map(() => "?")];
  const sqlValues = Object.values(item);

  const sqlCommand = `
    INSERT INTO \`${table}\` (${sqlCols.join(", ")})
    VALUES (${sqlValuePlaceholders.join(", ")});
  `;

  console.log("TEST", sqlCommand)

  return (await query(sqlCommand, sqlValues, txn, camelized))[0] ?? null;
};



// const insert = async (
//   table,
//   item,
//   txn,
//   creationDateTimeField,
//   camelized = true
// ) => {
//   if (!table || empty(item) || !txn)
//     throw "`table`, `item` and `txn` arguments are required.";

//   if (!creationDateTimeField) creationDateTimeField = "dateTimeCreated";

//   const sqlCols = [creationDateTimeField];
//   const sqlValuePlaceholders = ["GETDATE()"];
//   const sqlValues = [];

//   for (const key in item) {
//     sqlCols.push(key);
//     sqlValuePlaceholders.push("?");
//     sqlValues.push(item[key]);
//   }

//   const sqlCommand = `INSERT INTO ${table} (
//     ${sqlCols.join(",")}
//   ) OUTPUT INSERTED.* VALUES (
//     ${sqlValuePlaceholders.join(",")}
//   );`;
//   return (await query(sqlCommand, sqlValues, txn, camelized))[0] ?? null;
// };

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

  const setClauseArr = [`${updateDateTimeField} = NOW()`];
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

  await query(sqlCommand, sqlArgs, txn);
  return await selectOne("*", table, conditions, txn);
};
// const update = async (table, item, conditions, txn, updateDateTimeField) => {
//   if (!table || empty(item) || empty(conditions) || !txn)
//     throw "`table`, `item`, `conditions` and `txn` arguments are required.";

//   if (allPropsEmpty(conditions)) throw "All props of `conditions` are empty.";
//   if (!updateDateTimeField) updateDateTimeField = "dateTimeUpdated";

//   const setClauseArr = [`${updateDateTimeField} = GETDATE()`];
//   const setClauseArgs = [];

//   for (const key in item) {
//     if (item[key] !== undefined) {
//       setClauseArr.push(`${key} = ?`);
//       setClauseArgs.push(item[key]);
//     }
//   }

//   const { whereStr, whereArgs } = cond(conditions);

//   const sqlCommand = `UPDATE ${table} SET
//     ${setClauseArr.join(",")}
//     ${whereStr};`;

//   const sqlArgs = [...setClauseArgs, ...whereArgs];

//   await query(sqlCommand, sqlArgs, txn);
//   return await selectOne("*", table, conditions, txn);
// };

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

const returnSQL = () => {
  return __conns.default;
};

const returnSQLConfig = () => {
  return defaultDbConfig;
};


module.exports = {
  createRow,
  addConn,
  // getConn,
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
  returnSQL,
  returnSQLConfig
};