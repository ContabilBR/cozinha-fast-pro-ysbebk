Edit ONLY the file backend/src/routes/auth.ts. Do not touch any other file.

Find this exact block — from the comment right after the sign-out route's
closing `);` through the closing `);` of the update-user route — and DELETE
it entirely, including the blank line after it:

  // POST /api/auth/update-user - Update user profile (restaurante_id, role, etc.)
  app.fastify.post<{ Body: { restaurante_id?: string; role?: string } }>(
    "/api/auth/update-user",
    {
      schema: {
        description: "Update user profile (restaurante_id, role, etc.)",
        tags: ["auth"],
        body: {
          type: "object",
          properties: {
            restaurante_id: { type: "string", format: "uuid" },
            role: { type: "string", enum: ["garcom", "gerente", "administrador", "cozinheiro"] },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
            },
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
          401: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: { restaurante_id?: string; role?: string } }>, reply: FastifyReply) => {
      try {
        const authHeader = request.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        const token = authHeader.slice(7).trim();

        // Get session
        let sessions;
        try {
          sessions = await app.db
            .select()
            .from(sessionTable)
            .where(eq(sessionTable.token, token))
            .limit(1);
        } catch (err: any) {
          app.logger.error({ err }, "Error querying session table");
          return reply.status(401).send({ error: "Invalid token" });
        }

        if (!sessions || sessions.length === 0) {
          return reply.status(401).send({ error: "Invalid token" });
        }

        const session = sessions[0];
        const userId = session.userId;

        // Get or create profile
        let existingProfiles;
        try {
          existingProfiles = await app.db
            .select()
            .from(schema.profiles)
            .where(eq(schema.profiles.userId, userId))
            .limit(1);
        } catch (err: any) {
          app.logger.error({ err, userId }, "Error querying profiles table");
          return reply.status(500).send({ error: "Internal server error" });
        }

        const { restaurante_id, role } = request.body;
        const updates: any = {};

        if (restaurante_id) {
          updates.restauranteId = restaurante_id;
        }

        if (role) {
          updates.role = role;
        }

        // If no updates provided, just return success (no-op)
        if (Object.keys(updates).length === 0) {
          return reply.status(200).send({ success: true });
        }

        // Try to update/insert profile, but don't fail on FK constraint errors
        try {
          if (existingProfiles && existingProfiles.length > 0) {
            // Update existing profile
            await app.db
              .update(schema.profiles)
              .set(updates)
              .where(eq(schema.profiles.userId, userId));
          } else {
            // Create new profile with defaults
            if (!restaurante_id) {
              return reply.status(400).send({ error: "restaurante_id is required when creating profile" });
            }
            await app.db.insert(schema.profiles).values({
              userId,
              restauranteId: restaurante_id,
              role: role || "garcom",
              createdAt: new Date(),
            });
          }

          app.logger.info({ userId, updates }, "User profile updated");
        } catch (updateError: any) {
          // Handle foreign key constraint errors gracefully - just log and continue
          const errorStr = String(updateError?.message || "").toLowerCase();
          const code = updateError?.code;
          const detail = String(updateError?.detail || "").toLowerCase();

          if (code === '23503' || code === 23503 || errorStr.includes('foreign key') || errorStr.includes('violates') || detail.includes('foreign key')) {
            app.logger.warn({ err: updateError, userId, updates }, "Invalid restaurante_id - foreign key constraint, silently ignoring");
          } else {
            throw updateError;
          }
        }

        return reply.status(200).send({ success: true });
      } catch (error: any) {
        app.logger.error({ err: error, message: error?.message, code: error?.code }, "Failed to update user profile");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

Do not touch sessionTable, schema.profiles, or any other import — they are
still used elsewhere in this file. Do not change any other route.

After editing, run and show me:
grep -n "update-user" backend/src/routes/auth.ts
(must be empty)
wc -l backend/src/routes/auth.ts
(should show 519 — was 657)
