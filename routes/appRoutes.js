const { Router } = require("express");
const appController = require("../controllers/appController.js");
const { validateAccessToken } = require("../helpers/crypto.js");

const router = Router();

// GET REQUESTS
router.get("/", appController.select);

// POST REQUESTS
// router.post("/add", validateAccessToken, appController.addUser);

// PUT REQUESTS
// router.put("/reset-pw", validatePwResetToken, appController.resetPassword);

// IMPORTANT: ROUTE WITH ARBITRARY params SHOULD BE PLACED LAST TO AVOID CONFLICTS WITH OTHER ADJACENT ROUTES
// router.put("/:code", validateAccessToken, appController.updateUser);

// DELETE REQUESTS //

router.get("*", (req, res) => {
  res.status(400).send({ error: "API not found" });
});

module.exports = router;
