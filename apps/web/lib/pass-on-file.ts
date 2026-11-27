/**
 * The API's answer to a request for a file, as the browser is to get it: the file
 * under its name, or only the status of a refusal.
 */
export function passOnFile(answer: Response): Response {
  if (!answer.ok) {
    return new Response(null, { status: answer.status });
  }
  const headers = new Headers();
  for (const name of ["content-type", "content-disposition"]) {
    const value = answer.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(answer.body, { headers });
}
