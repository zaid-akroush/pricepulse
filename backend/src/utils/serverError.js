// Answer an unexpected failure without leaking internals (Prisma messages
// include the database host and column names). The real error goes to the log.
module.exports = function serverError(res, err) {
  console.error(err);
  return res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
};
