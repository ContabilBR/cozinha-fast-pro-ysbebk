import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import * as bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Get JWT secret from env or use fallback
const JWT_SECRET = process.env.JWT_SECRET || 'cozinhafast_secret_2024';
const JWT_EXPIRY = '7d'; // 7 days

interface LoginBody {
  email: string;
  senha: string;
}

interface JWTPayload {
  id: string;
  email: string;
  role: string;
  nome: string;
}

export function registerCustomAuthRoutes(app: App) {
  // POST /api/login - Custom JWT login endpoint
  app.fastify.post<{ Body: LoginBody }>('/api/login', {
    schema: {
      description: 'Login with email and senha (password) - returns JWT token',
      tags: ['auth'],
      body: {
        type: 'object',
        required: ['email', 'senha'],
        properties: {
          email: { type: 'string', format: 'email' },
          senha: { type: 'string' },
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
    const { email, senha } = request.body;

    // Validate input
    if (!email || !senha) {
      app.logger.warn('Login attempt with missing email or senha');
      return reply.status(400).send({ error: 'E-mail e senha são obrigatórios' });
    }

    app.logger.info({ email }, 'Login attempt');

    try {
      // Normalize email
      const normalizedEmail = email.toLowerCase().trim();
      app.logger.debug({ normalizedEmail }, 'Normalized email for lookup');

      // Query usuarios table
      app.logger.debug('Querying usuarios table');
      const usuarios = await app.db
        .select()
        .from(schema.usuarios)
        .where(eq(schema.usuarios.email, normalizedEmail));

      app.logger.debug({ usuariosFound: usuarios.length }, 'Query result');

      if (usuarios.length === 0) {
        app.logger.warn({ email: normalizedEmail }, 'User not found in usuarios table');
        return reply.status(401).send({ error: 'Credenciais inválidas' });
      }

      const user = usuarios[0];
      const senhaHash = user.senhaHash;

      app.logger.debug({
        userId: user.id,
        email: user.email,
        hasHash: !!senhaHash,
        hashLength: senhaHash?.length || 0
      }, 'User found, checking password hash');

      // Verify password hash exists
      if (!senhaHash) {
        app.logger.warn({ email: normalizedEmail }, 'User has no password hash');
        return reply.status(401).send({ error: 'Credenciais inválidas' });
      }

      // Verify password
      app.logger.debug({ senhaLength: senha.length }, 'Comparing password');
      const passwordMatch = await bcryptjs.compare(senha, senhaHash);

      app.logger.debug({ passwordMatch }, 'Password comparison result');

      if (!passwordMatch) {
        app.logger.warn({ email: normalizedEmail }, 'Password mismatch');
        return reply.status(401).send({ error: 'Credenciais inválidas' });
      }

      // Generate JWT token
      const payload: JWTPayload = {
        id: user.id,
        email: user.email,
        role: user.role,
        nome: user.nome,
      };

      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
      app.logger.info({ userId: user.id, email: user.email }, 'JWT token generated successfully');

      return {
        token,
        user: {
          id: user.id,
          nome: user.nome,
          email: user.email,
          role: user.role,
        },
      };
    } catch (err) {
      app.logger.error({ err, email }, 'Login error');
      throw err;
    }
  });

  // GET /api/me - Get current user from JWT token
  app.fastify.get<{}>('/api/me', {
    schema: {
      description: 'Get current user profile from JWT token',
      tags: ['auth'],
      response: {
        200: {
          description: 'User profile',
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            nome: { type: 'string' },
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
    app.logger.info('GET /api/me - Fetching current user profile');
    try {
      // Verify JWT and attach user context to request
      const isAuthenticated = await verifyAndAttachUser(app, request, reply);
      if (!isAuthenticated) return;

      const userId = (request as any).userId;
      app.logger.debug({ userId }, 'User authenticated, looking up in usuarios table');

      // Look up user in usuarios table
      const usuarios = await app.db
        .select()
        .from(schema.usuarios)
        .where(eq(schema.usuarios.id, userId));

      if (usuarios.length === 0) {
        app.logger.warn({ userId }, 'User not found in usuarios table');
        return reply.status(401).send({ error: 'Invalid or expired token' });
      }

      const user = usuarios[0];
      app.logger.info({ userId: user.id, email: user.email }, 'User profile fetched successfully');

      return {
        id: user.id,
        nome: user.nome,
        email: user.email,
        role: user.role,
      };
    } catch (err) {
      app.logger.error({ err }, 'GET /api/me error');
      throw err;
    }
  });

  // GET /api/debug/usuarios - Debug endpoint to view all usuarios (senha_hash masked)
  app.fastify.get<{}>('/api/debug/usuarios', {
    schema: {
      description: 'Debug endpoint - list all usuarios with masked passwords',
      tags: ['debug'],
      response: {
        200: {
          description: 'List of usuarios with masked passwords',
          type: 'object',
          properties: {
            usuarios: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  nome: { type: 'string' },
                  email: { type: 'string' },
                  senha_hash: { type: 'string' },
                  role: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      app.logger.info('Debug endpoint: fetching all usuarios');
      const allUsuarios = await app.db
        .select()
        .from(schema.usuarios);

      const maskedUsuarios = allUsuarios.map(u => ({
        id: u.id,
        nome: u.nome,
        email: u.email,
        senha_hash: '***',
        role: u.role,
      }));

      return {
        usuarios: maskedUsuarios,
      };
    } catch (err) {
      app.logger.error({ err }, 'Debug endpoint error');
      throw err;
    }
  });
}

/**
 * Helper function to protect routes with JWT authentication.
 * Validates the Bearer token in Authorization header and attaches userId and role to request context.
 * Should be called at the start of protected route handlers.
 *
 * @param request - Fastify request object
 * @param reply - Fastify reply object
 * @returns true if authentication succeeds, false if it fails (reply with 401 sent)
 *
 * Usage:
 * app.fastify.get('/api/protected', async (request, reply) => {
 *   if (!await verifyAndAttachUser(request, reply)) return;
 *   const userId = (request as any).userId;
 *   const role = (request as any).role;
 *   // ... route logic using userId and role
 * });
 */
export async function verifyAndAttachUser(
  app: App,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<boolean> {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    app.logger.warn('No Bearer token in Authorization header for protected route');
    reply.status(401).send({ error: 'Invalid or expired token' });
    return false;
  }

  const token = authHeader.substring(7);

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;
    // Attach user context to request for downstream handlers
    (request as any).userId = payload.id;
    (request as any).role = payload.role;
    (request as any).userEmail = payload.email;
    (request as any).userName = payload.nome;

    app.logger.debug(
      { userId: payload.id, role: payload.role },
      'JWT token validated and user context attached'
    );
    return true;
  } catch (err) {
    app.logger.warn(
      { error: (err as Error).message },
      'JWT token verification failed for protected route'
    );
    reply.status(401).send({ error: 'Invalid or expired token' });
    return false;
  }
}
