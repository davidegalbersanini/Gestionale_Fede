import { NextResponse } from 'next/server';
import { syncGoogleCalendarEvent, deleteGoogleCalendarEvent } from '@/lib/googleAuth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await syncGoogleCalendarEvent({
      eventId: body.eventId,
      title: body.title,
      startDate: body.startDate,
      endDate: body.endDate,
      details: body.details,
      location: body.location,
    });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    if (!eventId) {
      return NextResponse.json({ success: false, error: 'Missing eventId' }, { status: 400 });
    }
    const success = await deleteGoogleCalendarEvent(eventId);
    return NextResponse.json({ success });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

