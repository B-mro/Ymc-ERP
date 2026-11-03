import base64,io,json,os,socket,subprocess,tempfile,time,unittest,urllib.request,urllib.error,zipfile
from pathlib import Path

class SharedAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory()
        with socket.socket() as s:s.bind(('127.0.0.1',0));cls.port=s.getsockname()[1]
        env={**os.environ,'SHIPGRID_DATA_DIR':cls.tmp.name,'SHIPGRID_PORT':str(cls.port),'SHIPGRID_READ_TOKEN':'test-read','SHIPGRID_WRITE_TOKEN':'test-write'}
        cls.proc=subprocess.Popen(['python',str(Path(__file__).resolve().parents[1]/'server/server.py')],env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        for _ in range(50):
            try:
                with urllib.request.urlopen(f'http://127.0.0.1:{cls.port}/api/shared/health',timeout=1):break
            except Exception:time.sleep(.1)
        else:raise RuntimeError('server did not start')
    @classmethod
    def tearDownClass(cls):cls.proc.terminate();cls.proc.wait();cls.tmp.cleanup()
    def req(self,path,method='GET',body=None,token='test-write',rev=None):
        h={'Authorization':'Bearer '+token}
        if rev is not None:h['If-Match']=str(rev)
        if body is not None:h['Content-Type']='application/json'
        req=urllib.request.Request(f'http://127.0.0.1:{self.port}/api/shared'+path,data=json.dumps(body).encode() if body is not None else None,headers=h,method=method)
        try:
            with urllib.request.urlopen(req) as r:return r.status,r.read()
        except urllib.error.HTTPError as e:return e.code,e.read()
    def catalog(self):return json.loads(self.req('/catalog')[1])
    def test_workflow(self):
        self.assertEqual(self.req('/catalog',token='')[0],401)
        c=self.catalog();self.assertEqual(len(c['quotes']),12)
        self.assertEqual(sum(q['carrier']=='ontrac'for q in c['quotes']),6)
        self.assertEqual(self.req('/datasets','PUT',{'customers':[]},token='test-read',rev=c['revision'])[0],403)
        cid={'id':'customer-1','customerId':'00123','customerName':'测试客户'}
        rule={'id':'rule-1','carrier':'ontrac','customerId':'00123','customerName':'测试客户','quoteId':c['quotes'][0]['id']}
        status,raw=self.req('/datasets','PUT',{'customers':[cid],'rules':[rule]},rev=c['revision']);self.assertEqual(status,200)
        now=json.loads(raw);self.assertEqual(now['customers'][0]['customerId'],'00123')
        self.assertEqual(self.req('/datasets','PUT',{'customers':[]},rev=c['revision'])[0],409)
        self.assertEqual(self.req('/rules',token='test-read')[0],200)
        self.assertEqual(self.req('/datasets','PUT',{'rules':[rule,dict(rule,id='rule-2')]},rev=now['revision'])[0],422)
        self.assertEqual(self.catalog()['revision'],now['revision'])
        # Upload valid XLSX container and retrieve its exact bytes from a second client.
        b=io.BytesIO()
        with zipfile.ZipFile(b,'w')as z:z.writestr('[Content_Types].xml','<Types/>');z.writestr('xl/workbook.xml','<workbook/>')
        q={'id':'custom-1','carrier':'fedex','name':'Test Quote','fileName':'test.xlsx','data':base64.b64encode(b.getvalue()).decode()}
        status,raw=self.req('/quotes','POST',q,rev=now['revision']);self.assertEqual(status,200);now=json.loads(raw)
        self.assertEqual(self.req('/quotes/custom-1/file',token='test-read')[1],b.getvalue())
        self.assertNotIn('data',next(x for x in now['quotes']if x['id']=='custom-1'))
        # A metadata-only merge must retain uploaded file contents.
        self.assertEqual(self.req('/datasets','PUT',{'quotes':now['quotes']},rev=now['revision'])[0],200)
        self.assertEqual(self.req('/quotes/custom-1/file',token='test-read')[1],b.getvalue())
        now=self.catalog()
        bad=dict(q,id='evil',data='notbase64')
        self.assertEqual(self.req('/quotes','POST',bad,rev=now['revision'])[0],422)
        bad=dict(q,id='evil',data=None,url='http://127.0.0.1/private')
        self.assertEqual(self.req('/quotes','POST',bad,rev=now['revision'])[0],422)
        # Delete of a quote referenced by a rule must be atomic and rejected.
        self.assertEqual(self.req('/quotes/'+rule['quoteId'],'DELETE',rev=now['revision'])[0],422)
        self.assertEqual(self.catalog()['revision'],now['revision'])
        self.assertEqual(self.req('/quotes/custom-1','DELETE',rev=now['revision'])[0],200)
        self.assertEqual(self.req('/quotes/custom-1/file')[0],404)
        self.assertEqual(len(self.catalog()['quotes']),12)

if __name__=='__main__':unittest.main()
