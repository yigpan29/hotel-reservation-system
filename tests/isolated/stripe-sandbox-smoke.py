# Real Stripe SANDBOX only. No PAN/CVV or keys are written to reports.
from pathlib import Path
import urllib.request,urllib.error,urllib.parse,http.cookiejar,base64,json,uuid,datetime,sys,argparse
root=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser(description='Opt-in real Stripe sandbox smoke; isolated demo only. No real money.')
parser.add_argument('--base-url',choices=['http://127.0.0.1:55173','http://127.0.0.1:55174'],default='http://127.0.0.1:55173')
parser.add_argument('--env-file',type=Path,default=root/'.env.stripe-test')
parser.add_argument('--confirm-stripe-sandbox',action='store_true')
args=parser.parse_args()
if not args.confirm_stripe_sandbox:parser.error('Explicit --confirm-stripe-sandbox is required')
(root/'.local').mkdir(exist_ok=True)
values={}
for line in args.env_file.read_text(encoding='utf-8-sig').splitlines():
 if '=' in line and not line.lstrip().startswith('#'):
  k,v=line.split('=',1);values[k.strip()]=v.strip().strip('\"\'')
secret=values.get('STRIPE_SECRET_KEY','');assert secret.startswith('sk_test_')
auth='Basic '+base64.b64encode((secret+':').encode()).decode()
client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
origin=args.base_url+'/api'
results=[];successful=[];created=[];method=None
class HttpFailure(Exception):
 def __init__(self,status):self.status=status

def request(opener,url,method='GET',body=None,headers=None):
 req=urllib.request.Request(url,data=body,headers=headers or {},method=method)
 try:
  with opener.open(req,timeout=35) as response:
   raw=response.read();return json.loads(raw) if raw else None
 except urllib.error.HTTPError as error:
  error.read();raise HttpFailure(error.code)
def app(path,body=None,key=None):
 headers={};verb='GET'
 if body is not None:
  verb='POST';csrf=request(client,origin+'/auth/csrf');headers[csrf['headerName']]=csrf['token'];headers['Content-Type']='application/json'
 if key:headers['Idempotency-Key']=key
 return request(client,origin+path,verb,json.dumps(body).encode() if body is not None else None,headers)
def stripe(path,body=None):
 return request(urllib.request.build_opener(),'https://api.stripe.com/v1'+path,'POST' if body is not None else 'GET',urllib.parse.urlencode(body).encode() if body is not None else None,{'Authorization':auth,'Content-Type':'application/x-www-form-urlencoded'})
def check(condition,label):
 if not condition:raise AssertionError(label)
def record(label):results.append({'case':label,'passed':True});print(label+': PASS',flush=True)
def begin(offset,save=False,saved=None,key=None):
 start=datetime.date.today()+datetime.timedelta(days=120+offset+int(user[-4:],16)%1000)
 payload={'roomId':room,'startDate':str(start),'endDate':str(start+datetime.timedelta(days=1)),'saveMethod':save,'paymentMethodId':saved}
 c=app('/checkouts',payload,key or uuid.uuid4().hex);created.append(c['id']);return c,payload
def sync(c):return app('/checkouts/'+c['id']+'/sync',{})
def confirm(c,pm=None):
 v=sync(c);pi=v['clientSecret'].split('_secret_')[0]
 p=stripe('/payment_intents/'+pi);check(p['livemode'] is False,'sandbox-only')
 payload={'return_url':args.base_url+'/checkout/'+c['id']}
 if pm:payload['payment_method']=pm
 return stripe('/payment_intents/'+pi+'/confirm',payload)
try:
 user='stripe-'+uuid.uuid4().hex[:14];password='Synthetic-smoke-123'
 app('/auth/register',{'username':user,'email':user+'@example.invalid','password':password});app('/auth/login',{'username':user,'password':password})
 check(app('/checkouts/config')['enabled'],'checkout-enabled')
 hotel=app('/hotels')[0]['id'];room=app('/hotels/'+str(hotel)+'/rooms')[0]['id']
 key=uuid.uuid4().hex;c,body=begin(0,key=key)
 check(app('/checkouts',body,key)['id']==c['id'],'idempotency')
 check(confirm(c,'pm_card_visa')['status']=='requires_capture','manual-authorization')
 v=sync(c);check(v['stage']=='SUCCEEDED' and v['reservationId'],'first-paid');successful.append(v)
 check(app('/payment-methods')==[],'no-implicit-consent');record('first_checkout_without_save_and_idempotency')
 c,_=begin(2,save=True);confirm(c,'pm_card_visa');v=sync(c)
 check(v['stage']=='SUCCEEDED','saved-first-paid');successful.append(v)
 methods=app('/payment-methods');check(len(methods)==1 and methods[0]['lastFour']=='4242','consented-method-saved');method=methods[0]['id'];record('first_checkout_with_explicit_consent')
 c,_=begin(4,saved=method);check(confirm(c)['status']=='requires_capture','saved-authorization');v=sync(c)
 check(v['stage']=='SUCCEEDED' and v['savedMethod'],'recurrent-paid');successful.append(v);record('recurrent_checkout_real_saved_method')
 c,failed_body=begin(6)
 try:confirm(c,'pm_card_visa_chargeDeclined');raise AssertionError('expected-decline')
 except HttpFailure as error:check(error.status==402,'decline-402')
 v=sync(c);check(v['stage']=='FAILED' and v['reservationId'] is None,'decline-no-reservation')
 replacement=app('/checkouts',failed_body,uuid.uuid4().hex);app('/checkouts/'+replacement['id']+'/cancel',{});record('decline_releases_inventory_without_paid_reservation')
 c,_=begin(8);p=confirm(c,'pm_card_threeDSecure2Required');check(p['status']=='requires_action','3ds-action')
 v=sync(c);check(v['stage']=='PENDING' and v['reservationId'] is None,'3ds-no-early-booking');app('/checkouts/'+c['id']+'/cancel',{});record('3ds_requires_action_without_premature_confirmation')
 for v in successful:
  app('/reservations/'+str(v['reservationId'])+'/cancel',{});refunded=sync(v)
  check(refunded['stage']=='REFUNDED','sandbox-refund')
 record('paid_cancellation_and_verified_refunds')
 app('/payment-methods/'+method+'/revoke',{});check(app('/payment-methods')==[],'revoked-not-listed');record('revoke_saved_method')
 status='passed'
except HttpFailure as error:
 status='failed';results.append({'case':'current_step','passed':False,'http_status':error.status});print('Sandbox smoke stopped: HTTP '+str(error.status),flush=True)
except Exception as error:
 status='failed';results.append({'case':'current_step','passed':False,'error_type':type(error).__name__});print('Sandbox smoke stopped: '+type(error).__name__,flush=True)
finally:
 for checkout_id in created:
  try:app('/checkouts/'+checkout_id+'/cancel',{})
  except Exception:pass
 report={'executed_at_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'mode':'real_stripe_sandbox','status':status,'results':results,'limitations':['API confirmation uses official test PaymentMethod tokens; this is not a Stripe.js browser interaction.','3DS challenge completion and real Stripe webhook delivery are not verified.']}
 (root/'.local/stripe-sandbox-results.json').write_text(json.dumps(report,indent=2)+'\n')
 sys.exit(0 if status=='passed' else 1)
