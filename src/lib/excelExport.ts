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

export async function exportAppointmentsToExcel(params: {
  appointments: Appointment[];
  weddings: WeddingService[];
  expenses: Expense[];
  locations: Location[];
  giftVouchers?: GiftVoucher[];
  filter: ExportFilterOptions;
}): Promise<ExportExcelResult> {
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
      fileName: data.fileName || `Gestionale_Fede_Report.xlsx`,
      localSuccess: false,
      driveSuccess: data.success === true,
      driveFileId: data.fileId,
      driveWebViewLink: data.webViewLink,
      driveError: data.error,
      scopeMissing: data.scopeMissing,
    };
  } catch (err: any) {
    return {
      fileName: `Gestionale_Fede_Report.xlsx`,
      localSuccess: false,
      driveSuccess: false,
      driveError: err.message,
    };
  }
}
