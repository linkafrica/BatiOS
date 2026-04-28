export const dynamic = 'force-dynamic';

export function GET(): Response {
  return Response.json({
    service: 'admin',
    status: 'ok',
    checkedAt: new Date().toISOString(),
  });
}
