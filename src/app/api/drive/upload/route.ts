import { NextResponse } from 'next/server';
import { uploadFileToGoogleDrive } from '@/lib/googleAuth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fileName, fileBase64 } = body;

    if (!fileName || !fileBase64) {
      return NextResponse.json(
        { success: false, error: 'Parametri mancanti (fileName o fileBase64)' },
        { status: 400 }
      );
    }

    const fileBuffer = Buffer.from(fileBase64, 'base64');
    const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    const result = await uploadFileToGoogleDrive({
      fileName,
      mimeType,
      fileBuffer,
      folderName: 'Gestionale Fede - Report',
    });

    if (!result.success) {
      return NextResponse.json(result, { status: result.scopeMissing ? 403 : 500 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in /api/drive/upload route:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Errore interno nel caricamento su Google Drive' },
      { status: 500 }
    );
  }
}
