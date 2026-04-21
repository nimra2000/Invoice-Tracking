export function csvEscape(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function stringifyCSV(headers, rows) {
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  return lines.join("\r\n");
}

export function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    if (row.length > 1 || (row.length === 1 && row[0] !== "")) rows.push(row);
    row = [];
  };
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      pushField();
      i++;
      continue;
    }
    if (c === "\n" || c === "\r") {
      pushField();
      pushRow();
      if (c === "\r" && text[i + 1] === "\n") i++;
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field !== "" || row.length > 0) {
    pushField();
    pushRow();
  }
  if (rows.length === 0) return { headers: [], records: [] };
  const [headers, ...data] = rows;
  const records = data.map((r) => {
    const o = {};
    headers.forEach((h, idx) => (o[h.trim()] = (r[idx] ?? "").trim()));
    return o;
  });
  return { headers: headers.map((h) => h.trim()), records };
}

export function downloadCSV(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
