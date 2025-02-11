const axios = require("axios");
const cryptojs = require("crypto-js");
const btoa = require("btoa");
const atob = require("atob");

const mailjet = require("node-mailjet").connect(
  process.env.MAIL_JET_PUBLIC_KEY,
  process.env.MAIL_JET_PRIVATE_KEY
);

function getIp(remoteAddress) {
  let ip = remoteAddress.split(":");
  ip = ip[ip.length - 1];
  return ip;
}

function randomString(length) {
  const string = Math.random()
    .toString(36)
    .substring(3, 3 + length)
    .toUpperCase();

  return string;
}

function pad(value) {
  if (value < 10) {
    return "0" + value;
  } else {
    return value;
  }
}

function encrypt(string) {
  const encrypted = btoa(cryptojs.AES.encrypt(string, encryptionKey));
  return encrypted;
}

function decrypt(string) {
  const decrypted = cryptojs.AES.decrypt(atob(string), encryptionKey).toString(
    cryptojs.enc.Utf8
  );
  return decrypted;
}

const sendSMS = async (recipient, message) => {
  if (process.env.DEV) return;

  try {
    // GET ACCESS TOKEN
    const accessToken = (
      await axios({
        method: "post",
        url: "https://messagingsuite.smart.com.ph/rest/auth/login",
        headers: {
          "Content-Type": "application/json",
        },
        data: JSON.stringify({
          username: process.env.SMART_USERNAME,
          password: process.env.SMART_PASSWORD,
        }),
      })
    )?.data?.accessToken;

    if (!accessToken) throw "Unable to get SMS access token.";

    // SEND SMS
    return (
      await axios({
        method: "post",
        url: "https://messagingsuite.smart.com.ph/cgpapi/messages/sms",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        data: JSON.stringify({
          messageType: "sms",
          destination: recipient,
          text: message,
        }),
      })
    ).data;
  } catch (err) {
    // console.log(err);
    return { error: "Unable to send SMS." };
  }
};

const sendEmail = async (emailContent) => {
  if (process.env.DEV) return;

  const message = {
    From: {
      Email: "service-notification@uerm.edu.ph",
      Name: "UERM Service Notification",
    },
    To: [
      {
        Email: `${emailContent.email}`,
        Name: `${emailContent.name}`,
      },
    ],
    TemplateID: 4088864,
    TemplateLanguage: true,
    Subject: `${emailContent.subject}`,
    Variables: {
      ehrHeader: `${emailContent.header}`,
      ehrContent: `${emailContent.content}`,
    },
  };

  if (emailContent.attachments) message.Attachments = emailContent.attachments;

  try {
    const response = await mailjet.post("send", { version: "v3.1" }).request({
      Messages: [message],
    });
    return response.body;
  } catch (err) {
    console.log(err);
    return { error: "Unable to send email." };
  }
};

/*
 * Returns true if the argument is:
 *    - null
 *    - undefined
 *    - an empty string
 *    - an array with 0 length
 *    - an object with no properties
 */
const empty = function (arg) {
  if (isDate(arg)) return false;

  return (
    arg === null ||
    arg === undefined ||
    arg === "" ||
    isArrAndEmpty(arg) ||
    isObjAndEmpty(arg)
  );
};

const isArrAndEmpty = function (arg) {
  return isArr(arg) && arrEmpty(arg);
};

const isArr = function (arg) {
  return Array.isArray(arg);
};

// For performance, this method does not check if `arr` is really an array.
// Use `isArr` before calling this method, to check if `arr` is really an array.
const arrEmpty = function (arr) {
  return arr.length === 0;
};

const isObjAndEmpty = function (arg) {
  return isObj(arg) && objEmpty(arg);
};

const isObj = function (arg) {
  return typeof arg === "object" && !Array.isArray(arg) && arg !== null;
};

// For performance, this method does not check if `obj` is really an object.
// Use `isObj` before calling this method, to check if `obj` is really an object.
const objEmpty = function (obj) {
  return Object.keys(obj).length === 0;
};

const isStr = function (arg) {
  return typeof arg === "string";
};

const generateNumber = function (length) {
  return Math.random()
    .toString(10)
    .slice(2, length + 2);
};

const generateAlphaNumericStr = function (length) {
  // Base 36 is alpha-numeric
  return Math.random()
    .toString(36)
    .slice(2, length + 2)
    .toUpperCase();
};

const generateEntityCode = function (entityName) {
  return entityName.replace(/[aeiou\s\W]/gi, "").toLowerCase();
};

const snakifyStr = function (str) {
  return str.replace(/([A-Z])/g, (val) => `_${val.toLowerCase()}`);
};

const camelizeStr = function (str) {
  let ret = str.replace(/_(\w{1})/g, (val) =>
    val.replace("_", "").toUpperCase()
  );
  return ret.replace(/^[A-Z]{1}/, (val) => val.toLowerCase());
};

// Returns a copy of an object but property names are snakified
// Does not change the original object
// Object argument must be a FLAT object
const snakify = function (obj) {
  if (typeof obj !== "object" || Array.isArray(obj))
    throw "snakify: Argument should be an object.";

  let ret = {};

  if (typeof obj === "object" && !Array.isArray(obj)) {
    for (const prop in obj) {
      ret[snakifyStr(prop)] = obj[prop];
    }
  }

  return ret;
};

// Returns a copy of an object but property names are camelized
// Does not change the original object
// Object argument must be a FLAT object
const camelize = function (obj) {
  if (typeof obj !== "object" || Array.isArray(obj))
    throw "camelize: Argument should be an object.";

  let ret = {};

  if (typeof obj === "object" && !Array.isArray(obj)) {
    for (const prop in obj) {
      ret[camelizeStr(prop)] = obj[prop];
    }
  }

  return ret;
};

const buildTree = function (arr, nodeKey = "", parentNodeKey = "") {
  if (nodeKey === "" || parentNodeKey === "")
    throw "buildTree: `nodeKey` and `parentNodeKey` arguments are required.";

  const hashTable = {};
  const tree = [];

  arr.forEach((node) => (hashTable[node[nodeKey]] = { ...node, children: [] }));

  arr.forEach((node) => {
    if (node[parentNodeKey] && hashTable[node[parentNodeKey]]) {
      hashTable[node[parentNodeKey]].children.push(hashTable[node[nodeKey]]);
    } else {
      tree.push(hashTable[node[nodeKey]]);
    }
  });

  return tree;
};

const buildHashTable = (arr, key = "key") => {
  if (arr === undefined || arr === null || !Array.isArray(arr))
    throw "`arr` argument is required and should be an array.";

  const hash_table = {};
  arr.forEach((obj) => (hash_table[obj[key]] = { ...obj }));
  return hash_table;
};

const buildBreadcrumbs = (node, hash_table, parent_key = "parent_key") => {
  if (empty(node) || empty(hash_table)) throw "Incomplete arguments.";

  if (typeof node !== "object" || Array.isArray(node))
    throw "`node` argument should be an object.";
  if (typeof hash_table !== "object" || Array.isArray(hash_table))
    throw "`hash_table` argument should be an object.";

  let breadcrumbs = [];
  let parent_node = hash_table[node[parent_key]] ?? null;

  while (parent_node) {
    breadcrumbs.unshift(parent_node.name);
    // Nodes which parent does not exist in the group will be considered root nodes
    if (parent_node[parent_key] && hash_table[parent_node[parent_key]]) {
      parent_node = hash_table[parent_node[parent_key]];
      continue;
    }
    parent_node = null;
  }

  return breadcrumbs;
};

const generateClinicalNoteTree__v1 = function (e = []) {
  let n = !1;
  const o = [];
  function t(e, o) {
    for (const r of e) {
      if (r.code === o.parent_clinical_note_code)
        return (o.children = []), r.children.push(o), void (n = !0);
      t(r.children, o);
    }
  }
  if (
    (function () {
      for (const n of e) if (n.code === n.parent_clinical_note_code) return !0;
    })()
  )
    throw { error: "Self parent exists in the list." };
  if (
    (function () {
      for (const n of e) {
        if (null === n.parent_clinical_note_code) continue;
        let o = !0;
        for (const t of e)
          if (t.code !== n.code && n.parent_clinical_note_code === t.code) {
            o = !1;
            break;
          }
        if (o) return !0;
      }
      return !1;
    })()
  )
    throw { error: "Orphan exists in the list." };
  if (
    ((function () {
      for (let n = e.length - 1; n > -1; n--)
        null === e[n].parent_clinical_note_code &&
          ((e[n].children = []), o.push(e[n]), e.splice(n, 1));
    })(),
    0 === o.length)
  )
    throw { error: "There is no ancestor in the list." };
  return (
    (function () {
      for (; e.length > 0; )
        for (let r = e.length - 1; r > -1; --r)
          if ((t(o, e[r]), n)) {
            e.splice(r, 1), (n = !1);
            break;
          }
    })(),
    o
  );
};

const pascalToCamel = function (str) {
  return str[0].toLowerCase() + str.substring(1, str.length);
};

/**
 * Changes the character case of property names of a shallow/flat object.
 *
 * @param {Object} obj Object to be transformed
 */
const changeCase = function (obj, transformer) {
  if (typeof obj !== "object" || Array.isArray(obj))
    throw "Argument should be an object.";

  let ret = {};

  for (const prop in obj) {
    ret[transformer(prop)] = obj[prop];
  }

  return ret;
};

// Unicode \u180E is an invisible char to differentiate "value-label string generated by the system" to "actual string from the user"
const valueLabelDelimiter = " \u180E--\u180E ";

// Objectify string with encoded "value" and "label"
const parseValueLabel = function (str) {
  const arr = str.split(valueLabelDelimiter);

  if (empty(arr[1])) return arr[0]; // string
  else
    return {
      value: arr[0],
      label: arr[1],
    };
};

// Stringify object with value and label property
const stringifyValueLabel = function (obj) {
  return `${
    isStr(obj.value) ? obj.value.toUpperCase() : obj.value
  }${valueLabelDelimiter}${obj.label}`;
};

/*
 * @param obj (Array or Object) -- obj of which to check a property emptiness
 * @param path (String) -- obj path to a property i.e. "a.b.c"
 */
const deepPropEmpty = (obj, path) => {
  if (!isArr(obj) && !isObj(obj))
    throw "`obj` argument should be an array or an object.";

  const routes = path.split(".");

  let prop = obj[routes.shift()];

  if (empty(prop)) return true;

  for (const route of routes) {
    // console.log(`Route ${route} is empty:`, empty(prop[route]));
    if (empty(prop[route])) return true;
    prop = prop[route];
  }

  return false;
};

const getMissingProp = function (obj, propNames) {
  for (const propName of propNames) {
    if (empty(obj[propName])) return propName;
  }

  return null;
};

const formatDate = function (dateDetails = null) {
  // dateDetails.date can be a JS date or an ISO date string
  if (!dateDetails || !dateDetails.date) return "";

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const date = isDate(dateDetails.date)
    ? dateDetails.date
    : new Date(dateDetails.date);

  const year = new Intl.DateTimeFormat("en", { year: "numeric" }).format(date);
  let month = new Intl.DateTimeFormat("en", { month: "short" }).format(date);
  if (dateDetails.straightDate) {
    month = new Intl.DateTimeFormat("en", { month: "2-digit" }).format(date);
  }
  const day = new Intl.DateTimeFormat("en", { day: "2-digit" }).format(date);
  let minute = date.getMinutes();
  let hour = date.getHours();
  const ampm = hour > 11 ? "PM" : "AM";

  if (minute < 10) minute = "0" + minute;
  if (hour > 12) hour -= 12;

  const time = `${hour}:${minute}${ampm}`;
  const dayName = days[date.getDay()];

  if (dateDetails.withDayName)
    return `${dayName.toUpperCase()}, ${month.toUpperCase()} ${day}, ${year} ${time}`;
  else if (dateDetails.dateOnly)
    return `${month.toUpperCase()} ${day}, ${year}`;
  else if (dateDetails.timeOnly) return `${time}`;
  else if (dateDetails.straightDate) return `${year}-${month}-${day}`;
  return `${month.toUpperCase()} ${day}, ${year} ${time} `;
};

const isDate = function (arg) {
  return Object.prototype.toString.call(arg) === "[object Date]";
};

const isFlat = function (obj) {
  if (isPrimitive(obj)) throw "`obj` should not be a primitive.";

  for (const key in obj) {
    if (!isPrimitive(obj[key])) return false;
  }

  return true;
};

const isPrimitive = function (val) {
  return (typeof val !== "object" && typeof val !== "function") || val === null;
};

// Returns a one-liner presentable text from a primitive, FLAT array or FLAT object
const presentify = function (arg) {
  if (arg === undefined || arg === null || arg === "") return "";
  if (typeof arg === "function") throw "`arg` should not be a function";

  if (isObj(arg) || isArr(arg)) {
    if (!isFlat(arg))
      throw "`arg` when an object or an array, should be shallow or flat.";

    return presentifyObj(arg);
  }

  return arg;
};

// Renders a one-liner presentable text from a FLAT array or object
// IMPORTANT: Make sure that the arg is an object or an array before calling this function
const presentifyObj = function (arg) {
  let arr = arg;

  if (isObj(arr)) {
    arr = [];
    for (const key in arg) {
      arr.push(`${key}: ${arg[key]}`);
    }
  }

  // return `[${arr.join(", ")}]`;
  return arr.join(", ");
};

const stringifyHWBMI = (val) => {
  return `Height: ${val.height}${val.heightUnitCode}, Weight: ${val.weight}${val.weightUnitCode}, BMI: ${val.bmi}`;
};

// Renders a delimited string from a primitive, array or an object (nested or flat) using DFS
const treeToStr = (val, leafDelimiter = ", ") => {
  if (empty(val)) return "";

  const visited = [];
  const toVisit = [val];

  while (toVisit.length > 0) {
    const node = toVisit.shift();

    if (!empty(node.bmi)) {
      // for "Height, Weight and BMI" data
      visited.push(stringifyHWBMI(node));
    } else if (!empty(node.bgImageFileName) && !empty(node.strokes)) {
      // for sketch data
      visited.push(`[Sketch]`);
    } else if (!empty(node.value) && !empty(node.label)) {
      // for "value and label" data
      visited.push(
        `(${
          typeof node.value === "string" ? node.value.toUpperCase() : node.value
        }) ${node.label}`
      );
    } else if ((isObj(node) || isArr(node)) && isFlat(node)) {
      visited.push(presentifyObj(node));
    } else if (isPrimitive(node)) {
      // Omit null and undefined nodes
      if (node !== null && node !== undefined) {
        visited.push(node);
      }
    } else {
      for (const key in node) {
        toVisit.unshift(node[key]);
      }
    }
  }

  return visited.join(leafDelimiter);
};

const multiLineToOneLine = (str) => {
  return str.replace(/[\n\r]+/g, ", ");
};

const treeToMultiLinerStr = function (tree, indentSize = 2) {
  if (!isObj(tree)) throw "`tree` should be an object.";

  const indent = Array(indentSize).fill(" ").join("");
  const result = [];
  const toVisit = [
    {
      ...tree,
      indent: "",
    },
  ];

  while (toVisit.length > 0) {
    const node = toVisit.shift();

    result.push(`${node.indent}${node.label}: ${presentify(node.value)}`);

    if (!empty(node.children)) {
      toVisit.unshift(
        ...node.children.map((n) => {
          n["indent"] = node.indent + indent;
          return n;
        })
      );
    }
  }

  return result.join("\n");
};

// Limits and adds ellipsis to a string.
const addEllipsis = (str, limit) => {
  if (limit < 3) limit = 3;

  if (str.length > limit) {
    return str.substring(0, limit - 3) + "...";
  }

  return str;
};

const stringifyDiagnostic = (diagnostic, limitText = false) => {
  // For backward compatibility
  if (isStr(diagnostic)) return multiLineToOneLine(diagnostic);

  const diagStrArr = [];

  const diagDate = diagnostic.date;
  const diagName = diagnostic.label;
  const diagOthers = diagnostic.others ?? "";
  const diagRemarks = diagnostic.remarks ?? "";
  // const diagCreatedBy = diagnostic.createdBy;

  const diagValues = diagnostic.children
    .map((v) => {
      return `${v.label}: ${v.children
        .map((e) => {
          let ret = limitText ? addEllipsis(e.value, 50) : e.value;
          if (e.label === "Reference Range") {
            ret = !empty(e.value) ? ` (${e.value})` : "";
          }
          return ret;
        })
        .join("")}`;
    })
    .join(", ");

  if (!empty(diagDate)) diagStrArr.push(diagDate);
  if (!empty(diagName)) diagStrArr.push(diagName);
  if (!empty(diagValues)) diagStrArr.push(multiLineToOneLine(diagValues));
  if (!empty(diagOthers)) diagStrArr.push(multiLineToOneLine(diagOthers));
  if (!empty(diagRemarks)) diagStrArr.push(multiLineToOneLine(diagRemarks));
  // if (!empty(diagCreatedBy)) diagStrArr.push(diagCreatedBy);

  return diagStrArr.join(" | ");
};

const printifyDiagnostic = (diagnostic) => {
  // For backward compatibility
  if (isStr(diagnostic)) return diagnostic;

  const diagStrArr = [];

  const diagDate = diagnostic.date;
  const diagName = diagnostic.label;
  const diagOthers = diagnostic.others ?? "";
  const diagRemarks = diagnostic.remarks ?? "";
  // const diagCreatedBy = diagnostic.createdBy;

  const diagValues = diagnostic.children
    .map((v) => {
      return `${v.label}: ${v.children
        .map((e) => {
          let ret = e.value;
          if (e.label === "Reference Range") {
            ret = !empty(e.value) ? ` (${e.value})` : "";
          }
          return multiLineToOneLine(ret);
        })
        .join("")}`;
    })
    .join(", ");

  if (!empty(diagDate) && !empty(diagName))
    diagStrArr.push(`${diagName} (${diagDate}):`);

  if (!empty(diagValues)) diagStrArr.push(multiLineToOneLine(diagValues));
  if (!empty(diagOthers)) diagStrArr.push(multiLineToOneLine(diagOthers));
  if (!empty(diagRemarks)) diagStrArr.push(multiLineToOneLine(diagRemarks));
  // if (!empty(diagCreatedBy)) diagStrArr.push(diagCreatedBy);

  return diagStrArr.join("\n  - ");
};

const getAge = function (date) {
  const today = new Date();
  const birthDate = isDate(date) ? date : new Date(date);

  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();

  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;

  return age;
};

const getDistinct = function (arr) {
  if (!isArr(arr)) throw "Argument should be an array.";
  return [...new Set(arr)];
};

// Used to sort array of strings or objects (with string property to be used for sorting) IN PLACE
const sortStringArr = (arr, key = null, desc = false) => {
  const ret1 = desc ? -1 : 1;
  const ret2 = desc ? 1 : -1;

  arr.sort((a, b) =>
    (a[key] ?? a) > (b[key] ?? b)
      ? ret1
      : (a[key] ?? a) < (b[key] ?? b)
      ? ret2
      : 0
  );
};

// Used to sort array of numbers or objects (with number property to be used for sorting) IN PLACE
const sortNumberArr = (arr, key = null, desc = false) => {
  arr.sort((a, b) => {
    if (desc) return (b[key] ?? b) - (a[key] ?? a);
    return (a[key] ?? a) - (b[key] ?? b);
  });
};

const jsDateToISOString = function (jsDate, dateOnly = false, utc = false) {
  if (utc) {
    if (dateOnly) return jsDate.toISOString().substring(0, 10);
    else return jsDate.toISOString();
  }

  const year = String(jsDate.getFullYear());
  const month = String(jsDate.getMonth() + 1).padStart(2, "0");
  const date = String(jsDate.getDate()).padStart(2, "0");
  const hours = String(jsDate.getHours()).padStart(2, "0");
  const minutes = String(jsDate.getMinutes()).padStart(2, "0");
  const seconds = String(jsDate.getSeconds()).padStart(2, "0");
  const ms = String(jsDate.getMilliseconds()).padStart(3, "0");

  if (dateOnly) return `${year}-${month}-${date}`;

  return `${year}-${month}-${date} ${hours}:${minutes}:${seconds}.${ms}`;
};

// Used to compare two array of primitives or objects
const compareArr = function (newArr, oldArr, itemKey = null, itemValue = null) {
  if (newArr.length !== oldArr.length) return false;

  for (const newArrItem of newArr) {
    const oldArrItem = oldArr.find(
      (e) =>
        (itemKey ? e[itemKey] : e) ===
        (itemKey ? newArrItem[itemKey] : newArrItem)
    );

    if (
      !oldArrItem ||
      (itemValue ? oldArrItem[itemValue] : oldArrItem) !==
        (itemValue ? newArrItem[itemValue] : newArrItem)
    ) {
      return false;
    }
  }

  return true;
};

const isInt = (value) => {
  var x;
  if (isNaN(value)) {
    return false;
  }
  x = parseFloat(value);
  return (x | 0) === x;
};

const isDecimal = (value) => {
  return Boolean(value % 1);
};

const isNumber = (value) => {
  return isInt(value) || isDecimal(value);
};

const sanitizeSQLLikeValue = (val) => {
  return val.replace(/[\%\_\[\]\^]/g, "");
};

const currentDateTime = () => {
  var currentdate = new Date();

  var datetime = `${currentdate.getFullYear()}-${(
    "0" +
    (currentdate.getMonth() + 1)
  ).slice(-2)}-${pad(currentdate.getDate())} ${pad(
    currentdate.getHours()
  )}:${pad(currentdate.getMinutes())}:${pad(currentdate.getSeconds())}`;

  return datetime;
};

const setInitials = (name) => {
  return name.charAt(0);
};

const currentUserToken = (req) => {
  return req.user;
};

const groupBy = function (arr, key) {
  return arr.reduce(function (rv, x) {
    (rv[x[key]] = rv[x[key]] || []).push(x);
    return rv;
  }, {});
};

const onlyCapitalLetters = function (str) {
  return str.replace(/[^A-Z]+/g, "");
};

const removeHTMLTags = (strToSanitize) => {
  return strToSanitize
    .replace(/<br>/g, "\n")
    .replace(/(&[a-z]+;|&#[0-9]+;)/g, "")
    .replace(/<\/?[^>]+>/gi, "");
};

const sanitizeUserName = (username) => {
  // SYMBOLS @ AND - ARE INTENTIONALLY OMMITTED FOR EMAIL USERNAMES
  return username
    .replace(/[ ]/g, "_")
    .replace(/[`!#$%^&*()+=\[\]{};':"\\|,<>\/?~]/g, "")
    .toLowerCase();
};

const httpResponse = (status, body) => {
  return {
    status: status.code ?? status,
    body: body ?? null,
  };
};

const getTokenFromRequest = (req) => {
  const reqHeaderToken = req.headers["authorization"]
    ? req.headers["authorization"].split(" ")[1]
    : null;

  const reqQueryToken = req.query.accessToken;
  return reqHeaderToken ?? reqQueryToken;
};

// "Safely" adds prop to `obj` if `val` is not "empty". Modifies the `obj` in place.
const addProp = (val, propName, obj, format = null) => {
  if (!empty(val)) obj[propName] = format ? format(val) : val;
};

const parsePhoneNosCol = (str) => {
  const matches = str
    ? str
        .replace(/\+63/g, "0")
        .replace(/\-/g, "")
        .match(/09[0-9]{9}/g)
    : null;

  if (matches && matches.length > 0) return matches[0];

  return null;
};

const getFileExtension = (str) => {
  return str.split(".").pop();
};

const allPropsEmpty = (obj) => {
  return !Object.values(obj).some((val) => !empty(val));
};

module.exports = {
  getIp,
  randomString,
  groupBy,
  pad,
  encrypt,
  decrypt,
  sendSMS,
  empty,
  objEmpty,
  isObjAndEmpty,
  objEmpty,
  camelize,
  snakify,
  generateNumber,
  generateEntityCode,
  buildTree,
  buildHashTable,
  buildBreadcrumbs,
  sendEmail,
  generateAlphaNumericStr,
  pascalToCamel,
  changeCase,
  parseValueLabel,
  stringifyValueLabel,
  isObj,
  isArr,
  isStr,
  isInt,
  isDecimal,
  isNumber,
  isPrimitive,
  isFlat,
  isDate,
  deepPropEmpty,
  getMissingProp,
  presentify,
  presentifyObj,
  treeToStr,
  treeToMultiLinerStr,
  multiLineToOneLine,
  stringifyDiagnostic,
  printifyDiagnostic,
  getAge,
  getDistinct,
  sortStringArr,
  sortNumberArr,
  jsDateToISOString,
  formatDate,
  compareArr,
  sanitizeSQLLikeValue,
  currentUserToken,
  setInitials,
  currentDateTime,
  onlyCapitalLetters,
  removeHTMLTags,
  sanitizeUserName,
  httpResponse,
  getTokenFromRequest,
  addProp,
  parsePhoneNosCol,
  getFileExtension,
  allPropsEmpty,
};
