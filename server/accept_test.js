(async () => {
  try {
    const jwt = require('jsonwebtoken');
    const fetch = require('node-fetch');
    const secret = 'ReplaceWithASecureRandomSecret';
    const payload = { id: 4, username: 'tester2', email: 'tester2@test.com' };
    const token = jwt.sign(payload, secret, { expiresIn: '1h' });
    console.log('Generated token:', token);

    const res = await fetch('http://localhost:3000/api/users/friends/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ fromUserId: 3 })
    });
    console.log('Status', res.status);
    const text = await res.text();
    console.log('Body', text);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
