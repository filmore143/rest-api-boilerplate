const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { createClient } = require("redis");
const { empty, getTokenFromRequest } = require("./util");

const { OK, INTERNAL_SERVER_ERROR, FORBIDDEN } =
  require("./constants.js").httpResponseStatusCodes;

const hashPassword = async function (pw) {
  return await bcrypt.hash(pw, Number(process.env.BCRYPT_SALT_ROUNDS));
};

const passwordsMatched = async function (pw, hashedPw) {
  return await bcrypt.compare(pw, hashedPw);
};

const generateAccessToken = function (user) {
  return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_EXP,
  });
};

const validatePwResetToken = async function (req, res, next) {
  const token = req.query.accessToken ?? null;

  if (token === null)
    return res.status(403).send({ error: "Access token is required." });

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, async (err, user) => {
    if (err)
      return res.status(403).send({
        error:
          "Password reset link has expired. Password reset links are only valid for 10 minutes.",
      });
    req.user = user;
    next();
  });
};

const generatePasswordResetToken = function (user) {
  return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "10m",
  });
};

const checkJWT = (token, ignoreExpiration = false) => {
  if (token == null) {
    return {
      status: FORBIDDEN.code,
      body: "Access token is required.",
    };
  }

  try {
    // console.log("Checking if token is valid...");
    const user = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, {
      ignoreExpiration,
    });

    // console.log("Token is valid.");
    return {
      status: OK.code,
      body: user,
    };
  } catch (error) {
    // console.log(error);
    return {
      status: FORBIDDEN.code,
      body: "Access token is invalid or expired.",
    };
  }
};

const checkWhitelist = async (user, token) => {
  const userCode = (user.appCode ?? "") + (user.code ?? user.employeeId);

  if (userCode.toUpperCase().startsWith("CLIENT_")) {
    return { status: OK.code, body: null };
  }

  const redisClient = createClient();

  try {
    // console.log("Checking if token is whitelisted...");
    await redisClient.connect();
    const activeUserToken = await redisClient.get(userCode);

    if (activeUserToken !== token) {
      // console.log("Token is not whitelisted.");
      return {
        status: FORBIDDEN.code,
        body: "Access token is not whitelisted.",
      };
    }

    // console.log("Token is whitelisted.");
    return { status: OK.code, body: null };
  } catch (error) {
    // console.log(error);
    return {
      status: INTERNAL_SERVER_ERROR.code,
      body: "Unable to check if token is whitelisted.",
    };
  }
};

const validateAccessToken = async (req, res, next) => {
  const token = getTokenFromRequest(req);
  const resJWT = checkJWT(token, true); // Ignore expiration on JWT check prevent user from sudden/unexpected log out

  if (resJWT.status !== OK.code)
    return res.status(resJWT.status).json(resJWT.body);

  const user = resJWT.body;
  const resWhiteList = await checkWhitelist(user, token);

  if (resWhiteList.status !== OK.code)
    return res.status(resWhiteList.status).json(resWhiteList.body);

  req.user = user;
  next();
};

module.exports = {
  hashPassword,
  passwordsMatched,
  hashMatched: passwordsMatched, // alias
  generateAccessToken,
  validateAccessToken,
  generatePasswordResetToken,
  validatePwResetToken,
  checkJWT,
  checkWhitelist,
};
