const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const withPortalMPC = (config) => {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const sourceAAR = path.resolve(
        projectRoot,
        "node_modules/@portal-hq/core/android/libs/mpc.aar"
      );
      const targetDir = path.resolve(projectRoot, "android/app/libs");

      // Create libs directory if it doesn't exist
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir);
      }

      // Copy the AAR file over to the android app/libs directory
      fs.copyFileSync(sourceAAR, path.resolve(targetDir, "mpc.aar"));

      return config;
    },
  ]);
};

module.exports = withPortalMPC;
