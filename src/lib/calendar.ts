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

export function createGoogleCalendarUrl(params: GoogleCalendarEventParams): string {
  const { title, startDate, endDate, details, location } = params;

  const start = new Date(startDate);
  // Default to 1 hour duration if endDate is not specified
  const end = endDate ? new Date(endDate) : new Date(start.getTime() + 60 * 60 * 1000);

  // Format YYYYMMDDTHHmmssZ
  const formatGCalDate = (d: Date) => {
    return d.toISOString().replace(/-|:|\.\d\d\d/g, "");
  };

  const datesParam = `${formatGCalDate(start)}/${formatGCalDate(end)}`;

  const query = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: datesParam,
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
