import {
  WILAYAH_COLUMN_LABELS,
  WILAYAH_MATRIX,
  type WilayahColumn,
} from "@/lib/wilayah-rbac";

const COLUMNS: WilayahColumn[] = ["USER", "RANTING", "CABANG", "PENGPROV"];

export function WilayahPermissionsMatrix() {
  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="border-b bg-muted/40 px-4 py-3">
        <h3 className="text-sm font-bold tracking-wide uppercase">Wilayah</h3>
        <p className="text-xs text-muted-foreground">
          Matriks hak akses User → Ranting → Cabang → Pengprov
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/20">
              <th className="w-40 px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">
                Area
              </th>
              {COLUMNS.map((col) => (
                <th
                  key={col}
                  className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground"
                >
                  {WILAYAH_COLUMN_LABELS[col]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {WILAYAH_MATRIX.map((row) => (
              <tr key={row.id} className="border-b last:border-0 align-top">
                <td className="px-3 py-3 font-semibold text-foreground">
                  {row.label}
                </td>
                {COLUMNS.map((col) => (
                  <td
                    key={col}
                    className="px-3 py-3 text-muted-foreground leading-snug"
                  >
                    {row.cells[col]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
