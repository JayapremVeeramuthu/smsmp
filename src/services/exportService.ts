import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// Type assertion for jspdf-autotable plugin hook
interface jsPDFWithPlugin extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

export const exportService = {
  /**
   * Export JSON data to Excel file
   */
  exportToExcel(data: any[], filename: string, sheetName: string = 'Sheet1') {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    
    // Write and download
    XLSX.writeFile(wb, `${filename}.xlsx`);
  },

  /**
   * Export table content to PDF
   */
  exportToPDF(
    title: string, 
    headers: string[], 
    rows: any[][], 
    filename: string,
    subtitle?: string
  ) {
    const doc = new jsPDF() as jsPDFWithPlugin;

    // Set font styles
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(18);
    
    // Add title
    doc.text(title, 14, 22);

    // Add subtitle if any
    if (subtitle) {
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(100, 100, 100);
      doc.text(subtitle, 14, 28);
    }

    // Add Table
    doc.autoTable({
      head: [headers],
      body: rows,
      startY: subtitle ? 34 : 28,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] }, // Tailwind blue-500
      styles: { fontSize: 9 },
      margin: { top: 30 },
      didDrawPage: (data: any) => {
        // Footer
        const str = 'Page ' + doc.getNumberOfPages();
        doc.setFontSize(8);
        const pageSize = doc.internal.pageSize;
        const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
        doc.text(str, data.settings.margin.left, pageHeight - 10);
      }
    });

    // Save file
    doc.save(`${filename}.pdf`);
  }
};
