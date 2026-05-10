export async function GET() {
  return Response.json({ error: 'Not available' }, { status: 404 });
}
