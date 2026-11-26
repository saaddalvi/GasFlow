/** A shared schema, as much of it as checking a query takes. */
interface QuerySchema<Query> {
  safeParse: (input: unknown) => { data?: Query };
}

/**
 * Answers a screen that is asking this web app for something, from what the
 * address asks. The caller checks that someone is signed in first.
 */
export async function answerLookup<Query>(
  request: Request,
  schema: QuerySchema<Query>,
  ask: (query: Query) => Promise<unknown>,
): Promise<Response> {
  const { data } = schema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (data === undefined) {
    return new Response(null, { status: 400 });
  }
  return Response.json(await ask(data));
}
