import type { App } from '../index.js';
import type { FastifyRequest } from 'fastify';
import { eq } from 'drizzle-orm';
import { user as userTable, account as accountTable } from '../db/schema/auth-schema.js';
import * as bcryptjs from 'bcryptjs';

interface DebugSigninBody {
  email: string;
  password: string;
}

export function registerDebugRoutes(app: App) {
  app.fastify.post<{ Body: DebugSigninBody }>('/api/debug/signin', {
    schema: {
      description: 'Debug endpoint to test sign-in without Better Auth',
      tags: ['debug'],
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string' },
          password: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            userFound: { type: 'boolean' },
            accountFound: { type: 'boolean' },
            passwordMatch: { type: 'boolean' },
            user: { type: 'object' },
            account: { type: 'object' },
            error: { type: 'string' },
          },
        },
        500: {
          type: 'object',
          properties: {
            userFound: { type: 'boolean' },
            accountFound: { type: 'boolean' },
            passwordMatch: { type: 'boolean' },
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: DebugSigninBody }>, reply) => {
    app.logger.info({ email: request.body.email }, 'Debug sign-in attempt');

    try {
      const { email, password } = request.body as { email: string; password: string };

      // Query the user by email
      const users = await app.db
        .select()
        .from(userTable)
        .where(eq(userTable.email, email));

      const userFound = users.length > 0;
      const user = users[0];

      if (!userFound) {
        app.logger.warn({ email }, 'User not found');
        return reply.status(200).send({
          userFound: false,
          accountFound: false,
          passwordMatch: false,
          error: 'User not found',
        });
      }

      // Query the account by user_id and provider_id
      const accounts = await app.db
        .select()
        .from(accountTable)
        .where(eq(accountTable.userId, user.id));

      const accountFound = accounts.length > 0;
      const account = accounts[0];

      if (!accountFound) {
        app.logger.warn({ userId: user.id }, 'Account not found');
        return reply.status(200).send({
          userFound: true,
          accountFound: false,
          passwordMatch: false,
          user,
          error: 'Account not found',
        });
      }

      // Compare password
      const passwordMatch = await bcryptjs.compare(password, account.password || '');

      app.logger.info(
        { email, userFound, accountFound, passwordMatch },
        'Debug sign-in result'
      );

      return reply.status(200).send({
        userFound,
        accountFound,
        passwordMatch,
        user,
        account: {
          ...account,
          password: account.password ? `[HASHED: ${account.password.substring(0, 10)}...]` : null,
        },
      });
    } catch (err) {
      app.logger.error({ err }, 'Debug sign-in error');
      reply.status(500);
      return {
        userFound: false,
        accountFound: false,
        passwordMatch: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  });
}
