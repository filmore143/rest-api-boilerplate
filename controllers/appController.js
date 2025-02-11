const appModel = require("../models/appModel.js");
const { INTERNAL_SERVER_ERROR } =
  require("../helpers/constants.js").httpResponseStatusCodes;

const select = async (req, res) => {
  const result = await appModel.select();

  if (result.error) {
    return res.status(INTERNAL_SERVER_ERROR.code).json(null);
  }

  res.json({ greeting: result[0].greeting });
};

module.exports = {
  select,
};
