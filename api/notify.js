import apn from "apn";
import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  try {
    const { deviceToken, alert, id, nameCaller, handle, isVideo } = req.body;

    if (!deviceToken) return res.status(400).json({ error: "Missing deviceToken" });

    const certPath = path.resolve("certificates/voip_certificate.pem");

    const options = {
      cert: certPath,
      key: certPath,
      production: false, // set to true for production
    };

    const apnProvider = new apn.Provider(options);

    const notification = new apn.Notification();
    notification.alert = alert || "Incoming call";
    notification.payload = {
      id,
      nameCaller,
      handle,
      isVideo,
    };
    notification.topic = "com.your.bundleid.voip"; // <-- replace with your actual bundle ID
    notification.pushType = "voip";
    notification.priority = 10;

    const result = await apnProvider.send(notification, deviceToken);
    apnProvider.shutdown();

    return res.status(200).json(result);
  } catch (err) {
    console.error("Push Error:", err);
    return res.status(500).json({ error: "Push failed", detail: err.message });
  }
}