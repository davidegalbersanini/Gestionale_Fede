import { NextResponse } from 'next/server';
import { buildExcelReportBuffer, ExcelReportInput } from '@/lib/excelBuilder';
import { requireAuth } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const body = (await request.json()) as Partial<ExcelReportInput>;

    if (
      !Array.isArray(body.appointments) ||
      !Array.isArray(body.weddings) ||
      !Array.isArray(body.expenses) ||
      !Array.isArray(body.locations) ||
      !body.filter?.periodLabel
    ) {
      return NextResponse.json(
        { success: false, error: 'Dati del report mancanti o non validi' },
        { status: 400 }
      );
    }

    const built = await buildExcelReportBuffer({
      appointments: body.appointments,
      weddings: body.weddings,
      expenses: body.expenses,
      locations: body.locations,
      giftVouchers: Array.isArray(body.giftVouchers) ? body.giftVouchers : [],
      filter: body.filter,
    });

    const safeName = built.fileName.replace(/["\\\r\n]/g, '_');

    return new NextResponse(new Uint8Array(built.buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${safeName}"`,
        'X-Report-Filename': safeName,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    console.error('Error in /api/reports/excel route:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Errore nella generazione del file Excel' },
      { status: 500 }
    );
  }
}
