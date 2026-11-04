"""Create static PDF font derivatives from pinned OFL website fonts.
Requires fonttools==4.60.2 and brotli==1.2.1; originals are preserved.
"""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
import hashlib,json
root=Path(__file__).resolve().parents[1]
out=root/'functions/assets/invoice-fonts'
manifest=[]
for source,name in [('SourceSans3/SourceSans3-Variable.woff2','ArohaInvoiceSans'),('NotoSansKannada/NotoSansKannada-Variable.woff2','ArohaInvoiceKannada')]:
    p=root/'vendor/natura/fonts'/source
    font=TTFont(p,recalcTimestamp=False)
    axes={a.axisTag:(400 if a.axisTag=="wght" and a.minValue<=400<=a.maxValue else a.defaultValue) for a in font['fvar'].axes}
    font=instantiateVariableFont(font,axes,inplace=True,optimize=True)
    font.flavor=None
    for n in font['name'].names:
        if n.nameID in (1,3,4,6,16): n.string=name.encode(n.getEncoding())
        elif n.nameID in (2,17): n.string='Regular'.encode(n.getEncoding())
    target=out/(name+'.ttf');font.save(target,reorderTables=False)
    manifest.append({'source':str(p.relative_to(root)),'sourceSha256':hashlib.sha256(p.read_bytes()).hexdigest(),'export':str(target.relative_to(root)),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'family':name})
(out/'manifest.json').write_text(json.dumps({'tool':'fonttools4.60.2/brotli1.2.1','licence':'SIL OFL1.1; see adjacent original notices; derivative family names avoid reserved names','fonts':manifest},indent=2)+'\n')
