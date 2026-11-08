/**
 * Google Calendar Helper
 * Generates direct Google Calendar web intent links or exports ICS files
 */

export interface GoogleCalendarEventParams {
  title: string;
  startDate: string; // ISO datetime or YYYY-MM-DD
  endDate?: string;
  details?: string;
  location?: string;
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

