import json
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

xlsx = Path(sys.argv[1])
with zipfile.ZipFile(xlsx) as z:
    ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    shared = []
    root = ET.fromstring(z.read("xl/sharedStrings.xml"))
    for si in root.findall("m:si", ns):
        shared.append("".join((t.text or "") for t in si.findall(".//m:t", ns)))
    sheet = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
    rows = []
    for row in sheet.findall("m:sheetData/m:row", ns):
        vals = []
        for c in row.findall("m:c", ns):
            t = c.get("t")
            v = c.find("m:v", ns)
            if v is None:
                vals.append("")
            elif t == "s":
                vals.append(shared[int(v.text)])
            else:
                vals.append(v.text)
        if any(vals):
            rows.append(vals)
print(json.dumps(rows))
