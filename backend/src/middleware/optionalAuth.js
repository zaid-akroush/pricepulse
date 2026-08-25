const jwt = require('jsonwebtoken');

// Like `auth`, but never rejects the request.
//
// Some routes are public yet render differently for a signed-in viewer — the
// community notes list, for example, needs to know which notes *you* already
// liked so the vote button can show as active. Using the strict `auth`
// middleware there would lock signed-out visitors out of a public page, and
// leaving it off entirely means a signed-in user's own votes never show.
// This sets req.userId when a valid token is present and quietly moves on
// when it isn't.
//
// Note: unlike `auth` this does NOT check tokenVersion, so it must only ever
// be used to personalise a public read — never to authorise a write.
module.exports = function optionalAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
      req.userId = decoded.userId;
    } catch {
      /* invalid/expired token — treat as signed out */
    }
  }
  next();
};
