export async function isAuthorizedEdit(req: Request): Promise<boolean> {
  const cookie = req.headers.get('cookie') || '';
  return /(?:^|;\s*)edit_mode=1(?:;|$)/.test(cookie);
}

export function unauthorizedJson() {
  return { message: 'Editing is disabled. Click "Edit dashboard" to enable editing.' };
}

