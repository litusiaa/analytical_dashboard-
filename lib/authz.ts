export async function isAuthorizedEdit(req: Request): Promise<boolean> {
  const cookie = req.headers.get('cookie') || '';
  return /(?:^|;\s*)edit_mode=1(?:;|$)/.test(cookie);
}

export function unauthorizedJson() {
  return { error: 'Editing is disabled. Enable Edit dashboard.' };
}

