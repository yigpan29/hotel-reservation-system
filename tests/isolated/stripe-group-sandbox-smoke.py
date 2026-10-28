# Real Stripe group checkout SANDBOX only. No PAN/CVV or keys are written to reports.
from pathlib import Path
import urllib.request,urllib.error,urllib.parse,http.cookiejar,base64,json,uuid,datetime,sys,argparse,time
root=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser(description='Opt-in real Stripe sandbox smoke; isolated demo only. No real money.')
parser.add_argument('--base-url',choices=['http://127.0.0.1:55173','http://127.0.0.1:55177'],default='http://127.0.0.1:55177')
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
def sync(c):return app('/checkouts/'+c['id']+'/sync',{})
def confirm(c,pm=None):
 v=sync(c);pi=v['clientSecret'].split('_secret_')[0]
 p=stripe('/payment_intents/'+pi);check(p['livemode'] is False,'sandbox-only')
 payload={'return_url':args.base_url+'/checkout/'+c['id']}
 if pm:payload['payment_method']=pm
 return stripe('/payment_intents/'+pi+'/confirm',payload)

def begin(offset,save=False,saved=None,key=None):
 start=datetime.date.today()+datetime.timedelta(days=200+offset+int(user[-4:],16)%40)
 body={'hotelId':hotel,'rooms':chosen,'startDate':str(start),'endDate':str(start+datetime.timedelta(days=2)),'saveMethod':save,'paymentMethodId':saved}
 c=app('/checkouts/group',body,key or uuid.uuid4().hex);created.append(c['id']);return c,body

def settled(c,expected='SUCCEEDED'):
 for attempt in range(20):
  try:v=sync(c)
  except HttpFailure as error:
   if error.status==503 and attempt<19:time.sleep(.5);continue
   raise
  if v['stage']==expected:return v
  time.sleep(.5)
 raise AssertionError('expected-'+expected)

def paid(c,pm=None,webhook=False):
 p=confirm(c,pm);check(p['status'] in ['requires_capture','succeeded'],'authorization')
 if webhook:
  # The demo's recovery worker is disabled for this check. GET never captures.
  for attempt in range(30):
   v=next(item for item in app('/checkouts/me') if item['id']==c['id'])
   if v['stage']=='SUCCEEDED':break
   time.sleep(.5)
  check(v['stage']=='SUCCEEDED','webhook-captured-group')
 else:v=settled(c)
 check(len(v['items'])==2 and all(item['reservationId'] for item in v['items']),'all-rooms-confirmed')
 successful.append(v);return v

def provider_refunds(c):
 # No client secret or card details are written to the report.
 p=stripe('/payment_intents/'+intent_ids[c['id']])
 check(p['livemode'] is False and p['amount_received']==c['amountCents'],'captured-total')
 return stripe('/refunds?'+urllib.parse.urlencode({'payment_intent':p['id'],'limit':100}))['data']

intent_ids={}
original_confirm=confirm
def confirm(c,pm=None):
 v=sync(c);intent_ids[c['id']]=v['clientSecret'].split('_secret_')[0]
 return original_confirm(c,pm)

try:
 # Wait for the isolated backend after its optional Stripe-overlay recreation.
 for attempt in range(30):
  try:app('/health');break
  except (HttpFailure,urllib.error.URLError):
   if attempt==29:raise
   time.sleep(1)
 user='stripe-group-'+uuid.uuid4().hex[:12];password='Synthetic-smoke-123'
 app('/auth/register',{'username':user,'email':user+'@example.invalid','password':password});app('/auth/login',{'username':user,'password':password})
 check(app('/checkouts/config')['enabled'],'checkout-enabled')
 hotel=app('/hotels')[0]['id'];available=app('/hotels/'+str(hotel)+'/rooms')
 check(len(available)>=2,'two-rooms-required')
 chosen=[{'type':r['type'],'adults':1,'children':0} for r in available[:2]]
 key=uuid.uuid4().hex;c,body=begin(0,key=key)
 check(app('/checkouts/group',body,key)['id']==c['id'],'idempotency')
 first=paid(c,'pm_card_visa',webhook=True)
 check(app('/payment-methods')==[],'no-implicit-consent');record('one_payment_two_rooms_idempotency_and_real_webhook_confirmation')
 c,_=begin(3,save=True);saved_order=paid(c,'pm_card_visa')
 methods=app('/payment-methods');check(len(methods)==1 and methods[0]['lastFour']=='4242','consented-method')
 method=methods[0]['id'];record('group_checkout_explicit_consent_and_saved_method')
 c,_=begin(6,saved=method);recurrent=paid(c)
 check(recurrent['savedMethod'],'recurrent-uses-local-authorized-method');record('recurrent_group_checkout_without_new_card')
 room0,room1=first['items']
 app('/reservations/'+str(room0['reservationId'])+'/cancel',{})
 partial=settled(first)
 check(partial['items'][0]['refundState']=='SUCCEEDED' and partial['items'][1]['refundState']=='NONE','only-first-refunded')
 check(app('/reservations/'+str(room1['reservationId']))['status']=='CONFIRMED','second-room-remains-confirmed')
 actual=provider_refunds(first)
 check(len(actual)==1 and actual[0]['amount']==room0['amountCents'] and actual[0]['status']=='succeeded','provider-partial-amount')
 app('/reservations/'+str(room0['reservationId'])+'/cancel',{});settled(first)
 check(len(provider_refunds(first))==1,'repeat-cancel-no-new-refund');record('partial_refund_exact_amount_keeps_other_room_and_is_idempotent')
 app('/reservations/'+str(room1['reservationId'])+'/cancel',{});settled(first,'REFUNDED')
 actual=provider_refunds(first);check(len(actual)==2 and sum(r['amount'] for r in actual)==first['amountCents'],'sum-refunds-equals-capture');record('remaining_room_refunded_without_exceeding_single_payment')
 c,failed_body=begin(9)
 try:confirm(c,'pm_card_visa_chargeDeclined');raise AssertionError('expected-decline')
 except HttpFailure as error:check(error.status==402,'decline-402')
 failed=settled(c,'FAILED');check(all(i['reservationId'] is None for i in failed['items']),'decline-no-reservations')
 replacement=app('/checkouts/group',failed_body,uuid.uuid4().hex);created.append(replacement['id']);app('/checkouts/'+replacement['id']+'/cancel',{});record('declined_group_payment_releases_all_rooms')
 c,_=begin(12);check(confirm(c,'pm_card_threeDSecure2Required')['status']=='requires_action','3ds-action')
 pending=sync(c);check(pending['stage']=='PENDING' and all(i['reservationId'] is None for i in pending['items']),'no-premature-group-booking');app('/checkouts/'+c['id']+'/cancel',{});record('3ds_requires_action_without_partial_confirmation')
 for order in [saved_order,recurrent]:
  for item in order['items']:app('/reservations/'+str(item['reservationId'])+'/cancel',{})
  settled(order,'REFUNDED')
  actual=provider_refunds(order);check(sum(r['amount'] for r in actual)==order['amountCents'],'remaining-test-payments-refunded')
 record('all_three_test_payments_fully_refunded_per_room')
 app('/payment-methods/'+method+'/revoke',{});check(app('/payment-methods')==[],'revoked-not-listed');record('saved_method_revocation')
 status='passed'
except HttpFailure as error:
 status='failed';results.append({'case':'current_step','passed':False,'http_status':error.status});print('Sandbox group smoke stopped: HTTP '+str(error.status),flush=True)
except Exception as error:
 status='failed';results.append({'case':'current_step','passed':False,'error_type':type(error).__name__});print('Sandbox group smoke stopped: '+type(error).__name__,flush=True)
finally:
 cleanup_errors=0
 for checkout_id in created:
  try:
   current=sync({'id':checkout_id})
   if current['stage']=='SUCCEEDED':
    for item in current['items']:
     if item['reservationId']:app('/reservations/'+str(item['reservationId'])+'/cancel',{})
    settled(current,'REFUNDED')
   elif current['stage'] in ['PENDING','CANCEL_REQUESTED']:app('/checkouts/'+checkout_id+'/cancel',{})
  except Exception:cleanup_errors+=1
 report={'executed_at_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'mode':'real_stripe_sandbox_group','status':status,'results':results,'cleanup_errors':cleanup_errors,'limitations':['3DS challenge completion is not verified.','Card confirmation uses official test PaymentMethod tokens by API; Stripe.js browser completion is not asserted.','Real webhook confirmation requires the isolated demo recovery worker to be disabled for this test.']}
 (root/'.local/stripe-group-sandbox-results.json').write_text(json.dumps(report,indent=2)+'\n')
 sys.exit(0 if status=='passed' and cleanup_errors==0 else 1)
