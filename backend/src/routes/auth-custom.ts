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
    email: string;
    name: string;
    role: string | null;
  };
}

interface MeResponse {
  id: string;
  email: string;
  name: string;
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
                email: { type: 'string' },
                name: { type: 'string' },
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
    app.logger.info({ email: request.body.email }, 'Custom login attempt');

    try {
      const { email, password } = request.body;

      // Find user by email
      const users = await app.db
        .select()
        .from(userTable)
        .where(eq(userTable.email, email));

      if (users.length === 0) {
        app.logger.warn({ email }, 'User not found in login');
        return reply.status(401).send({ error: 'Invalid email or password' });
      }

      const user = users[0];

      // Find credential account
      const accounts = await app.db
        .select()
        .from(accountTable)
        .where(eq(accountTable.userId, user.id));

      if (accounts.length === 0) {
        app.logger.warn({ userId: user.id }, 'Credential account not found');
        return reply.status(401).send({ error: 'Invalid email or password' });
      }

      const account = accounts[0];

      // Verify password
      const passwordMatch = await bcryptjs.compare(password, account.password || '');

      if (!passwordMatch) {
        app.logger.warn({ email }, 'Password mismatch in login');
        return reply.status(401).send({ error: 'Invalid email or password' });
      }

      // Create session
      const token = randomUUID();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      const now = new Date();

      await app.db.insert(sessionTable).values({
        id: randomUUID(),
        token: token,
        userId: user.id,
        expiresAt: expiresAt,
        createdAt: now,
        updatedAt: now,
      });

      app.logger.info({ email, userId: user.id }, 'Custom login successful');

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      };
    } catch (err) {
      app.logger.error({ err }, 'Custom login error');
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
            email: { type: 'string' },
            name: { type: 'string' },
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
        app.logger.warn('Missing or invalid authorization header in /api/me');
        return reply.status(401).send({ error: 'Missing or invalid authorization header' });
      }

      const token = authHeader.substring(7); // Remove "Bearer " prefix

      // Find session by token
      const sessions = await app.db
        .select()
        .from(sessionTable)
        .where(eq(sessionTable.token, token));

      if (sessions.length === 0) {
        app.logger.warn('Session not found for token');
        return reply.status(401).send({ error: 'Invalid token' });
      }

      const session = sessions[0];

      // Check expiration
      if (new Date() > session.expiresAt) {
        app.logger.warn({ sessionId: session.id }, 'Session expired');
        return reply.status(401).send({ error: 'Token expired' });
      }

      // Fetch user
      const users = await app.db
        .select()
        .from(userTable)
        .where(eq(userTable.id, session.userId));

      if (users.length === 0) {
        app.logger.warn({ userId: session.userId }, 'User not found in /api/me');
        return reply.status(401).send({ error: 'User not found' });
      }

      const user = users[0];

      app.logger.info({ userId: user.id }, 'User profile fetched from /api/me');

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      };
    } catch (err) {
      app.logger.error({ err }, '/api/me error');
      throw err;
    }
  });
}
