/**
 * Google Calendar Helper
 * Supports direct background API sync (automatic, no new tabs)
 * with graceful fallback to web intent links if not authenticated.
 */

export interface GoogleCalendarEventParams {
  eventId?: string;
  title: string;
  startDate: string; // ISO datetime or YYYY-MM-DD
  endDate?: string;
  details?: string;
  location?: string;
  colorHex?: string;
}

function formatGCalWallClock(dateStr: string, addMinutes: number = 0): string {
  const match = (dateStr || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!match) {
    const parsed = new Date(dateStr);
    const ms = isNaN(parsed.getTime()) ? Date.now() : parsed.getTime();
    return new Date(ms + addMinutes * 60_000).toISOString().replace(/-|:|\.\d\d\d/g, '');
  }
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  const hour = parseInt(match[4] || '0', 10);
  const minute = parseInt(match[5] || '0', 10);
  const second = parseInt(match[6] || '0', 10);
  const d = new Date(Date.UTC(year, month - 1, day, hour, minute + addMinutes, second));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
}

export function createGoogleCalendarUrl(params: GoogleCalendarEventParams): string {
  const { title, startDate, endDate, details, location } = params;

  const startFormatted = formatGCalWallClock(startDate);
  const endFormatted = endDate
    ? formatGCalWallClock(endDate)
    : formatGCalWallClock(startDate, 60);

  const datesParam = `${startFormatted}/${endFormatted}`;

  const query = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: datesParam,
    ctz: "Europe/Rome",
    details: details || "",
    location: location || "",
  });

  return `https://calendar.google.com/calendar/render?${query.toString()}`;
}

export function openInGoogleCalendar(params: GoogleCalendarEventParams): void {
  const url = createGoogleCalendarUrl(params);
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

/**
 * Check if the user has connected Google Calendar via OAuth
 */
export async function checkGoogleCalendarStatus(): Promise<{ connected: boolean; email?: string }> {
  try {
    const res = await fetch('/api/auth/google/status', { cache: 'no-store' });
    if (!res.ok) return { connected: false };
    return await res.json();
  } catch {
    return { connected: false };
  }
}

/**
 * Disconnect Google Calendar
 */
export async function disconnectGoogleCalendar(): Promise<void> {
  try {
    await fetch('/api/auth/google/status', { method: 'POST' });
  } catch (err) {
    console.error('Failed to disconnect Google Calendar:', err);
  }
}

/**
 * Start OAuth flow
 */
export async function startGoogleCalendarConnect(): Promise<void> {
  try {
    const res = await fetch('/api/auth/google/url');
    const data = await res.json();
    if (data.url && typeof window !== 'undefined') {
      window.location.href = data.url;
    }
  } catch (err) {
    console.error('Failed to start Google Calendar OAuth:', err);
  }
}

/**
 * Automatic background sync: saves to Google Calendar without opening any new tab!
 * Falls back to opening web intent only if Google Calendar is not connected.
 */
export async function syncCalendarAutomatically(
  params: GoogleCalendarEventParams
): Promise<{ success: boolean; eventId?: string }> {
  try {
    const res = await fetch('/api/calendar/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        return { success: true, eventId: data.eventId };
      }
    }
  } catch (e) {
    console.warn('Background sync error, trying fallback:', e);
  }

  // Fallback: If not connected yet, open Google Calendar tab so user doesn't lose the event
  openInGoogleCalendar(params);
  return { success: false };
}

/**
 * Delete event from Google Calendar in background
 */
export async function deleteCalendarEventSilently(eventId: string): Promise<void> {
  if (!eventId) return;
  try {
    await fetch(`/api/calendar/sync?eventId=${encodeURIComponent(eventId)}`, {
      method: 'DELETE',
    });
  } catch (e) {
    console.error('Failed to delete Google Calendar event:', e);
  }
}
