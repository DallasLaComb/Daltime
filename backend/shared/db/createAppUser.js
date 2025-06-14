// shared/db/users.js

const { pool } = require('./createPool');

async function createAppUser(user) {
  const client = await pool.connect();

  const insertQuery = `
    INSERT INTO public.appuser (userid, companyid, firstname, lastname, phonenumber, email, role)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *;
  `;

  const values = [
    user.userId,
    user.companyId,
    user.firstName,
    user.lastName,
    parseInt(user.phoneNumber),
    user.email,
    user.role,
  ];

  try {
    const result = await client.query(insertQuery, values);
    return result.rows[0];
  } finally {
    client.release();
  }
}

module.exports = {
  createAppUser,
};
