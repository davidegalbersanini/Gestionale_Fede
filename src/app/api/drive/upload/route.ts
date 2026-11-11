import { NextResponse } from 'next/server';
import { uploadFileToGoogleDrive } from '@/lib/googleAuth';
import { buildExcelReportBuffer, ExcelReportInput } from '@/lib/excelBuilder';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<ExcelReportInput> & {
      fileName?: string;
      fileBase64?: string;
    };

    let fileName: string;
    let fileBuffer: Buffer;

    if (body.appointments && body.weddings && body.expenses && body.locations && body.filter) {
      const built = await buildExcelReportBuffer({
        appointments: body.appointments,
        weddings: body.weddings,
        expenses: body.expenses,
        locations: body.locations,
        giftVouchers: body.giftVouchers || [],
        filter: body.filter,
      });
      fileName = built.fileName;
      fileBuffer = built.buffer;
    } else if (body.fileName && body.fileBase64) {
      // Fallback compatibility if raw fileBase64 is passed directly
      fileName = body.fileName;
      fileBuffer = Buffer.from(body.fileBase64, 'base64');
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
