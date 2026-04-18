import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import { user as userTable, account as accountTable, session as sessionTable } from '../db/schema/auth-schema.js';
import * as bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Get JWT secret from env or use fallback
const JWT_SECRET = process.env.JWT_SECRET || 'cozinhafast_secret_2024';
const JWT_EXPIRY = '7d'; // 7 days

interface LoginBody {
  email: string;
  password: string;
}

interface JWTPayload {
  id: string;
  email: string;
  role: string;
}

export function registerCustomAuthRoutes(app: App) {
  // POST /api/login - Custom JWT login endpoint
  app.fastify.post<{ Body: LoginBody }>('/api/login', {
    schema: {
      description: 'Login with email and password - returns JWT token',
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
                id: { type: 'string', format: 'uuid' },
                nome: { type: 'string' },
                email: { type: 'string' },
                role: { type: 'string' },
              },
            },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
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
  }, async (request: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply) => {
    const { email, password } = request.body;

    // Validate input
    if (!email || !password) {
      app.logger.warn('Login attempt with missing email or password');
      return reply.status(400).send({ error: 'Email and password are required' });
    }

    console.log(`[LOGIN] Attempt for email: ${email}`);
    app.logger.info({ email }, 'Login attempt');

    try {
      // Normalize email
      const normalizedEmail = email.toLowerCase().trim();
      console.log(`[LOGIN] Normalized email: ${normalizedEmail}`);

      let user: any = null;
      let passwordHash: string | null = null;
      let isFromBetterAuth = false;

      // Try Better Auth first
      console.log(`[LOGIN] Checking Better Auth user table for: ${normalizedEmail}`);
      const betterAuthUsers = await app.db
        .select()
        .from(userTable)
        .where(eq(userTable.email, normalizedEmail));

      if (betterAuthUsers.length > 0) {
        user = betterAuthUsers[0];
        isFromBetterAuth = true;
        console.log(`[LOGIN] User found in Better Auth: ${user.id}`);
        app.logger.info({ userId: user.id }, 'User found in Better Auth');

        // Get password from account table
        const accounts = await app.db
          .select()
          .from(accountTable)
          .where(eq(accountTable.userId, user.id));

        if (accounts.length > 0) {
          passwordHash = accounts[0].password;
          console.log(`[LOGIN] Password hash found in Better Auth account table`);
        }
      }

      // If not in Better Auth, try usuarios table
      if (!user) {
        console.log(`[LOGIN] Querying usuarios table for: ${normalizedEmail}`);
        const usuarios = await app.db
          .select()
          .from(schema.usuarios)
          .where(eq(schema.usuarios.email, normalizedEmail));

        if (usuarios.length > 0) {
          user = usuarios[0];
          passwordHash = user.senhaHash;
          console.log(`[LOGIN] User found in usuarios table: ${user.id}`);
          app.logger.info({ usuarioId: user.id }, 'User found in usuarios table');
        }
      }

      if (!user || !passwordHash) {
        console.log(`[LOGIN] User not found or no password hash: ${normalizedEmail}`);
        app.logger.warn({ email: normalizedEmail }, 'User not found');
        return reply.status(401).send({ error: 'Email ou senha incorretos' });
      }

      // Verify password
      console.log(`[LOGIN] Comparing password for user: ${user.id}`);
      console.log(`[LOGIN] Password hash length: ${passwordHash.length}`);

      const passwordMatch = await bcryptjs.compare(password, passwordHash);
      console.log(`[LOGIN] Password match result: ${passwordMatch}`);
      app.logger.info({ userId: user.id, passwordMatch }, 'Password comparison result');

      if (!passwordMatch) {
        console.log(`[LOGIN] Password mismatch for user: ${user.id}`);
        app.logger.warn({ email: normalizedEmail }, 'Password mismatch');
        return reply.status(401).send({ error: 'Email ou senha incorretos' });
      }

      // Generate JWT token
      console.log(`[LOGIN] Generating JWT token for user: ${user.id}`);
      const payload: JWTPayload = {
        id: user.id,
        email: user.email,
        role: user.role,
      };

      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
      console.log(`[LOGIN] JWT token generated successfully`);
      app.logger.info({ userId: user.id }, 'JWT token generated');

      console.log(`[LOGIN] Login successful for user: ${user.email}`);
      app.logger.info({ userId: user.id, email: user.email }, 'Login successful');

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
      console.error('[LOGIN] Error:', err);
      app.logger.error({ err, email }, 'Login error');
      throw err;
    }
  });

  // GET /api/me - Get current user from JWT token or Better Auth session token
  app.fastify.get<{}>('/api/me', {
    schema: {
      description: 'Get current user profile from JWT token or Better Auth session',
      tags: ['auth'],
      response: {
        200: {
          description: 'User profile',
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
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
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Extract Bearer token from Authorization header
      const authHeader = request.headers.authorization;
      console.log(`[ME] Authorization header present: ${!!authHeader}`);

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('[ME] No valid Bearer token provided');
        app.logger.warn('No Bearer token in Authorization header');
        return reply.status(401).send({ error: 'Token não fornecido' });
      }

      const token = authHeader.substring(7); // Remove "Bearer " prefix
      console.log(`[ME] Extracted token (length: ${token.length})`);

      let userId: string | null = null;

      // Try to verify as JWT first
      console.log('[ME] Trying to verify as JWT token');
      try {
        const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;
        userId = payload.id;
        console.log(`[ME] JWT verified for user: ${userId}`);
        app.logger.info({ userId }, 'JWT verified');
      } catch (jwtErr) {
        console.log(`[ME] JWT verification failed: ${(jwtErr as Error).message}`);

        // If JWT verification fails, try Better Auth session token
        console.log('[ME] Trying to verify as Better Auth session token');
        try {
          const sessions = await app.db
            .select()
            .from(sessionTable)
            .where(eq(sessionTable.token, token));

          if (sessions.length > 0) {
            const session = sessions[0];
            // Check if session is not expired
            if (session.expiresAt > new Date()) {
              userId = session.userId;
              console.log(`[ME] Better Auth session verified for user: ${userId}`);
              app.logger.info({ userId }, 'Better Auth session verified');
            } else {
              console.log('[ME] Better Auth session expired');
              app.logger.warn('Better Auth session expired');
            }
          }
        } catch (sessionErr) {
          console.log(`[ME] Session lookup error: ${(sessionErr as Error).message}`);
        }

        if (!userId) {
          console.log('[ME] Token is neither valid JWT nor valid Better Auth session');
          app.logger.warn({ jwtError: (jwtErr as Error).message }, 'JWT and session verification failed');
          return reply.status(401).send({ error: 'Token inválido' });
        }
      }

      // Look up user
      console.log(`[ME] Looking up user: ${userId}`);
      let user: any = null;

      const betterAuthUsers = await app.db
        .select()
        .from(userTable)
        .where(eq(userTable.id, userId));

      if (betterAuthUsers.length > 0) {
        user = betterAuthUsers[0];
        console.log(`[ME] User found in Better Auth: ${user.email}`);
        app.logger.info({ userId: user.id, email: user.email }, 'User profile fetched from Better Auth');
      }

      // If not in Better Auth, try usuarios table
      if (!user) {
        console.log(`[ME] Looking up user in usuarios table: ${userId}`);
        const usuarios = await app.db
          .select()
          .from(schema.usuarios)
          .where(eq(schema.usuarios.id, userId));

        if (usuarios.length > 0) {
          user = usuarios[0];
          console.log(`[ME] User found in usuarios table: ${user.email}`);
          app.logger.info({ userId: user.id, email: user.email }, 'User profile fetched from usuarios');
        }
      }

      if (!user) {
        console.log(`[ME] User not found in either table: ${userId}`);
        app.logger.warn({ userId }, 'User not found in GET /api/me');
        return reply.status(401).send({ error: 'Usuário não encontrado' });
      }

      // Return response with name field (use name from Better Auth or nome from usuarios)
      return {
        id: user.id,
        name: user.name || user.nome,
        email: user.email,
        role: user.role,
      };
    } catch (err) {
      console.error('[ME] Error:', err);
      app.logger.error({ err }, 'GET /api/me error');
      throw err;
    }
  });
}
