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

      // Query usuarios table
      const usuarios = await app.db
        .select()
        .from(schema.usuarios)
        .where(eq(schema.usuarios.email, normalizedEmail));

      if (usuarios.length === 0) {
        app.logger.warn({ email: normalizedEmail }, 'User not found');
        return reply.status(401).send({ error: 'E-mail ou senha incorretos' });
      }

      const user = usuarios[0];
      const senhaHash = user.senhaHash;

      // Verify password
      const passwordMatch = await bcryptjs.compare(senha, senhaHash);

      if (!passwordMatch) {
        app.logger.warn({ email: normalizedEmail }, 'Password mismatch');
        return reply.status(401).send({ error: 'E-mail ou senha incorretos' });
      }

      // Generate JWT token
      const payload: JWTPayload = {
        id: user.id,
        email: user.email,
        role: user.role,
      };

      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
      app.logger.info({ userId: user.id }, 'JWT token generated');

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
    try {
      // Extract Bearer token from Authorization header
      const authHeader = request.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        app.logger.warn('No Bearer token in Authorization header');
        return reply.status(401).send({ error: 'Token não fornecido' });
      }

      const token = authHeader.substring(7); // Remove "Bearer " prefix

      // Verify JWT token
      let payload: JWTPayload;
      try {
        payload = jwt.verify(token, JWT_SECRET) as JWTPayload;
        app.logger.info({ userId: payload.id }, 'JWT verified');
      } catch (jwtErr) {
        app.logger.warn({ jwtError: (jwtErr as Error).message }, 'JWT verification failed');
        return reply.status(401).send({ error: 'Token inválido' });
      }

      // Look up user in usuarios table
      const usuarios = await app.db
        .select()
        .from(schema.usuarios)
        .where(eq(schema.usuarios.id, payload.id));

      if (usuarios.length === 0) {
        app.logger.warn({ userId: payload.id }, 'User not found in usuarios table');
        return reply.status(401).send({ error: 'Usuário não encontrado' });
      }

      const user = usuarios[0];
      app.logger.info({ userId: user.id, email: user.email }, 'User profile fetched');

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
}
