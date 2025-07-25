// api/notify.js (for Vercel Serverless)

const https = require('https');

module.exports = async (req, res) => {
  const deviceToken = '088fd7b5ebf0d736c85e7732ddd4148c9491c26d0626413b6cebf5ed153e02ab';

  const payload = JSON.stringify({
    aps: {
      alert: 'Hien Nguyen Call',
    },
    id: '265e73d3-bece-41e1-922e-3ae4dab34ba2',
    nameCaller: 'Hien Nguyen',
    handle: '0123456789',
    isVideo: true,
  });

  try {
    const certBuffer = Buffer.from(process.env.VOIP_CERT_PEM_BASE64, 'base64');

    const options = {
      hostname: 'api.development.push.apple.com',
      port: 443,
      path: `/3/device/${deviceToken}`,
      method: 'POST',
      headers: {
        'apns-topic': 'com.francosebben.callkitexample.voip',
        'apns-push-type': 'voip',
        'apns-priority': '10',
        'Content-Type': 'application/json',
        'Content-Length': payload.length,
      },
      cert: certBuffer,
      key: certBuffer,
      passphrase: '9931', // same as used in your curl command
    };

    const apnsRequest = https.request(options, (apnsResponse) => {
      let responseData = '';
      apnsResponse.on('data', (chunk) => {
        responseData += chunk;
      });
      apnsResponse.on('end', () => {
        res.status(apnsResponse.statusCode).json({
          status: 'ok',
          response: responseData,
        });
      });
    });

    apnsRequest.on('error', (err) => {
      console.error('APNs error:', err);
      res.status(500).json({ error: err.message });
    });

    apnsRequest.write(payload);
    apnsRequest.end();
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: err.message });
  }
};