import { Appointment, WeddingService, Expense, Location, GiftVoucher } from '@/types';

export interface ExportFilterOptions {
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  periodLabel: string;
}

export interface ExportExcelResult {
  fileName: string;
  localSuccess: boolean;
  driveSuccess: boolean;
  driveFileId?: string;
  driveWebViewLink?: string;
  driveError?: string;
  scopeMissing?: boolean;
}

export interface ReportExportParams {
  appointments: Appointment[];
  weddings: WeddingService[];
  expenses: Expense[];
  locations: Location[];
  giftVouchers?: GiftVoucher[];
  filter: ExportFilterOptions;
}

export async function downloadAppointmentsExcel(
  params: ReportExportParams
): Promise<{ fileName: string; localSuccess: boolean; error?: string }> {
  const { appointments, weddings, expenses, locations, giftVouchers = [], filter } = params;

  try {
    const res = await fetch('/api/reports/excel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appointments,
        weddings,
        expenses,
        locations,
        giftVouchers,
        filter,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return {
        fileName: 'Gestionale_Fede_Report.xlsx',
        localSuccess: false,
        error: errData.error || 'Errore durante la generazione del file Excel',
      };
    }

    const fileName = res.headers.get('X-Report-Filename') || 'Gestionale_Fede_Report.xlsx';
    const blob = await res.blob();

    if (typeof window !== 'undefined') {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    return { fileName, localSuccess: true };
  } catch (err: any) {
    return {
      fileName: 'Gestionale_Fede_Report.xlsx',
      localSuccess: false,
      error: err.message || 'Errore durante il download del file Excel',
    };
  }
}

export async function exportAppointmentsToExcel(
  params: ReportExportParams
): Promise<ExportExcelResult> {
  const { appointments, weddings, expenses, locations, giftVouchers = [], filter } = params;

  try {
    const res = await fetch('/api/drive/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appointments,
        weddings,
        expenses,
        locations,
        giftVouchers,
        filter,
      }),
    });

    const data = await res.json();
    return {
      fileName: data.fileName || 'Gestionale_Fede_Report.xlsx',
      localSuccess: false,
      driveSuccess: data.success === true,
      driveFileId: data.fileId,
      driveWebViewLink: data.webViewLink,
      driveError: data.error,
      scopeMissing: data.scopeMissing,
    };
  } catch (err: any) {
    return {
      fileName: 'Gestionale_Fede_Report.xlsx',
      localSuccess: false,
      driveSuccess: false,
      driveError: err.message,
    };
  }
}
