const OK = { code: 200, name: "Success." };
const BAD_REQUEST = {
  code: 400,
  name: "Invalid request query, parameter or body.",
};
// FOR UNAUTHORIZED ACCESS
const UNAUTHORIZED = {
  code: 401,
  name: "You are not allowed to access this data.",
};
// FOR UNAUTHENTICATED ACCESS
const FORBIDDEN = {
  code: 403,
  name: "Token is invalid/expired or you've been logged into another device.",
};

const NOT_FOUND = { code: 404, name: "Resource not found." };
const TIMEOUT = { code: 408, name: "Request Timed out." };

const INTERNAL_SERVER_ERROR = {
  code: 500,
  name: "Oops. Error occurred in the API server.",
};

const httpResponseStatusCodes = {
  OK,
  BAD_REQUEST,
  UNAUTHORIZED,
  FORBIDDEN,
  NOT_FOUND,
  INTERNAL_SERVER_ERROR,
  [OK.code]: OK,
  [BAD_REQUEST.code]: BAD_REQUEST,
  [UNAUTHORIZED.code]: UNAUTHORIZED,
  [FORBIDDEN.code]: FORBIDDEN,
  [NOT_FOUND.code]: NOT_FOUND,
  [TIMEOUT.code]: TIMEOUT,
  [INTERNAL_SERVER_ERROR.code]: INTERNAL_SERVER_ERROR,
};

module.exports = {
  httpResponseStatusCodes,
};
