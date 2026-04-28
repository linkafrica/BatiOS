export const dynamic = 'force-dynamic';

export function GET(): Response {
  return Response.json({
    service: 'qs-dashboard',
    status: 'ok',
    checkedAt: new Date().toISOString(),
  });
}
