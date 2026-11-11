"""ShipGrid shared quote/customer API. Python 3.10+, standard library only."""
import base64
import hashlib
import hmac
import io
import json
import os
from pathlib import Path
import re
import sqlite3
import threading
import urllib.parse
import urllib.request
import zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = Path(__file__).resolve().parent.parent
DATA = Path(os.environ.get('SHIPGRID_DATA_DIR', str(ROOT / 'data')))
MAX_FILE = 20 * 1024 * 1024
MAX_BODY = 100 * 1024 * 1024
FILENAMES = ['OnTrac2026D.xlsx', 'ONTRAC_RATE_D.xlsx', 'Fedex_2026C_CD.xlsx', 'FEDEX_2026A.xlsx', 'ONTRAC_RATE_C.xlsx', 'FEDEX_2026B_SD.xlsx', 'ONTRAC_RATE_A.xlsx', 'Fedex_2026D.xlsx', 'OnTrac_2026B.xlsx', 'ONTRAC_RATE_B.xlsx', 'FEDEX_2026B.xlsx', 'Fedex_2026C.xlsx']
SOURCES = {'http://121.43.236.24/excel_files/' + n for n in FILENAMES}
LOCK = threading.RLock()

class APIError(Exception):
    def __init__(self, status, message):
        self.status, self.message = status, message

def norm(value):
    import unicodedata
    return unicodedata.normalize('NFKC', str(value or '')).strip().lower()

def seed_quotes():
    return [dict(id='fixed-' + hashlib.sha256(n.encode()).hexdigest()[:16], carrier='ontrac' if 'ontrac' in n.lower() else 'fedex', name=n.rsplit('.', 1)[0], fileName=n, url='http://121.43.236.24/excel_files/' + n, updatedAt='', source='fixed-link') for n in FILENAMES]

def connect():
    DATA.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(DATA / 'shared.sqlite3', timeout=30)
    c.execute('PRAGMA journal_mode=WAL')
    c.execute('CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, document TEXT NOT NULL)')
    c.execute('INSERT OR IGNORE INTO state VALUES (1,0,?)', (json.dumps(dict(quotes=seed_quotes(), customers=[], rules=[])),))
    c.commit()
    return c

def load():
    with connect() as c:
        rev, raw = c.execute('SELECT revision,document FROM state WHERE id=1').fetchone()
    return rev, json.loads(raw)

def public_snapshot(rev, doc):
    return dict(revision=rev, quotes=[dict({k:v for k,v in q.items() if k != 'data'}, hasData=bool(q.get('data') or q.get('url'))) for q in doc['quotes']], rules=doc['rules'], customers=doc['customers'])

def validate_xlsx(encoded):
    try:
        raw = base64.b64decode(encoded, validate=True)
        if len(raw) > MAX_FILE:
            raise ValueError('报价文件超过20MB')
        with zipfile.ZipFile(io.BytesIO(raw)) as z:
            if len(z.infolist()) > 10000 or sum(i.file_size for i in z.infolist()) > 200 * 1024 * 1024:
                raise ValueError('Excel解压后过大')
            if '[Content_Types].xml' not in z.namelist() or 'xl/workbook.xml' not in z.namelist():
                raise ValueError('文件不是有效的xlsx工作簿')
            if any('vbaproject' in n.lower() for n in z.namelist()):
                raise ValueError('不接受含宏文件')
            if z.testzip():
                raise ValueError('Excel文件已损坏')
        return raw
    except (ValueError, TypeError, zipfile.BadZipFile) as e:
        raise APIError(422, '报价文件校验失败：' + str(e))

def validate(doc):
    for name in ['quotes', 'customers', 'rules']:
        rows = doc.get(name)
        if not isinstance(rows, list) or len(rows) > 10000:
            raise APIError(422, name + '格式错误或记录过多')
        ids = [r.get('id') for r in rows if isinstance(r, dict)]
        if len(ids) != len(rows) or any(not isinstance(i,str) or not re.fullmatch(r'[A-Za-z0-9_.-]{1,150}',i) for i in ids) or len(set(ids)) != len(ids):
            raise APIError(422, name + '存在无效或重复记录ID')
    quotes = {q['id']:q for q in doc['quotes']}
    for q in quotes.values():
        if q.get('carrier') not in ['ups','fedex','ontrac'] or not str(q.get('name','')).strip():
            raise APIError(422, '报价缺少承运商或名称')
        if q.get('url') and q['url'] not in SOURCES:
            raise APIError(422, '远程文件地址不在已授权固定清单中')
        if q.get('data'):
            validate_xlsx(q['data'])
    customer_ids, customer_names = set(), set()
    for c in doc['customers']:
        cid, name = norm(c.get('customerId')), norm(c.get('customerName'))
        if not cid or not name or cid in customer_ids or name in customer_names:
            raise APIError(422, '客户ID/名称为空或重复')
        customer_ids.add(cid); customer_names.add(name)
    keys = set()
    for r in doc['rules']:
        q = quotes.get(r.get('quoteId'))
        if not q or q['carrier'] != r.get('carrier') or not(q.get('data') or q.get('url')):
            raise APIError(422, '客户匹配引用了不存在或承运商不一致的报价')
        if not norm(r.get('customerId')) and not norm(r.get('customerName')):
            raise APIError(422, '客户匹配缺少客户ID/名称')
        for field in ['customerId','customerName']:
            if not norm(r.get(field)): continue
            key=(r['carrier'],field,norm(r[field]))
            if key in keys: raise APIError(422,'同承运商客户匹配重复')
            keys.add(key)
        found=[c for c in doc['customers'] if (r.get('customerId') and norm(c['customerId'])==norm(r['customerId'])) or (r.get('customerName') and norm(c['customerName'])==norm(r['customerName']))]
        if found and any((r.get('customerId') and norm(c['customerId'])!=norm(r['customerId'])) or (r.get('customerName') and norm(c['customerName'])!=norm(r['customerName'])) for c in found):
            raise APIError(422,'匹配规则中的客户ID与名称不一致')

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise APIError(502,'固定文件返回重定向，未下载；请管理员核实源地址')

class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        # Never log request headers, body or tokens.
        print(self.command, urllib.parse.urlsplit(self.path).path, flush=True)

    def cors(self):
        origin=self.headers.get('Origin')
        allowed=[x.strip() for x in os.environ.get('SHIPGRID_ALLOWED_ORIGINS','').split(',') if x.strip()]
        if origin and origin in allowed:
            self.send_header('Access-Control-Allow-Origin',origin)
            self.send_header('Vary','Origin')
            self.send_header('Access-Control-Allow-Headers','Authorization,Content-Type,If-Match')
            self.send_header('Access-Control-Allow-Methods','GET,PUT,POST,DELETE,OPTIONS')

    def send(self,status,body,ctype='application/json; charset=utf-8',extra=None):
        raw=json.dumps(body,ensure_ascii=False).encode() if isinstance(body,(dict,list)) else body
        self.send_response(status);self.cors();self.send_header('Content-Type',ctype)
        self.send_header('Content-Length',str(len(raw)));self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff')
        for k,v in (extra or {}).items(): self.send_header(k,v)
        self.end_headers();self.wfile.write(raw)

    def auth(self,write=False):
        read=os.environ.get('SHIPGRID_READ_TOKEN','');admin=os.environ.get('SHIPGRID_WRITE_TOKEN','')
        token=self.headers.get('Authorization','').removeprefix('Bearer ')
        if admin and hmac.compare_digest(token,admin): return
        if not write and read and hmac.compare_digest(token,read): return
        raise APIError(403 if write else 401,'没有写入权限' if write else '请输入共享访问凭证')

    def body(self):
        length=int(self.headers.get('Content-Length','0'))
        if length<=0 or length>MAX_BODY: raise APIError(413,'请求为空或超过100MB；请分批上传')
        self.connection.settimeout(60)
        try:
            raw=self.rfile.read(length)
            obj=json.loads(raw)
            if not isinstance(obj,dict): raise ValueError('object required')
            return obj
        except (ValueError,UnicodeError):raise APIError(400,'JSON格式无效')

    def do_OPTIONS(self):self.send(204,b'')
    def do_GET(self):self.dispatch()
    def do_PUT(self):self.dispatch()
    def do_POST(self):self.dispatch()
    def do_DELETE(self):self.dispatch()

    def dispatch(self):
        try:self.route()
        except APIError as e:self.send(e.status,{'error':e.message})
        except (BrokenPipeError,ConnectionResetError):pass
        except Exception as e:
            print(type(e).__name__,flush=True)
            self.send(500,{'error':'服务器处理失败，请查看服务器日志'})

    def route(self):
        path=urllib.parse.urlsplit(self.path).path.rstrip('/')
        if self.command=='GET' and path in ['', '/index.html']:
            return self.send(200,(ROOT/'index.html').read_bytes(),'text/html; charset=utf-8')
        if path=='/api/shared/health' and self.command=='GET':return self.send(200,{'ok':True,'version':'3.51'})
        if not path.startswith('/api/shared/'):raise APIError(404,'接口不存在')
        write=self.command!='GET';self.auth(write)
        if self.command=='GET' and path in ['/api/shared/catalog','/api/shared/customers','/api/shared/rules']:
            rev,doc=load()
            if path.endswith('/catalog'):return self.send(200,public_snapshot(rev,doc))
            name=path.rsplit('/',1)[1];return self.send(200,{'revision':rev,'items':doc[name]})
        match=re.fullmatch(r'/api/shared/quotes/([A-Za-z0-9_.-]+)/file',path)
        if self.command=='GET' and match:
            rev,doc=load();q=next((q for q in doc['quotes'] if q['id']==match[1]),None)
            if not q:raise APIError(404,'报价不存在')
            if q.get('data'):raw=base64.b64decode(q['data'])
            elif q.get('url') in SOURCES:
                try:
                    opener=urllib.request.build_opener(NoRedirect())
                    with opener.open(q['url'],timeout=25) as response:raw=response.read(MAX_FILE+1)
                    validate_xlsx(base64.b64encode(raw).decode())
                except APIError:raise
                except Exception:raise APIError(502,'源文件下载失败，请稍后重试')
            else:raise APIError(404,'报价没有文件')
            filename=urllib.parse.quote(q.get('fileName') or 'quote.xlsx')
            return self.send(200,raw,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',{'Content-Disposition':"attachment; filename*=UTF-8''"+filename})
        if not write:raise APIError(404,'接口不存在')
        body=self.body() if self.command in ['PUT','POST'] else {}
        with LOCK:
            rev,doc=load()
            if self.headers.get('If-Match')!=str(rev):raise APIError(409,'共享数据已被其他同事更新，请刷新后重试；未覆盖服务器数据')
            if path=='/api/shared/datasets' and self.command=='PUT':
                if not body or set(body)-{'quotes','customers','rules'}:raise APIError(422,'datasets只接受quotes/customers/rules')
                if 'quotes' in body and isinstance(body['quotes'],list):
                    previous={q['id']:q for q in doc['quotes']}
                    body['quotes']=[dict(q,**({'data':previous[q['id']]['data']} if isinstance(q,dict) and q.get('id') in previous and not q.get('data') and not q.get('url') and previous[q['id']].get('data') else {})) for q in body['quotes']]
                doc.update(body)
            elif path=='/api/shared/quotes' and self.command=='POST':
                q=body
                if any(x['id']==q.get('id') for x in doc['quotes']):raise APIError(409,'报价ID已存在')
                doc['quotes'].append(q)
            elif (m:=re.fullmatch(r'/api/shared/quotes/([A-Za-z0-9_.-]+)',path)) and self.command in ['PUT','DELETE']:
                if not any(q['id']==m[1] for q in doc['quotes']):raise APIError(404,'报价不存在')
                if self.command=='DELETE':doc['quotes']=[q for q in doc['quotes'] if q['id']!=m[1]]
                else:
                    if body.get('id')!=m[1]:raise APIError(422,'报价ID不一致')
                    doc['quotes']=[body if q['id']==m[1] else q for q in doc['quotes']]
            elif path in ['/api/shared/customers','/api/shared/rules'] and self.command=='PUT':doc[path.rsplit('/',1)[1]]=body.get('items')
            else:raise APIError(404,'接口不存在')
            validate(doc)
            with connect() as c:
                cursor=c.execute('UPDATE state SET revision=?,document=? WHERE id=1 AND revision=?',(rev+1,json.dumps(doc,ensure_ascii=False),rev))
                if cursor.rowcount!=1:raise APIError(409,'并发修改，请刷新后重试')
            return self.send(200,public_snapshot(rev+1,doc))

def main():
    if not os.environ.get('SHIPGRID_READ_TOKEN') or not os.environ.get('SHIPGRID_WRITE_TOKEN'):
        raise SystemExit('请设置SHIPGRID_READ_TOKEN及SHIPGRID_WRITE_TOKEN；勿使用相同值')
    if os.environ['SHIPGRID_READ_TOKEN']==os.environ['SHIPGRID_WRITE_TOKEN']:
        raise SystemExit('读写凭证必须不同')
    connect().close()
    server=ThreadingHTTPServer((os.environ.get('SHIPGRID_BIND','127.0.0.1'),int(os.environ.get('SHIPGRID_PORT','8088'))),Handler)
    print('ShipGrid shared billing ready',server.server_address,flush=True)
    server.serve_forever()

if __name__=='__main__':main()
