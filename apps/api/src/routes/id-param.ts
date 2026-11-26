import type { FastifyRequest } from "fastify";
import { z } from "zod";
import type { Refusal } from "../refusal";

/** The id in the request's address. Anything that is not an id names nothing. */
export function idParam(request: FastifyRequest, name: string, notFound: () => Refusal): string {
  const result = z.uuid().safeParse((request.params as Record<string, unknown>)[name]);
  if (!result.success) {
    throw notFound();
  }
  return result.data;
}
