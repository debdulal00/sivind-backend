const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: "sivind-6bef6",
  });
}

module.exports = admin;

