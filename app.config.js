// Dynamic app config — resolves google-services.json from EAS env var at build time.
// Locally, falls back to the committed file path.
const fs = require("fs");
const path = require("path");

module.exports = ({ config }) => {
  const googleServicesJson =
    process.env.GOOGLE_SERVICES_JSON || "./google-services.json";

  // iOS plist is optional — only include if the file exists or env var is set
  const plistPath =
    process.env.GOOGLE_SERVICES_PLIST ||
    (fs.existsSync(path.join(__dirname, "GoogleService-Info.plist"))
      ? "./GoogleService-Info.plist"
      : null);

  const result = {
    ...config,
    android: {
      ...config.android,
      googleServicesFile: googleServicesJson,
    },
  };

  if (plistPath) {
    result.ios = {
      ...config.ios,
      googleServicesFile: plistPath,
    };
  } else if (config.ios) {
    // Strip the googleServicesFile reference if the file doesn't exist
    const { googleServicesFile, ...iosWithoutPlist } = config.ios;
    result.ios = iosWithoutPlist;
  }

  return result;
};
