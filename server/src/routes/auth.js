const express = require('express');
const { google } = require('googleapis');

const router = express.Router();

function getOAuthClient() {
  const appUrl = process.env.APP_URL || 'http://localhost:5173';
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${appUrl}/auth/google/callback`
  );
}

// Redirect to Google login
router.get('/google', (req, res) => {
  const oauth2Client = getOAuthClient();
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/gmail.send',
    ],
  });
  res.redirect(url);
});

// Google redirects back here
router.get('/google/callback', async (req, res) => {
  const { code } = req.query;
  const oauth2Client = getOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  // Get user profile
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const { data } = await oauth2.userinfo.get();

  req.session.tokens = tokens;
  req.session.user = { name: data.name, email: data.email, picture: data.picture };

  res.redirect(process.env.APP_URL || 'http://localhost:5173');
});

router.get('/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
  res.json(req.session.user);
});

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

module.exports = { router, getOAuthClient };
