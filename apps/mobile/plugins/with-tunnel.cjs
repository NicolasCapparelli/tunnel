const {
  withAndroidManifest,
  withDangerousMod,
} = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");
module.exports = (config) => {
  config = withAndroidManifest(config, (c) => {
    const activity = c.modResults.manifest.application[0].activity.find(
      (a) => a.$["android:name"] === ".MainActivity",
    );
    activity["intent-filter"] = (activity["intent-filter"] || []).filter(
      (f) =>
        !f.action?.some((a) =>
          [
            "android.intent.action.SEND",
            "android.intent.action.SEND_MULTIPLE",
          ].includes(a.$["android:name"]),
        ),
    );
    activity["meta-data"] = (activity["meta-data"] || []).filter(
      (m) => m.$["android:name"] !== "android.app.shortcuts",
    );
    activity["meta-data"].push({
      $: {
        "android:name": "android.app.shortcuts",
        "android:resource": "@xml/tunnel_share_targets",
      },
    });
    return c;
  });
  return withDangerousMod(config, [
    "android",
    (c) => {
      const dir = path.join(
        c.modRequest.platformProjectRoot,
        "app/src/main/res/xml",
      );
      fs.mkdirSync(dir, { recursive: true });
      const name = "app.tunnel.link.ShareActivity";
      fs.writeFileSync(
        path.join(dir, "tunnel_share_targets.xml"),
        `<shortcuts xmlns:android="http://schemas.android.com/apk/res/android"><share-target android:targetClass="${name}"><data android:mimeType="*/*"/><category android:name="app.tunnel.TEXT_SHARE"/></share-target></shortcuts>`,
      );
      return c;
    },
  ]);
};
