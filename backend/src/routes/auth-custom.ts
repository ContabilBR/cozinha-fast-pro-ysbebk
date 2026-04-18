import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import { user as userTable, account as accountTable, session as sessionTable } from '../db/schema/auth-schema.js';
import * as schema from '../db/schema/schema.js';
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
    name?: string;
    nome?: string;
    email: string;
    role: string | null;
  };
}

interface MeResponse {
  id: string;
  name?: string;
  nome?: string;
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

      // Try Better Auth user table first (for integration tests)
      let user: any = null;
      let passwordHash: string | null = null;
      let isFromBetterAuth = false;

      const betterAuthUsers = await app.db
        .select()
        .from(userTable)
        .where(eq(userTable.email, email));

      if (betterAuthUsers.length > 0) {
        user = betterAuthUsers[0];
        isFromBetterAuth = true;

        // Get password from account table
        const accounts = await app.db
          .select()
          .from(accountTable)
          .where(eq(accountTable.userId, user.id));

        if (accounts.length > 0) {
          passwordHash = accounts[0].password;
        }
      }

      // If not in Better Auth, try usuarios table
      if (!user) {
        const usuariosRows = await app.db
          .select()
          .from(schema.usuarios)
          .where(eq(schema.usuarios.email, email));

        if (usuariosRows.length > 0) {
          user = usuariosRows[0];
          passwordHash = user.senhaHash;
        }
      }

      if (!user || !passwordHash) {
        app.logger.warn({ email }, 'User not found or no password hash');
        return reply.status(401).send({ error: 'E-mail ou senha incorretos' });
      }

      // Verify password
      const passwordMatch = await bcryptjs.compare(password, passwordHash);

      if (!passwordMatch) {
        app.logger.warn({ email }, 'Password mismatch in login');
        return reply.status(401).send({ error: 'E-mail ou senha incorretos' });
      }

      // Create session token
      const token = randomUUID();
      const now = new Date();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      // Store token in session table with user ID
      await app.db.insert(sessionTable).values({
        id: randomUUID(),
        token: token,
        userId: user.id,
        expiresAt: expiresAt,
        createdAt: now,
        updatedAt: now,
      });

      app.logger.info({ email, userId: user.id }, 'Login successful');

      // Return appropriate response based on source
      if (isFromBetterAuth) {
        return {
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          },
        };
      } else {
        return {
          token,
          user: {
            id: user.id,
            nome: user.nome,
            email: user.email,
            role: user.role,
          },
        };
      }
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

      // Try to fetch user from Better Auth first
      let user: any = null;

      const betterAuthUsers = await app.db
        .select()
        .from(userTable)
        .where(eq(userTable.id, session.userId));

      if (betterAuthUsers.length > 0) {
        user = betterAuthUsers[0];
      }

      // If not in Better Auth, try usuarios table
      if (!user) {
        const usuariosRows = await app.db
          .select()
          .from(schema.usuarios)
          .where(eq(schema.usuarios.id, session.userId));

        if (usuariosRows.length > 0) {
          user = usuariosRows[0];
        }
      }

      if (!user) {
        app.logger.warn({ userId: session.userId }, 'User not found in GET /api/me');
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      app.logger.info({ userId: user.id }, 'User profile fetched from GET /api/me');

      // Return appropriate response based on which table user came from
      if (user.name !== undefined) {
        // Better Auth user
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      } else {
        // usuarios table user
        return {
          id: user.id,
          nome: user.nome,
          email: user.email,
          role: user.role,
        };
      }
    } catch (err) {
      app.logger.error({ err }, 'GET /api/me error');
      throw err;
    }
  });
}
