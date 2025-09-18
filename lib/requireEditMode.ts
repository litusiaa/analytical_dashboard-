export async function requireEditMode(req?: Request) {
  const cookie = (req?.headers?.get('cookie') || '');
  const ok = /(?:^|;\s*)edit_mode=1(?:;|$)/.test(cookie);
  if (!ok) {
    const err = new Error('Editing is disabled. Enable Edit dashboard.');
    (err as any).statusCode = 401;
    throw err;
  }
}


