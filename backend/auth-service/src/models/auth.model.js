const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Account = sequelize.define("Account", {
  email:        { type: DataTypes.STRING, allowNull: false, unique: true },
  passwordHash: { type: DataTypes.STRING, allowNull: false },
  role:         { type: DataTypes.STRING, allowNull: false, defaultValue: "user" },
  status:       { type: DataTypes.STRING, allowNull: false, defaultValue: "active" },
}, {
  tableName: "accounts",
  timestamps: true,   // createdAt / updatedAt
});

module.exports = Account;