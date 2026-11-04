"""Read bounded, allowlisted JSONL reports from an untrusted Actions ZIP; never extract."""
import io,json,stat,sys,zipfile
allowed={'application.jsonl','foundation.jsonl','api-integration.jsonl','api-telemetry.jsonl','api-preprod-telemetry.jsonl','preprod-integration.jsonl'}
raw=sys.stdin.buffer.read(2*1024*1024+1)
if len(raw)>2*1024*1024: raise ValueError('ARCHIVE_LIMIT')
result={}
with zipfile.ZipFile(io.BytesIO(raw)) as archive:
    entries=archive.infolist()
    if not entries or len(entries)>8: raise ValueError('ARCHIVE_LIMIT')
    total=0
    for entry in entries:
        if entry.filename not in allowed or entry.filename in result or stat.S_ISLNK(entry.external_attr>>16): raise ValueError('ARCHIVE_PATH')
        total+=entry.file_size
        if entry.file_size>1024*1024 or total>2*1024*1024: raise ValueError('ARCHIVE_LIMIT')
        if entry.file_size>max(1,entry.compress_size)*200: raise ValueError('ARCHIVE_RATIO')
        result[entry.filename]=archive.read(entry).decode('utf-8')
json.dump(result,sys.stdout)
