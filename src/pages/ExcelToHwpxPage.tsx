import { useState, useCallback, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { supabase } from "@/lib/supabase";

interface MappingRow {
  sheetName: string; // 엑셀 시트명ㄹ
  excelCell: string; // 셀 주소 (예: J21)
  hwpxPlaceholder: string;
  excelValue: string;
}

interface MergeInfo {
  colSpan: number;
  rowSpan: number;
  hidden: boolean; // 병합된 셀 중 좌상단이 아닌 셀
}

function extractPlaceholders(xml: string): string[] {
  const re = /\$[^$]+\$/g;
  const matches = xml.match(re);
  return matches ? [...new Set(matches)] : [];
}

// 병합 정보를 셀 단위 맵으로 변환
function buildMergeMap(
  merges: XLSX.Range[] | undefined,
  maxRow: number,
  maxCol: number,
) {
  const map: Record<string, MergeInfo> = {};

  // 기본값: 모든 셀 visible, span 1
  for (let r = 0; r <= maxRow; r++) {
    for (let c = 0; c <= maxCol; c++) {
      map[`${r}:${c}`] = { colSpan: 1, rowSpan: 1, hidden: false };
    }
  }

  if (!merges) return map;

  for (const merge of merges) {
    const { s, e } = merge;
    // 좌상단 셀에 span 설정
    map[`${s.r}:${s.c}`] = {
      colSpan: e.c - s.c + 1,
      rowSpan: e.r - s.r + 1,
      hidden: false,
    };
    // 나머지 셀은 hidden
    for (let r = s.r; r <= e.r; r++) {
      for (let c = s.c; c <= e.c; c++) {
        if (r === s.r && c === s.c) continue;
        map[`${r}:${c}`] = { colSpan: 1, rowSpan: 1, hidden: true };
      }
    }
  }

  return map;
}

export default function ExcelToHwpxPage() {
  const [excelData, setExcelData] = useState<Record<string, string>>({});
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState("");
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [hwpxFile, setHwpxFile] = useState<File | null>(null);
  const [placeholders, setPlaceholders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<MappingRow[]>([]);
  const [hwpxZip, setHwpxZip] = useState<JSZip | null>(null);
  const [sectionXml, setSectionXml] = useState("");
  const [processing, setProcessing] = useState(false);
  const [previewData, setPreviewData] = useState<string[][]>([]);
  const [mergeMap, setMergeMap] = useState<Record<string, MergeInfo>>({});
  const [maxCol, setMaxCol] = useState(0);
  const [selectedMapping, setSelectedMapping] = useState<number | null>(null);
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [savedTemplates, setSavedTemplates] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [hwpxOriginalBuf, setHwpxOriginalBuf] = useState<Uint8Array | null>(
    null,
  );

  // 전체 시트 데이터: { sheetName: { cellAddr: value } }
  const allSheetDataRef = useRef<Record<string, Record<string, string>>>({});
  // 현재 시트 데이터 ref
  const excelDataRef = useRef<Record<string, string>>({});

  // 셀 주소(콤마 구분 가능)에서 값을 조회하여 공백으로 합침
  const resolveValue = useCallback((m: MappingRow): string => {
    if (!m.excelCell) return "";
    const all = allSheetDataRef.current;
    const cells = m.excelCell
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    const values = cells.map((cell) => {
      if (m.sheetName && all[m.sheetName]) {
        return all[m.sheetName][cell] ?? "";
      }
      return excelDataRef.current[cell] ?? "";
    });
    return values.join(" ");
  }, []);

  // 매핑의 미리보기 값을 엑셀 데이터에서 다시 채우기
  const refreshMappingValues = useCallback(() => {
    const all = allSheetDataRef.current;
    if (Object.keys(all).length === 0) return;
    setMappings((prev) =>
      prev.map((m) => {
        if (!m.excelCell) return m;
        return { ...m, excelValue: resolveValue(m) };
      }),
    );
  }, [resolveValue]);

  // 저장된 템플릿 목록 불러오기
  useEffect(() => {
    loadTemplateList();
  }, []);

  const loadTemplateList = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("hwpx_mappings")
      .select("template_name")
      .eq("user_id", user.id);

    if (data) {
      const names = [...new Set(data.map((d) => d.template_name))];
      setSavedTemplates(names);
    }
  };

  // 매핑 저장
  const saveMappings = async () => {
    if (!templateName.trim()) {
      alert("템플릿 이름을 입력해주세요.");
      return;
    }

    const validMappings = mappings.filter(
      (m) => m.hwpxPlaceholder && m.excelCell,
    );
    if (validMappings.length === 0) {
      alert("저장할 매핑이 없습니다.");
      return;
    }

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        alert("로그인이 필요합니다.");
        return;
      }

      // 기존 매핑 삭제 후 새로 삽입 (upsert 대신 깔끔하게)
      await supabase
        .from("hwpx_mappings")
        .delete()
        .eq("user_id", user.id)
        .eq("template_name", templateName.trim());

      const rows = validMappings.map((m) => ({
        user_id: user.id,
        template_name: templateName.trim(),
        placeholder: m.hwpxPlaceholder,
        sheet_name: m.sheetName || "",
        excel_cell: m.excelCell,
      }));

      const { error } = await supabase.from("hwpx_mappings").insert(rows);
      if (error) throw error;

      alert(`"${templateName}" 매핑이 저장되었습니다. (${rows.length}개)`);
      loadTemplateList();
    } catch (err) {
      alert("저장 실패: " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // 매핑 불러오기
  const loadMappings = async (name: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("hwpx_mappings")
      .select("placeholder, sheet_name, excel_cell")
      .eq("user_id", user.id)
      .eq("template_name", name);

    if (error) {
      alert("불러오기 실패: " + error.message);
      return;
    }

    if (data && data.length > 0) {
      setTemplateName(name);
      setMappings(
        data.map((d) => {
          const m: MappingRow = {
            hwpxPlaceholder: d.placeholder,
            sheetName: d.sheet_name || "",
            excelCell: d.excel_cell || "",
            excelValue: "",
          };
          m.excelValue = resolveValue(m);
          return m;
        }),
      );
    }
  };

  // 매핑 삭제
  const deleteTemplate = async (name: string) => {
    if (!confirm(`"${name}" 매핑을 정말 삭제하시겠습니까?`)) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("hwpx_mappings")
      .delete()
      .eq("user_id", user.id)
      .eq("template_name", name);

    loadTemplateList();
  };

  // 모든 시트의 셀 데이터를 한번에 로드
  const loadAllSheets = useCallback((wb: XLSX.WorkBook) => {
    const all: Record<string, Record<string, string>> = {};
    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name];
      if (!ws["!ref"]) continue;
      const range = XLSX.utils.decode_range(ws["!ref"]);
      const cellMap: Record<string, string> = {};
      for (let r = 0; r <= range.e.r; r++) {
        for (let c = 0; c <= range.e.c; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          const cell = ws[addr];
          if (cell && cell.v !== undefined) cellMap[addr] = String(cell.v);
        }
      }
      all[name] = cellMap;
    }
    allSheetDataRef.current = all;
  }, []);

  const loadSheet = useCallback((wb: XLSX.WorkBook, sheetName: string) => {
    const ws = wb.Sheets[sheetName];
    if (!ws["!ref"]) return;

    const range = XLSX.utils.decode_range(ws["!ref"]);
    const rows = range.e.r + 1;
    const cols = range.e.c + 1;

    const data: string[][] = [];
    const cellMap: Record<string, string> = {};

    for (let r = 0; r < rows; r++) {
      const row: string[] = [];
      for (let c = 0; c < cols; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr];
        const val = cell && cell.v !== undefined ? String(cell.v) : "";
        row.push(val);
        if (val) cellMap[addr] = val;
      }
      data.push(row);
    }

    setPreviewData(data);
    setExcelData(cellMap);
    excelDataRef.current = cellMap;
    setMaxCol(cols - 1);
    setMergeMap(buildMergeMap(ws["!merges"], range.e.r, range.e.c));
  }, []);

  const handleExcelUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        setWorkbook(wb);
        setSheetNames(wb.SheetNames);
        loadAllSheets(wb);

        const firstSheet = wb.SheetNames[0];
        setActiveSheet(firstSheet);
        loadSheet(wb, firstSheet);

        // 이미 매핑이 있으면 값 새로고침
        setTimeout(refreshMappingValues, 0);
      };
      reader.readAsArrayBuffer(file);
    },
    [loadSheet, loadAllSheets, refreshMappingValues],
  );

  const handleSheetChange = (sheetName: string) => {
    if (!workbook) return;
    setActiveSheet(sheetName);
    loadSheet(workbook, sheetName);
  };

  const handleHwpxUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setHwpxFile(file);
      const arrayBuf = await file.arrayBuffer();
      setHwpxOriginalBuf(new Uint8Array(arrayBuf));
      const zip = await JSZip.loadAsync(arrayBuf);
      setHwpxZip(zip);

      const sectionFile = zip.file("Contents/section0.xml");
      if (!sectionFile) {
        alert("Contents/section0.xml을 찾을 수 없습니다.");
        return;
      }

      const xml = await sectionFile.async("string");
      setSectionXml(xml);

      const phs = extractPlaceholders(xml);
      setPlaceholders(phs);

      setMappings(
        phs.map((ph) => ({
          sheetName: "",
          excelCell: "",
          hwpxPlaceholder: ph,
          excelValue: "",
        })),
      );
    },
    [],
  );

  // 매핑 업데이트 (셀 주소만 수동 입력 시 — 시트는 유지)
  const updateMappingCell = useCallback(
    (index: number, cellAddr: string) => {
      const upper = cellAddr.toUpperCase().trim();
      setMappings((prev) =>
        prev.map((m, i) => {
          if (i !== index) return m;
          const updated = {
            ...m,
            excelCell: upper,
            sheetName: m.sheetName || activeSheet,
          };
          return { ...updated, excelValue: resolveValue(updated) };
        }),
      );
    },
    [activeSheet, resolveValue],
  );

  const addMapping = () => {
    setMappings((prev) => [
      ...prev,
      { sheetName: "", excelCell: "", hwpxPlaceholder: "", excelValue: "" },
    ]);
  };

  const removeMapping = (index: number) => {
    setMappings((prev) => prev.filter((_, i) => i !== index));
    if (selectedMapping === index) setSelectedMapping(null);
  };

  const updatePlaceholder = (index: number, value: string) => {
    setMappings((prev) =>
      prev.map((m, i) => (i === index ? { ...m, hwpxPlaceholder: value } : m)),
    );
  };

  // 셀 클릭 → 선택된 매핑 행에 시트명 + 셀 주소 반영
  const handleCellClick = (rowIdx: number, colIdx: number) => {
    const addr = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx });
    setSelectedCell(addr);

    if (selectedMapping !== null) {
      const val = excelDataRef.current[addr] || "";
      setMappings((prev) =>
        prev.map((m, i) =>
          i === selectedMapping
            ? { ...m, sheetName: activeSheet, excelCell: addr, excelValue: val }
            : m,
        ),
      );
    }
  };

  // 매핑 행 선택 (토글)
  const handleMappingSelect = (index: number) => {
    setSelectedMapping((prev) => (prev === index ? null : index));
  };

  const generateHwpx = async () => {
    if (!hwpxZip || !sectionXml) {
      alert("HWPX 파일을 먼저 업로드해주세요.");
      return;
    }

    setProcessing(true);
    try {
      let modifiedXml = sectionXml;

      for (const mapping of mappings) {
        if (!mapping.hwpxPlaceholder) continue;
        // 이미 매핑에 세팅된 excelValue를 그대로 사용
        const val = mapping.excelValue ?? "";
        const escaped = mapping.hwpxPlaceholder.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&",
        );
        modifiedXml = modifiedXml.replace(new RegExp(escaped, "g"), val);
      }

      // 원본 바이너리에서 다시 로드하여 ZIP 구조 최대한 보존
      if (!hwpxOriginalBuf) {
        alert("원본 HWPX 파일이 없습니다. 다시 업로드해주세요.");
        return;
      }
      const srcZip = await JSZip.loadAsync(hwpxOriginalBuf as Uint8Array);

      // 파일별 압축 방식을 원본과 동일하게 유지
      const storedFiles = new Set([
        "mimetype",
        "version.xml",
        "Preview/PrvImage.png",
      ]);
      const finalZip = new JSZip();

      for (const [filename, file] of Object.entries(srcZip.files)) {
        if (file.dir) continue;
        if (filename === "Contents/section0.xml") {
          finalZip.file(filename, modifiedXml);
        } else {
          const content = await file.async("uint8array");
          if (storedFiles.has(filename)) {
            finalZip.file(filename, content, { compression: "STORE" });
          } else {
            finalZip.file(filename, content);
          }
        }
      }

      const blob = await finalZip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        hwpxFile?.name?.replace(".hwpx", "_완성.hwpx") || "output.hwpx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("생성 중 오류: " + (err as Error).message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="p-4 max-w-full mx-auto space-y-6">
      <h1 className="text-xl font-bold">엑셀 → HWPX 변환</h1>
      <p className="text-sm text-muted-foreground">
        엑셀 셀 값을 HWPX 템플릿의 플레이스홀더($...$)에 매핑하여 변환합니다.
      </p>

      {/* 파일 업로드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded-lg p-4 space-y-2">
          <h2 className="font-semibold text-sm">1. 엑셀 파일 업로드</h2>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleExcelUpload}
            className="block w-full text-sm file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
          />
          {sheetNames.length > 1 && (
            <select
              value={activeSheet}
              onChange={(e) => handleSheetChange(e.target.value)}
              className="mt-1 block w-full rounded border px-2 py-1 text-sm"
            >
              {sheetNames.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="border rounded-lg p-4 space-y-2">
          <h2 className="font-semibold text-sm">2. HWPX 템플릿 업로드</h2>
          <input
            type="file"
            accept=".hwpx"
            onChange={handleHwpxUpload}
            className="block w-full text-sm file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
          />
          {placeholders.length > 0 && (
            <p className="text-xs text-muted-foreground">
              감지된 플레이스홀더: {placeholders.join(", ")}
            </p>
          )}
        </div>
      </div>

      {/* 엑셀 미리보기 (병합 셀 반영) */}
      {previewData.length > 0 && (
        <div className="border rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-sm">엑셀 미리보기</h2>
            {selectedMapping !== null && (
              <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                매핑 #{selectedMapping + 1} 선택 중 — 셀을 클릭하세요
              </span>
            )}
            {selectedCell && (
              <span className="text-xs font-mono text-muted-foreground">
                선택: {selectedCell} = {excelData[selectedCell] || "(빈 셀)"}
              </span>
            )}
          </div>
          <div className="overflow-auto max-h-[500px] border rounded">
            <table className="text-xs border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="border px-1 py-0.5 sticky top-0 left-0 bg-muted z-20 min-w-[30px]"></th>
                  {Array.from({ length: maxCol + 1 }, (_, ci) => (
                    <th
                      key={ci}
                      className="border px-1 py-0.5 font-mono sticky top-0 bg-muted z-10 min-w-[40px]"
                    >
                      {XLSX.utils.encode_col(ci)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewData.slice(0, 100).map((row, ri) => (
                  <tr key={ri}>
                    <td className="border px-1 py-0.5 font-mono bg-muted sticky left-0 z-10 text-center text-[10px]">
                      {ri + 1}
                    </td>
                    {row.map((val, ci) => {
                      const info = mergeMap[`${ri}:${ci}`];
                      if (info?.hidden) return null;

                      const addr = XLSX.utils.encode_cell({ r: ri, c: ci });
                      const isSelected = selectedCell === addr;

                      return (
                        <td
                          key={ci}
                          colSpan={info?.colSpan || 1}
                          rowSpan={info?.rowSpan || 1}
                          onClick={() => handleCellClick(ri, ci)}
                          className={`border px-1 py-0.5 cursor-pointer whitespace-pre-wrap max-w-[200px] truncate ${
                            isSelected
                              ? "bg-blue-200 ring-2 ring-blue-500"
                              : "hover:bg-blue-50"
                          } ${val ? "" : "text-muted-foreground"}`}
                          title={`${addr}: ${val}`}
                        >
                          {val || "\u00A0"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 저장된 매핑 불러오기 */}
      {savedTemplates.length > 0 && (
        <div className="border rounded-lg p-4 space-y-2">
          <h2 className="font-semibold text-sm">저장된 매핑</h2>
          <div className="flex flex-wrap gap-2">
            {savedTemplates.map((name) => (
              <div
                key={name}
                className="flex items-center gap-1 border rounded px-2 py-1 bg-muted/50"
              >
                <button
                  onClick={() => loadMappings(name)}
                  className="text-sm hover:text-primary"
                >
                  {name}
                </button>
                <button
                  onClick={() => deleteTemplate(name)}
                  className="text-red-400 hover:text-red-600 text-xs ml-1"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 매핑 테이블 */}
      {mappings.length > 0 && (
        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm">
              3. 매핑 설정 (행을 클릭하여 선택 → 엑셀 셀 클릭)
            </h2>
            <button
              onClick={addMapping}
              className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90"
            >
              + 매핑 추가
            </button>
          </div>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted">
                <th className="border px-2 py-1 w-8">#</th>
                <th className="border px-2 py-1 text-left">
                  HWPX 플레이스홀더
                </th>
                <th className="border px-2 py-1 text-left">시트</th>
                <th className="border px-2 py-1 text-left">셀 주소</th>
                <th className="border px-2 py-1 text-left">미리보기 값</th>
                <th className="border px-2 py-1 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((m, i) => (
                <tr
                  key={i}
                  onClick={() => handleMappingSelect(i)}
                  className={`cursor-pointer transition-colors ${
                    selectedMapping === i
                      ? "bg-blue-100 ring-1 ring-blue-400"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <td className="border px-2 py-1 text-center text-xs text-muted-foreground">
                    {i + 1}
                  </td>
                  <td className="border px-2 py-1">
                    <input
                      value={m.hwpxPlaceholder}
                      onChange={(e) => updatePlaceholder(i, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full rounded border px-1 py-0.5 text-sm font-mono"
                      placeholder="$플레이스홀더$"
                    />
                  </td>
                  <td className="border px-2 py-1">
                    <span className="text-xs font-mono text-muted-foreground">
                      {m.sheetName || "-"}
                    </span>
                  </td>
                  <td className="border px-2 py-1">
                    <input
                      value={m.excelCell}
                      onChange={(e) => updateMappingCell(i, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full rounded border px-1 py-0.5 text-sm font-mono"
                      placeholder="예: A1, B3"
                    />
                  </td>
                  <td className="border px-2 py-1 text-muted-foreground font-mono text-xs">
                    {m.excelValue || "-"}
                  </td>
                  <td className="border px-2 py-1 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeMapping(i);
                      }}
                      className="text-red-500 hover:text-red-700 text-xs"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 매핑 저장 + 생성 버튼 */}
      {mappings.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            className="rounded border px-2 py-1.5 text-sm w-48"
            placeholder="템플릿 이름 (예: 대기측정기록부)"
          />
          <button
            onClick={saveMappings}
            disabled={saving}
            className="px-4 py-2 rounded border bg-muted hover:bg-muted/80 text-sm font-semibold disabled:opacity-50"
          >
            {saving ? "저장 중..." : "매핑 저장"}
          </button>
          <button
            onClick={generateHwpx}
            disabled={processing}
            className="px-6 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 font-semibold"
          >
            {processing ? "생성 중..." : "HWPX 생성 및 다운로드"}
          </button>
        </div>
      )}
    </div>
  );
}
