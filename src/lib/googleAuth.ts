import { createClient } from '@supabase/supabase-js';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function getAdminSupabase() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_KEY);
}

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_at: number; // Unix timestamp in ms
  email?: string;
}

export function getRedirectUri(requestUrl: string, headers?: Headers): string {
  if (headers) {
    const forwardedHost = headers.get('x-forwarded-host') || headers.get('host');
    if (forwardedHost && forwardedHost.includes('localhost')) {
      return `http://${forwardedHost}/api/auth/google/callback`;
    }
  }

  // Always use the official registered domain on Vercel / Production
  return 'https://gestionale-fede.vercel.app/api/auth/google/callback';
}

export function getGoogleAuthUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/drive.file openid email profile',
    access_type: 'offline',
    prompt: 'consent',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<GoogleTokens | null> {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    console.error('Failed to exchange code for tokens:', errText);
    return null;
  }

  const tokenData = await tokenRes.json();

  let email: string | undefined;
  if (tokenData.access_token) {
    try {
      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (userInfoRes.ok) {
        const info = await userInfoRes.json();
        email = info.email;
      }
    } catch (e) {
      console.warn('Could not fetch user email info:', e);
    }
  }

  const tokens: GoogleTokens = {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_at: Date.now() + (tokenData.expires_in || 3600) * 1000,
    email,
  };

  return tokens;
}

export async function getStoredTokens(): Promise<GoogleTokens | null> {
  const supabase = getAdminSupabase();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'google_calendar_tokens')
      .single();

    if (error || !data) return null;
    return data.value as GoogleTokens;
  } catch (err) {
    console.error('getStoredTokens error:', err);
    return null;
  }
}

export async function saveStoredTokens(tokens: GoogleTokens): Promise<void> {
  const supabase = getAdminSupabase();
  if (!supabase) return;

  try {
    await supabase.from('settings').upsert({
      key: 'google_calendar_tokens',
      value: tokens,
    });
  } catch (err) {
    console.error('saveStoredTokens error:', err);
  }
}

export async function removeStoredTokens(): Promise<void> {
  const supabase = getAdminSupabase();
  if (!supabase) return;

  try {
    await supabase.from('settings').delete().eq('key', 'google_calendar_tokens');
  } catch (err) {
    console.error('removeStoredTokens error:', err);
  }
}

export async function getValidAccessToken(): Promise<string | null> {
  const tokens = await getStoredTokens();
  if (!tokens) return null;

  // If still valid (with 2 min buffer), return it
  if (tokens.expires_at && tokens.expires_at > Date.now() + 120 * 1000) {
    return tokens.access_token;
  }

  // Refresh if we have a refresh_token
  if (!tokens.refresh_token) {
    console.warn('No refresh token available');
    return null;
  }

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: tokens.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!res.ok) {
      console.error('Token refresh failed:', await res.text());
      return null;
    }

    const data = await res.json();
    const updated: GoogleTokens = {
      ...tokens,
      access_token: data.access_token,
      expires_at: Date.now() + (data.expires_in || 3600) * 1000,
    };

    await saveStoredTokens(updated);
    return updated.access_token;
  } catch (err) {
    console.error('getValidAccessToken error:', err);
    return null;
  }
}

export interface SyncEventParams {
  eventId?: string;
  title: string;
  startDate: string; // ISO datetime
  endDate?: string;
  details?: string;
  location?: string;
  colorHex?: string;
}

// Map any hex color to the closest standard Google Calendar colorId (1 - 11)
function findClosestGoogleColorId(hex?: string): string | undefined {
  if (!hex) return undefined;
  const cleanHex = hex.replace('#', '').trim();
  if (cleanHex.length !== 6) return undefined;

  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  const googleColors: { id: string; rgb: [number, number, number] }[] = [
    { id: '1', rgb: [164, 189, 252] }, // Lavender
    { id: '2', rgb: [122, 231, 191] }, // Sage
    { id: '3', rgb: [219, 173, 255] }, // Grape
    { id: '4', rgb: [255, 136, 124] }, // Flamingo / Rose
    { id: '5', rgb: [251, 215, 91] },  // Banana / Yellow
    { id: '6', rgb: [255, 184, 120] }, // Tangerine / Orange
    { id: '7', rgb: [70, 189, 211] },  // Peacock / Cyan
    { id: '8', rgb: [225, 225, 225] }, // Graphite / Gray
    { id: '9', rgb: [84, 132, 237] },  // Blueberry / Blue
    { id: '10', rgb: [81, 183, 73] },  // Basil / Green
    { id: '11', rgb: [220, 33, 39] },  // Tomato / Red
  ];

  let closestId = '4';
  let minDistance = Infinity;

  for (const gc of googleColors) {
    const dist =
      Math.pow(r - gc.rgb[0], 2) +
      Math.pow(g - gc.rgb[1], 2) +
      Math.pow(b - gc.rgb[2], 2);
    if (dist < minDistance) {
      minDistance = dist;
      closestId = gc.id;
    }
  }

  return closestId;
}

export async function syncGoogleCalendarEvent(params: SyncEventParams): Promise<{ success: boolean; eventId?: string; error?: string }> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return { success: false, error: 'Google Calendar non collegato' };
  }

  const startIso = new Date(params.startDate).toISOString();
  const endIso = params.endDate
    ? new Date(params.endDate).toISOString()
    : new Date(new Date(params.startDate).getTime() + 60 * 60 * 1000).toISOString();

  const colorId = findClosestGoogleColorId(params.colorHex);

  const eventBody: any = {
    summary: params.title,
    description: params.details || '',
    location: params.location || '',
    start: { dateTime: startIso },
    end: { dateTime: endIso },
  };

  if (colorId) {
    eventBody.colorId = colorId;
  }

  try {
    let url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
    let method = 'POST';

    if (params.eventId) {
      url += `/${encodeURIComponent(params.eventId)}`;
      method = 'PUT';
    }

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventBody),
    });

    if (!res.ok) {
      // If PUT fails because event was deleted externally, try POST
      if (params.eventId && res.status === 404) {
        return syncGoogleCalendarEvent({ ...params, eventId: undefined });
      }
      const errText = await res.text();
      return { success: false, error: errText };
    }

    const created = await res.json();
    return { success: true, eventId: created.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteGoogleCalendarEvent(eventId: string): Promise<boolean> {
  const accessToken = await getValidAccessToken();
  if (!accessToken || !eventId) return false;

  try {
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

export async function getOrCreateDriveFolder(accessToken: string, folderName: string): Promise<string | null> {
  try {
    const q = `mimeType='application/vnd.google-apps.folder' and name='${folderName.replace(/'/g, "\\'")}' and trashed=false`;
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&spaces=drive`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.files && data.files.length > 0) {
        return data.files[0].id;
      }
    }

    // Create folder if not found
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      console.error('Failed to create Drive folder:', errText);
      return null;
    }

    const created = await createRes.json();
    return created.id;
  } catch (err) {
    console.error('getOrCreateDriveFolder error:', err);
    return null;
  }
}

export async function uploadFileToGoogleDrive(params: {
  fileName: string;
  mimeType: string;
  fileBuffer: Buffer;
  folderName?: string;
}): Promise<{ success: boolean; fileId?: string; webViewLink?: string; error?: string; scopeMissing?: boolean }> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return { success: false, error: 'Account Google non collegato' };
  }

  try {
    const targetFolder = params.folderName || 'Gestionale Fede - Report';
    const parentFolderId = await getOrCreateDriveFolder(accessToken, targetFolder);

    const boundary = '-------GestionaleFedeBoundary' + Date.now();
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata: { name: string; parents?: string[] } = {
      name: params.fileName,
    };
    if (parentFolderId) {
      metadata.parents = [parentFolderId];
    }

    const multipartRequestBody = Buffer.concat([
      Buffer.from(
        delimiter +
          'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
          JSON.stringify(metadata) +
          delimiter +
          `Content-Type: ${params.mimeType}\r\n\r\n`
      ),
      params.fileBuffer,
      Buffer.from(closeDelimiter),
    ]);

    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
          'Content-Length': String(multipartRequestBody.length),
        },
        body: multipartRequestBody,
      }
    );

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.error('Drive upload error:', uploadRes.status, errText);
      const isScopeError =
        uploadRes.status === 403 &&
        (errText.includes('insufficientFilePermissions') ||
          errText.includes('insufficientPermissions') ||
          errText.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT'));

      return {
        success: false,
        error: errText,
        scopeMissing: isScopeError,
      };
    }

    const fileData = await uploadRes.json();
    return {
      success: true,
      fileId: fileData.id,
      webViewLink: fileData.webViewLink,
    };
  } catch (err: any) {
    console.error('uploadFileToGoogleDrive exception:', err);
    return { success: false, error: err.message };
  }
}


