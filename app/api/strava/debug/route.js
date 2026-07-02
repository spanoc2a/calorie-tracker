// Endpoint de diagnostic retiré de la production.
export async function GET() {
  return new Response('Not found', { status: 404 });
}
