const jwt = require('jsonwebtoken');
const http = require('http');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

(async () => {
  try {
    const secret = process.env.JWT_SECRET || 'ReplaceWithASecureRandomSecret';
    const payload = { id: 4, username: 'tester2', email: 'tester2@test.com' };
    const token = jwt.sign(payload, secret, { expiresIn: '1h' });
    console.log('Using token:', token);

    const postData = JSON.stringify({ fromUserId: 3 });
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/users/friends/accept',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': 'Bearer ' + token
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Response:', data);
      });
    });

    req.on('error', (e) => {
      console.error('Request error', e);
    });

    req.write(postData);
    req.end();
  } catch (e) {
    console.error(e);
  }
})();
