import { dbClient } from '../../src/shared/database.js';
import { registerUser, loginUser } from '../../src/modules/auth/services/auth-service.js';

let counter = 0;

export async function createUserWithRoles(roles) {
  counter += 1;
  const email = `test-user-${Date.now()}-${counter}@example.com`;
  const password = 'TestPassword123!';

  await registerUser(email, password);
  await dbClient.query('UPDATE users SET roles = $1 WHERE email = $2', [roles, email]);
  const { user, tokens } = await loginUser(email, password);

  return { user, token: tokens.accessToken };
}

export async function createAdminToken() {
  const { token } = await createUserWithRoles(['admin']);
  return token;
}
