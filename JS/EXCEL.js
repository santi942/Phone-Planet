/* =========================================
   PHONE PLANET - EXCEL (.xlsx) SIN LIBRERÍAS EXTERNAS
   Lee y crea archivos .xlsx directamente en el navegador.

   PhonePlanetExcel.write(hojas)            -> Blob (.xlsx)
   PhonePlanetExcel.download(nombre, hojas) -> descarga el archivo
   PhonePlanetExcel.read(archivo)           -> { name, rows } (primera hoja)

   Cada hoja: { name, widths:[...], freezeRows:1, rows:[[celda,...],...] }
   Cada celda: valor simple o { v: valor, s: estilo }
   Estilos: header, title, bold, section, money, moneyBold, moneySection,
            date, int, result, resultLabel
========================================= */

(() => {
    "use strict";

    const encoder = new TextEncoder();
    const decoder = new TextDecoder("utf-8");

    const MAX_UNZIPPED_BYTES = 20 * 1024 * 1024;
    const MAX_ROWS = 5000;
    const MAX_COLUMNS = 60;

    // ---------- CRC32 y ZIP (sin compresión) ----------
    const CRC_TABLE = (() => {
        const table = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) {
                c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
            }
            table[n] = c >>> 0;
        }
        return table;
    })();

    function crc32(bytes) {
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < bytes.length; i++) {
            crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
        }
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    function zipStore(files) {
        const parts = [];
        const central = [];
        let offset = 0;

        const now = new Date();
        const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
        const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

        files.forEach(file => {
            const name = encoder.encode(file.name);
            const crc = crc32(file.data);
            const size = file.data.length;

            const local = new DataView(new ArrayBuffer(30));
            local.setUint32(0, 0x04034b50, true);
            local.setUint16(4, 20, true);
            local.setUint16(6, 0x0800, true);
            local.setUint16(8, 0, true);
            local.setUint16(10, dosTime, true);
            local.setUint16(12, dosDate, true);
            local.setUint32(14, crc, true);
            local.setUint32(18, size, true);
            local.setUint32(22, size, true);
            local.setUint16(26, name.length, true);
            local.setUint16(28, 0, true);
            parts.push(new Uint8Array(local.buffer), name, file.data);

            const entry = new DataView(new ArrayBuffer(46));
            entry.setUint32(0, 0x02014b50, true);
            entry.setUint16(4, 20, true);
            entry.setUint16(6, 20, true);
            entry.setUint16(8, 0x0800, true);
            entry.setUint16(10, 0, true);
            entry.setUint16(12, dosTime, true);
            entry.setUint16(14, dosDate, true);
            entry.setUint32(16, crc, true);
            entry.setUint32(20, size, true);
            entry.setUint32(24, size, true);
            entry.setUint16(28, name.length, true);
            entry.setUint32(42, offset, true);
            central.push(new Uint8Array(entry.buffer), name);

            offset += 30 + name.length + size;
        });

        const centralSize = central.reduce((sum, part) => sum + part.length, 0);
        const end = new DataView(new ArrayBuffer(22));
        end.setUint32(0, 0x06054b50, true);
        end.setUint16(8, files.length, true);
        end.setUint16(10, files.length, true);
        end.setUint32(12, centralSize, true);
        end.setUint32(16, offset, true);

        return new Blob([...parts, ...central, new Uint8Array(end.buffer)], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        });
    }

    // ---------- Escritura ----------
    const STYLE_INDEX = {
        header: 1,
        title: 2,
        bold: 3,
        section: 4,
        money: 5,
        moneyBold: 6,
        date: 7,
        int: 8,
        result: 9,
        resultLabel: 10,
        moneySection: 11
    };

    const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;$&quot;\\ #,##0"/><numFmt numFmtId="165" formatCode="yyyy\\-mm\\-dd"/></numFmts>
<fonts count="4">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
<font><b/><sz val="14"/><name val="Calibri"/></font>
</fonts>
<fills count="5">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF1F3A5F"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE8EEF7"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFDFF3E4"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="12">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="1" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="left"/></xf>
<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="164" fontId="1" fillId="4" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/>
<xf numFmtId="0" fontId="1" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="164" fontId="1" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

    function xmlEscape(value) {
        return String(value)
            // Caracteres de control que XML no admite.
            .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function columnName(index) {
        let name = "";
        let n = index + 1;
        while (n > 0) {
            const rest = (n - 1) % 26;
            name = String.fromCharCode(65 + rest) + name;
            n = Math.floor((n - 1) / 26);
        }
        return name;
    }

    function dateSerial(iso) {
        const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
        if (!match) return null;
        const utc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
        return Math.round((utc - Date.UTC(1899, 11, 30)) / 86400000);
    }

    function cellXml(cell, ref) {
        if (cell === null || cell === undefined || cell === "") return "";

        const spec = typeof cell === "object" && !Array.isArray(cell) ? cell : { v: cell };
        let value = spec.v;
        if (value === null || value === undefined || value === "") {
            return spec.s && STYLE_INDEX[spec.s] ? `<c r="${ref}" s="${STYLE_INDEX[spec.s]}"/>` : "";
        }

        const style = STYLE_INDEX[spec.s] ? ` s="${STYLE_INDEX[spec.s]}"` : "";

        if (spec.s === "date") {
            const serial = dateSerial(value);
            if (serial !== null) return `<c r="${ref}"${style}><v>${serial}</v></c>`;
        }

        if (typeof value === "number") {
            if (!Number.isFinite(value)) return "";
            return `<c r="${ref}"${style}><v>${value}</v></c>`;
        }

        value = String(value);
        return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
    }

    function sheetXml(sheet) {
        const widths = (sheet.widths || []).map((width, index) =>
            `<col min="${index + 1}" max="${index + 1}" width="${Number(width) || 12}" customWidth="1"/>`
        ).join("");

        const freeze = Number(sheet.freezeRows) > 0
            ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${Number(sheet.freezeRows)}" topLeftCell="A${Number(sheet.freezeRows) + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
            : "";

        const rows = (sheet.rows || []).map((row, rowIndex) => {
            const cells = row.map((cell, columnIndex) =>
                cellXml(cell, `${columnName(columnIndex)}${rowIndex + 1}`)
            ).join("");
            return `<row r="${rowIndex + 1}">${cells}</row>`;
        }).join("");

        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${freeze}${widths ? `<cols>${widths}</cols>` : ""}<sheetData>${rows}</sheetData></worksheet>`;
    }

    function safeSheetName(name, index) {
        const cleaned = String(name || "").replace(/[\[\]:*?\/\\]/g, " ").trim().slice(0, 31);
        return cleaned || `Hoja${index + 1}`;
    }

    function write(sheets) {
        const list = (Array.isArray(sheets) ? sheets : [sheets]).filter(Boolean);
        if (!list.length) throw new Error("No hay datos para exportar.");

        const used = new Set();
        const names = list.map((sheet, index) => {
            let name = safeSheetName(sheet.name, index);
            let candidate = name;
            let counter = 2;
            while (used.has(candidate.toLowerCase())) {
                candidate = `${name.slice(0, 28)} ${counter++}`;
            }
            used.add(candidate.toLowerCase());
            return candidate;
        });

        const files = [
            {
                name: "[Content_Types].xml",
                data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${list.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`)
            },
            {
                name: "_rels/.rels",
                data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`)
            },
            {
                name: "xl/workbook.xml",
                data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((name, i) => `<sheet name="${xmlEscape(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`)
            },
            {
                name: "xl/_rels/workbook.xml.rels",
                data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${list.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${list.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`)
            },
            { name: "xl/styles.xml", data: encoder.encode(STYLES_XML) },
            ...list.map((sheet, i) => ({
                name: `xl/worksheets/sheet${i + 1}.xml`,
                data: encoder.encode(sheetXml(sheet))
            }))
        ];

        return zipStore(files);
    }

    function download(filename, sheets) {
        const blob = write(sheets);
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    // ---------- Lectura ----------
    async function inflateRaw(bytes) {
        if (typeof DecompressionStream === "undefined") {
            throw new Error("Este navegador no puede leer Excel. Actualízalo o usa Chrome, Edge o Safari recientes.");
        }

        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
        return new Uint8Array(await new Response(stream).arrayBuffer());
    }

    const NOT_XLSX = "El archivo no es un Excel (.xlsx) válido.";

    function openZip(buffer) {
        const bytes = new Uint8Array(buffer);
        const view = new DataView(buffer);

        let end = -1;
        for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
            if (view.getUint32(i, true) === 0x06054b50) {
                end = i;
                break;
            }
        }
        if (end < 0) throw new Error(NOT_XLSX);

        const count = view.getUint16(end + 10, true);
        let pointer = view.getUint32(end + 16, true);
        const entries = new Map();
        let total = 0;

        for (let i = 0; i < count; i++) {
            if (pointer + 46 > bytes.length || view.getUint32(pointer, true) !== 0x02014b50) {
                throw new Error(NOT_XLSX);
            }

            const method = view.getUint16(pointer + 10, true);
            const compressed = view.getUint32(pointer + 20, true);
            const size = view.getUint32(pointer + 24, true);
            const nameLength = view.getUint16(pointer + 28, true);
            const extraLength = view.getUint16(pointer + 30, true);
            const commentLength = view.getUint16(pointer + 32, true);
            const offset = view.getUint32(pointer + 42, true);
            const name = decoder.decode(bytes.subarray(pointer + 46, pointer + 46 + nameLength));

            entries.set(name, { method, compressed, offset });
            total += size;
            pointer += 46 + nameLength + extraLength + commentLength;
        }

        if (total > MAX_UNZIPPED_BYTES) throw new Error("El archivo es demasiado grande.");

        return {
            has: name => entries.has(name),
            async text(name) {
                const entry = entries.get(name);
                if (!entry) return null;

                const nameLength = view.getUint16(entry.offset + 26, true);
                const extraLength = view.getUint16(entry.offset + 28, true);
                const start = entry.offset + 30 + nameLength + extraLength;
                const data = bytes.subarray(start, start + entry.compressed);

                if (entry.method === 0) return decoder.decode(data);
                if (entry.method === 8) return decoder.decode(await inflateRaw(data));
                throw new Error(NOT_XLSX);
            }
        };
    }

    function parseXml(text) {
        const doc = new DOMParser().parseFromString(text, "application/xml");
        if (doc.getElementsByTagName("parsererror").length) throw new Error(NOT_XLSX);
        return doc;
    }

    const byName = (node, name) => Array.from(node.getElementsByTagNameNS("*", name));

    function textOf(node) {
        // Une los <t> del texto, ignorando la pronunciación fonética (<rPh>).
        return byName(node, "t")
            .filter(t => {
                for (let p = t.parentNode; p && p !== node; p = p.parentNode) {
                    if (p.localName === "rPh") return false;
                }
                return true;
            })
            .map(t => t.textContent)
            .join("");
    }

    function columnIndex(ref) {
        const letters = /^[A-Z]+/i.exec(ref || "");
        if (!letters) return -1;

        let index = 0;
        for (const char of letters[0].toUpperCase()) {
            index = index * 26 + (char.charCodeAt(0) - 64);
        }
        return index - 1;
    }

    async function read(file) {
        if (!file) throw new Error("Selecciona un archivo.");
        if (file.size > 2 * 1024 * 1024) throw new Error("El archivo pesa más de 2 MB.");

        const zip = openZip(await file.arrayBuffer());

        const workbookText = await zip.text("xl/workbook.xml");
        if (!workbookText) throw new Error(NOT_XLSX);

        const workbook = parseXml(workbookText);
        const firstSheet = byName(workbook, "sheet")[0];
        if (!firstSheet) throw new Error("El archivo no tiene hojas.");

        const relId =
            firstSheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") ||
            firstSheet.getAttribute("r:id");

        let path = "xl/worksheets/sheet1.xml";
        const relsText = await zip.text("xl/_rels/workbook.xml.rels");

        if (relsText && relId) {
            const rel = byName(parseXml(relsText), "Relationship").find(item => item.getAttribute("Id") === relId);
            if (rel) {
                const target = rel.getAttribute("Target") || "";
                path = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
            }
        }

        const sheetText = await zip.text(path);
        if (!sheetText) throw new Error(NOT_XLSX);

        const sharedText = await zip.text("xl/sharedStrings.xml");
        const shared = sharedText
            ? byName(parseXml(sharedText), "si").map(textOf)
            : [];

        const rows = [];
        let sequence = 0;

        for (const row of byName(parseXml(sheetText), "row")) {
            sequence = Number(row.getAttribute("r")) || sequence + 1;
            if (sequence > MAX_ROWS) break;

            const values = [];
            let next = 0;

            for (const cell of Array.from(row.childNodes).filter(node => node.localName === "c")) {
                let index = columnIndex(cell.getAttribute("r"));
                if (index < 0) index = next;
                next = index + 1;
                if (index >= MAX_COLUMNS) continue;

                const type = cell.getAttribute("t");
                const valueNode = byName(cell, "v")[0];
                const raw = valueNode ? valueNode.textContent : "";
                let value = "";

                if (type === "s") value = shared[Number(raw)] ?? "";
                else if (type === "inlineStr") value = textOf(cell);
                else if (type === "str" || type === "d") value = raw;
                else if (type === "b") value = raw === "1" ? "Sí" : "No";
                else if (type === "e") value = "";
                else if (raw !== "") value = Number.isFinite(Number(raw)) ? Number(raw) : raw;

                values[index] = value;
            }

            for (let i = 0; i < values.length; i++) {
                if (values[i] === undefined) values[i] = "";
            }

            rows[sequence - 1] = values;
        }

        for (let i = 0; i < rows.length; i++) {
            if (!rows[i]) rows[i] = [];
        }

        return { name: firstSheet.getAttribute("name") || "Hoja1", rows };
    }

    window.PhonePlanetExcel = { write, download, read };
})();
