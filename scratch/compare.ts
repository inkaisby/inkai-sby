import { prisma } from '../src/lib/prisma';
import fs from 'fs';

function parseCSV(text: string) {
  const rows: string[][] = [];
  let curRow: string[] = [];
  let curVal = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        curVal += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      curRow.push(curVal);
      curVal = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      curRow.push(curVal);
      if (curRow.some(cell => cell.trim().length > 0)) {
        rows.push(curRow);
      }
      curRow = [];
      curVal = '';
    } else {
      curVal += char;
    }
  }

  if (curVal || curRow.length > 0) {
    curRow.push(curVal);
    if (curRow.some(cell => cell.trim().length > 0)) {
      rows.push(curRow);
    }
  }

  return rows;
}

async function main() {
  const dbEntries = await prisma.kasEntry.findMany({
    where: {
      scopeType: 'branch',
      scopeId: 'a56182fa-5b6b-46c8-ac24-2da1a25746c6',
      txnDate: {
        gte: new Date('2026-01-01T00:00:00.000Z'),
        lte: new Date('2026-09-12T23:59:59.999Z')
      }
    },
    orderBy: { txnDate: 'asc' }
  });

  let dbTotalIn = 0;
  let dbTotalOut = 0;
  for (const e of dbEntries) {
    dbTotalIn += e.amountIn;
    dbTotalOut += e.amountOut;
  }

  console.log('=== WEB APP DATABASE (DB) ===');
  console.log('DB Record Count:', dbEntries.length);
  console.log('DB Total Masuk (In):', dbTotalIn.toLocaleString('id-ID'));
  console.log('DB Total Keluar (Out):', dbTotalOut.toLocaleString('id-ID'));
  console.log('DB Saldo Akhir (Net):', (dbTotalIn - dbTotalOut).toLocaleString('id-ID'));

  // Parse CSV
  const csvText = fs.readFileSync('./scratch/spreadsheet.csv', 'utf8');
  const parsedRows = parseCSV(csvText);

  let csvTotalIn = 0;
  let csvTotalOut = 0;

  function cleanNum(val: string | undefined) {
    if (!val) return 0;
    const cleaned = val.replace(/"/g, '').replace(/Rp/g, '').replace(/\./g, '').replace(/\s/g, '').replace(/,/g, '');
    if (cleaned === '' || cleaned === '#NAME?') return 0;
    return parseInt(cleaned, 10) || 0;
  }

  const csvItems: Array<{ rowNo: string; date: string; desc: string; masuk: number; keluar: number; lineIdx: number }> = [];

  for (let i = 0; i < parsedRows.length; i++) {
    const row = parsedRows[i];
    if (row.length < 5) continue;
    
    const rowNo = row[0]?.trim();
    const date = row[1]?.trim();
    const desc = row[2]?.trim();
    const masuk = cleanNum(row[3]);
    const keluar = cleanNum(row[4]);

    if (masuk > 0 || keluar > 0) {
      csvTotalIn += masuk;
      csvTotalOut += keluar;
      csvItems.push({ rowNo, date, desc, masuk, keluar, lineIdx: i + 1 });
    }
  }

  console.log('\n=== CSV SPREADSHEET ===');
  console.log('CSV Transactions Count:', csvItems.length);
  console.log('CSV Total Masuk (In):', csvTotalIn.toLocaleString('id-ID'));
  console.log('CSV Total Keluar (Out):', csvTotalOut.toLocaleString('id-ID'));
  console.log('CSV Saldo Akhir (Net):', (csvTotalIn - csvTotalOut).toLocaleString('id-ID'));

  console.log('\n=== COMPARISON SUMMARY ===');
  console.log('Total Masuk Diff (DB - CSV):', (dbTotalIn - csvTotalIn).toLocaleString('id-ID'));
  console.log('Total Keluar Diff (DB - CSV):', (dbTotalOut - csvTotalOut).toLocaleString('id-ID'));
  console.log('Saldo Akhir Diff (DB - CSV):', ((dbTotalIn - dbTotalOut) - (csvTotalIn - csvTotalOut)).toLocaleString('id-ID'));

  // Detailed Discrepancy Matching
  const unmatchedDb = [...dbEntries];
  const unmatchedCsv = [...csvItems];
  const exactMatches: any[] = [];

  for (let cIdx = unmatchedCsv.length - 1; cIdx >= 0; cIdx--) {
    const c = unmatchedCsv[cIdx];
    const dbIdx = unmatchedDb.findIndex(d => d.amountIn === c.masuk && d.amountOut === c.keluar);
    if (dbIdx >= 0) {
      exactMatches.push({ csv: c, db: unmatchedDb[dbIdx] });
      unmatchedDb.splice(dbIdx, 1);
      unmatchedCsv.splice(cIdx, 1);
    }
  }

  console.log(`\nExact Matched Rows: ${exactMatches.length}`);
  console.log(`Unmatched DB Rows (in Web App): ${unmatchedDb.length}`);
  console.log(`Unmatched CSV Rows (in Spreadsheet): ${unmatchedCsv.length}`);

  if (unmatchedDb.length > 0) {
    console.log('\n--- UNMATCHED DB ENTRIES (WEB APP) ---');
    for (const d of unmatchedDb) {
      console.log(`[DB ID: ${d.id}] Date: ${d.txnDate.toISOString().slice(0, 10)} | In: ${d.amountIn.toLocaleString('id-ID')} | Out: ${d.amountOut.toLocaleString('id-ID')} | Desc: ${d.description}`);
    }
  }

  if (unmatchedCsv.length > 0) {
    console.log('\n--- UNMATCHED CSV ENTRIES (SPREADSHEET) ---');
    for (const c of unmatchedCsv) {
      console.log(`[Line ${c.lineIdx} / Row ${c.rowNo}] Date: ${c.date} | In: ${c.masuk.toLocaleString('id-ID')} | Out: ${c.keluar.toLocaleString('id-ID')} | Desc: ${c.desc}`);
    }
  }
}

main().catch(console.error);
