const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/auth.controller");
const auth = require("../middlewares/auth.middleware");

router.post("/register", ctrl.register);
router.post("/login", ctrl.login);
router.get("/me", auth, ctrl.me);

module.exports = router;