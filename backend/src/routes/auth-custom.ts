import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import { user as userTable, account as accountTable, session as sessionTable } from '../db/schema/auth-schema.js';
import * as bcryptjs from 'bcryptjs';
import { randomUUID } from 'crypto';

interface LoginBody {
  email: string;
  password: string;
}

interface LoginResponse {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string | null;
  };
}

interface MeResponse {
  id: string;
  name: string;
  email: string;
  role: string | null;
}

export function registerCustomAuthRoutes(app: App) {
  // POST /api/login - custom email/password login
  app.fastify.post<{ Body: LoginBody }>('/api/login', {
    schema: {
      description: 'Custom login endpoint - email and password authentication',
      tags: ['auth'],
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
      response: {
        200: {
          description: 'Login successful',
          type: 'object',
          properties: {
            token: { type: 'string' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                email: { type: 'string' },
                role: { type: 'string' },
              },
            },
          },
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply): Promise<LoginResponse | void> => {
    app.logger.info({ email: request.body.email }, 'Login attempt');

    try {
      const { email, password } = request.body;

      // Find user by email in Better Auth user table
      const users = await app.db
        .select()
        .from(userTable)
        .where(eq(userTable.email, email));

      if (users.length === 0) {
        app.logger.warn({ email }, 'User not found in login');
        return reply.status(401).send({ error: 'Invalid email or password' });
      }

      const user = users[0];

      // Find credential account for password verification
      const accounts = await app.db
        .select()
        .from(accountTable)
        .where(eq(accountTable.userId, user.id));

      if (accounts.length === 0) {
        app.logger.warn({ userId: user.id }, 'No credential account found');
        return reply.status(401).send({ error: 'Invalid email or password' });
      }

      const account = accounts[0];

      // Verify password
      const passwordMatch = await bcryptjs.compare(password, account.password || '');

      if (!passwordMatch) {
        app.logger.warn({ email }, 'Password mismatch in login');
        return reply.status(401).send({ error: 'Invalid email or password' });
      }

      // Create session token
      const token = randomUUID();
      const now = new Date();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      // Store token in session table
      await app.db.insert(sessionTable).values({
        id: randomUUID(),
        token: token,
        userId: user.id,
        expiresAt: expiresAt,
        createdAt: now,
        updatedAt: now,
      });

      app.logger.info({ email, userId: user.id }, 'Login successful');

      return {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      };
    } catch (err) {
      app.logger.error({ err, email: request.body.email }, 'Login error');
      throw err;
    }
  });

  // GET /api/me - get current user from Bearer token
  app.fastify.get<{}>('/api/me', {
    schema: {
      description: 'Get current user profile from Bearer token',
      tags: ['auth'],
      response: {
        200: {
          description: 'User profile',
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string' },
            role: { type: 'string' },
          },
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply): Promise<MeResponse | void> => {
    try {
      // Extract Bearer token from Authorization header
      const authHeader = request.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        app.logger.warn('Missing authorization header in GET /api/me');
        return reply.status(401).send({ error: 'Token não fornecido' });
      }

      const token = authHeader.substring(7); // Remove "Bearer " prefix

      // Find session by token
      const sessions = await app.db
        .select()
        .from(sessionTable)
        .where(eq(sessionTable.token, token));

      if (sessions.length === 0) {
        app.logger.warn('Session not found for token');
        return reply.status(401).send({ error: 'Token inválido' });
      }

      const session = sessions[0];

      // Fetch user by id from session
      const users = await app.db
        .select()
        .from(userTable)
        .where(eq(userTable.id, session.userId));

      if (users.length === 0) {
        app.logger.warn({ userId: session.userId }, 'User not found in GET /api/me');
        return reply.status(401).send({ error: 'User not found' });
      }

      const user = users[0];

      app.logger.info({ userId: user.id }, 'User profile fetched from GET /api/me');

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      };
    } catch (err) {
      app.logger.error({ err }, 'GET /api/me error');
      throw err;
    }
  });
}
