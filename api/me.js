const { isAuthed } = require('./_lib/auth');

module.exports = async (req, res) => {
  res.status(200).json({ authenticated: isAuthed(req) });
};
