import { NextResponse } from 'next/server';
import { uploadFileToGoogleDrive } from '@/lib/googleAuth';
import { buildExcelReportBuffer, ExcelReportInput } from '@/lib/excelBuilder';
import { requireAuth } from '@/lib/session';

export const dynamic = 'force-dynamic';

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB

function sanitizeFileName(raw: string): string {
  const cleaned = raw
    .replace(/[/\\]/g, '_')
    .replace(/[\x00-\x1f\x7f]/g, '')
    .trim();
  return cleaned || 'Gestionale_Fede_Report.xlsx';
}

export async function POST(request: Request) {
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const body = (await request.json()) as Partial<ExcelReportInput> & {
      fileName?: string;
      fileBase64?: string;
    };

    let fileName: string;
    let fileBuffer: Buffer;

    if (
      Array.isArray(body.appointments) &&
      Array.isArray(body.weddings) &&
      Array.isArray(body.expenses) &&
      Array.isArray(body.locations) &&
      body.filter?.periodLabel
    ) {
      const built = await buildExcelReportBuffer({
        appointments: body.appointments,
        weddings: body.weddings,
        expenses: body.expenses,
        locations: body.locations,
        giftVouchers: Array.isArray(body.giftVouchers) ? body.giftVouchers : [],
        filter: body.filter,
      });
      fileName = sanitizeFileName(built.fileName);
      fileBuffer = built.buffer;
    } else if (typeof body.fileName === 'string' && typeof body.fileBase64 === 'string') {
      if (body.fileBase64.length > Math.ceil((MAX_UPLOAD_BYTES * 4) / 3) + 1024) {
        return NextResponse.json(
          { success: false, error: 'Il file supera il limite massimo consentito di 15 MB' },
          { status: 413 }
        );
      }
      fileName = sanitizeFileName(body.fileName);
      fileBuffer = Buffer.from(body.fileBase64, 'base64');
      if (fileBuffer.length > MAX_UPLOAD_BYTES) {
        return NextResponse.json(
          { success: false, error: 'Il file supera il limite massimo consentito di 15 MB' },
          { status: 413 }
        );
      }
    } else {
      return NextResponse.json(
        { success: false, error: 'Dati del report mancanti o incompleti' },
        { status: 400 }
      );
    }

    const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    const result = await uploadFileToGoogleDrive({
      fileName,
      mimeType,
      fileBuffer,
      folderName: 'Gestionale Fede - Report',
    });

    if (!result.success) {
      return NextResponse.json({ ...result, fileName }, { status: result.scopeMissing ? 403 : 500 });
    }

    return NextResponse.json({ ...result, fileName });
  } catch (error: any) {
    console.error('Error in /api/drive/upload route:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Errore interno nel caricamento su Google Drive' },
      { status: 500 }
    );
  }
}
