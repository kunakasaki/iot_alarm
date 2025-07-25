// api/notify.js - Fixed version for Vercel
export default async function handler(req, res) {
  // Enable CORS if needed
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { deviceToken, callerName, handle, callId } = req.body;

  if (!deviceToken) {
    return res.status(400).json({ error: 'Missing deviceToken in request body' });
  }

  // Use provided values or defaults
  const payload = JSON.stringify({
    aps: {
      alert: `${callerName || 'Someone'} is calling...`,
    },
    id: callId || `call-${Date.now()}`,
    nameCaller: callerName || 'Unknown Caller',
    handle: handle || '0123456789',
    isVideo: false,
  });

  try {
    // Decode the certificate from base64
    const certBase64 = process.env.VOIP_CERT_PEM_BASE64;
    if (!certBase64) {
      throw new Error('VOIP_CERT_PEM_BASE64 environment variable not set');
    }

    const certBuffer = Buffer.from(certBase64, 'base64');
    const certString = certBuffer.toString('utf8');

    // Log first few characters to verify cert format (remove in production)
    console.log('Cert starts with:', certString.substring(0, 50));

    // Import https at the top level for Vercel
    const https = await import('https');

    // Create the request
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.development.push.apple.com', // Use 'api.push.apple.com' for production
        port: 443,
        path: `/3/device/${deviceToken}`,
        method: 'POST',
        headers: {
          'apns-topic': 'com.francosebben.callkitexample.voip',
          'apns-push-type': 'voip',
          'apns-priority': '10',
          'apns-expiration': '0',
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
        cert: certString,
        key: certString,
        passphrase: process.env.VOIP_CERT_PASSWORD || '9931',
        rejectUnauthorized: true,
      };

      const request = https.request(options, (response) => {
        let data = '';

        response.on('data', (chunk) => {
          data += chunk;
        });

        response.on('end', () => {
          console.log('APNS Status:', response.statusCode);
          console.log('APNS Headers:', response.headers);

          if (response.statusCode === 200) {
            res.status(200).json({
              success: true,
              apnsId: response.headers['apns-id'],
              message: 'VoIP push sent successfully',
            });
          } else {
            // Parse error response
            let errorData;
            try {
              errorData = JSON.parse(data);
            } catch (e) {
              errorData = { reason: data || 'Unknown error' };
            }

            res.status(response.statusCode).json({
              success: false,
              error: errorData.reason || 'Failed to send push',
              statusCode: response.statusCode,
              details: errorData,
            });
          }
          resolve();
        });
      });

      request.on('error', (error) => {
        console.error('Request error:', error);
        res.status(500).json({
          success: false,
          error: error.message,
          type: 'request_error',
        });
        resolve();
      });

      // Set timeout
      request.setTimeout(10000, () => {
        request.destroy();
        res.status(504).json({
          success: false,
          error: 'Request timeout',
        });
        resolve();
      });

      request.write(payload);
      request.end();
    });
  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      type: 'server_error',
    });
  }
}