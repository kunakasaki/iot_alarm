import apn from 'apn';
import fs from 'fs';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { deviceToken, callerName, handle, callId } = req.body;

  if (!deviceToken) {
    return res.status(400).json({ error: 'Missing deviceToken' });
  }

  try {
    const certBase64 = process.env.VOIP_CERT_PEM_BASE64;
    if (!certBase64) {
      throw new Error('VOIP_CERT_PEM_BASE64 not set');
    }

    const certBuffer = Buffer.from(certBase64, 'base64');
    const certPath = '/tmp/voip_cert.pem';
    fs.writeFileSync(certPath, certBuffer);

    // Validate certificate format
    const certContent = certBuffer.toString('utf8');
    if (!certContent.includes('-----BEGIN CERTIFICATE-----')) {
      throw new Error('Invalid certificate format: Missing -----BEGIN CERTIFICATE-----');
    }
    if (!certContent.includes('-----BEGIN PRIVATE KEY-----') && !certContent.includes('-----BEGIN RSA PRIVATE KEY-----')) {
      throw new Error('Invalid certificate format: Missing -----BEGIN PRIVATE KEY----- or -----BEGIN RSA PRIVATE KEY-----');
    }

    console.log('Cert length:', certContent.length);
    console.log('Cert starts with:', certContent.substring(0, 50));

    const provider = new apn.Provider({
      cert: certPath,
      key: certPath,
      passphrase: process.env.VOIP_CERT_PASSWORD || '9931',
      production: false,
    });

    const notification = new apn.Notification();
    notification.topic = 'com.francosebben.callkitexample.voip';
    notification.pushType = 'voip';
    notification.priority = 10;
    notification.payload = {
      aps: { alert: `${callerName || 'Someone'} is calling...` },
      id: callId || `call-${Date.now()}`,
      nameCaller: callerName || 'Unknown Caller',
      handle: handle || '0123456789',
      isVideo: false,
    };

    console.log('Sending APNs payload:', notification.payload);

    const result = await provider.send(notification, deviceToken);
    console.log('APNs result:', result);

    if (result.failed.length > 0) {
      return res.status(500).json({
        success: false,
        error: result.failed[0].response.reason,
        statusCode: result.failed[0].status,
      });
    }

    res.status(200).json({
      success: true,
      apnsId: result.sent[0]?.device,
      message: 'VoIP push sent successfully',
    });
  } catch (error) {
    console.error('Handler error:', error.message, error.stack);
    return res.status(500).json({
      success: false,
      error: error.message,
      type: 'server_error',
    });
  }
}
