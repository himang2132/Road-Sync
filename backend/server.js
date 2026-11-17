const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const app = express();
const PORT = process.env.PORT || 4000;
const DB_FILE = path.join(__dirname,'..','database','db.json');
const FRONTEND_DIR = path.join(__dirname,'..','frontend');
function readDB(){ return JSON.parse(fs.readFileSync(DB_FILE,'utf8')); }
function writeDB(db){ fs.writeFileSync(DB_FILE,JSON.stringify(db,null,2)); }
function id(prefix){return prefix+'-'+crypto.randomBytes(3).toString('hex').toUpperCase();}
function audit(db, actor, action, details=''){db.audit.unshift({id:id('AU'),actor,action,details,at:new Date().toISOString()});db.audit=db.audit.slice(0,300);}
app.use(express.json());
app.use(session({secret:process.env.SESSION_SECRET||'roadsync-local-demo-change-this-secret',resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:'lax',secure:false,maxAge:8*60*60*1000}}));
app.use(express.static(FRONTEND_DIR));
function auth(req,res,next){if(!req.session.user)return res.status(401).json({error:'Please sign in again.'});next();}
function admin(req,res,next){if(!req.session.user||req.session.user.role!=='admin')return res.status(403).json({error:'Administrator access required.'});next();}
function overlap(aStart,aEnd,bStart,bEnd){return new Date(aStart)<new Date(bEnd)&&new Date(bStart)<new Date(aEnd);}
function segmentOf(db,segmentId){return db.segments.find(s=>s.id===segmentId);}
function conflictFor(db, request, excludeId=null){return db.requests.filter(r=>r.id!==excludeId&&r.segmentId===request.segmentId&&r.status==='approved'&&r.assignedStart&&r.assignedEnd&&overlap(request.start,request.end,r.assignedStart,r.assignedEnd));}
function addNotification(db,department,title,message,requestId=null){db.notifications.unshift({id:id('NT'),department,title,message,requestId,createdAt:new Date().toISOString(),read:false});}
app.get('/api/health',(req,res)=>res.json({ok:true,app:'RoadSync',time:new Date().toISOString()}));
app.post('/api/login',(req,res)=>{const {email,password}=req.body||{};const db=readDB();const user=db.users.find(u=>u.email.toLowerCase()===String(email||'').toLowerCase());if(!user||!bcrypt.compareSync(String(password||''),user.password))return res.status(401).json({error:'Invalid email or password.'});req.session.user={id:user.id,name:user.name,email:user.email,role:user.role,department:user.department};audit(db,user.email,'LOGIN','Signed in');writeDB(db);res.json({user:req.session.user});});
app.post('/api/logout',auth,(req,res)=>{const db=readDB();audit(db,req.session.user.email,'LOGOUT','Signed out');writeDB(db);req.session.destroy(()=>res.json({ok:true}));});
app.get('/api/me',auth,(req,res)=>res.json({user:req.session.user}));
app.get('/api/dashboard',auth,(req,res)=>{const db=readDB();const mine=req.session.user.role==='admin'?db.requests:db.requests.filter(r=>r.department===req.session.user.department);res.json({user:req.session.user,requests:mine,segments:db.segments,notifications:db.notifications.filter(n=>n.department==='All'||n.department===req.session.user.department),settings:db.settings,stats:{total:mine.length,pending:mine.filter(r=>r.status==='pending').length,approved:mine.filter(r=>r.status==='approved').length,conflicts:mine.filter(r=>r.conflict).length}})});
app.get('/api/requests',auth,(req,res)=>{const db=readDB();let list=req.session.user.role==='admin'?db.requests:db.requests.filter(r=>r.department===req.session.user.department);res.json(list)});
app.post('/api/requests',auth,(req,res)=>{if(req.session.user.role!=='department')return res.status(403).json({error:'Only departments can submit requests.'});const {segmentId,title,workType,description,start,end,deadline,priority='Medium'}=req.body||{};if(!segmentId||!title||!start||!end||!deadline)return res.status(400).json({error:'Please fill all required fields.'});if(new Date(start)>=new Date(end))return res.status(400).json({error:'End time must be after start time.'});const db=readDB();const segment=segmentOf(db,segmentId);if(!segment)return res.status(400).json({error:'Select a valid road segment.'});const now=new Date();if(segment.collectionWindowEnd&&now>new Date(segment.collectionWindowEnd))return res.status(409).json({error:`The department collection window for ${segment.name} has closed. Contact the administrator to reopen coordination for this segment.`});if(!segment.collectionWindowStart){segment.collectionWindowStart=now.toISOString();segment.collectionWindowEnd=new Date(now.getTime()+Number(db.settings.collectionDays||30)*86400000).toISOString();for(const dept of ['Electricity','Water Supply','Telecom','Public Works'])addNotification(db,dept,'New road-work coordination window',`A first request has been received for ${segment.name} (${segment.id}). Submit related work requests by ${new Date(segment.collectionWindowEnd).toLocaleString()}. The collection window is ${db.settings.collectionDays} days.`,null);}if(segment.restricted&&segment.restrictionEnd&&new Date(segment.restrictionEnd)>new Date(start))return res.status(409).json({error:`This segment is restricted until ${new Date(segment.restrictionEnd).toLocaleString()}.`});if(segment.cooldownEnd&&new Date(segment.cooldownEnd)>new Date(start))return res.status(409).json({error:`Cooldown is active until ${new Date(segment.cooldownEnd).toLocaleString()}.`});const request={id:id('RS'),department:req.session.user.department,createdBy:req.session.user.id,segmentId,title:String(title).trim(),workType:workType||'Maintenance',description:description||'',start:new Date(start).toISOString(),end:new Date(end).toISOString(),deadline:new Date(deadline).toISOString(),priority:['Low','Medium','High','Emergency'].includes(priority)?priority:'Medium',status:'pending',assignedStart:null,assignedEnd:null,mergeGroup:null,createdAt:new Date().toISOString(),actualCompletion:null};db.requests.unshift(request);audit(db,req.session.user.email,'REQUEST_SUBMITTED',request.id+' / '+segmentId);addNotification(db,'Administration','New road-work request',`${request.department} submitted ${request.title} for ${segment.name}.`,request.id);writeDB(db);res.status(201).json({request});});
app.get('/api/calendar',auth,(req,res)=>{const db=readDB();const requests=db.requests.filter(r=>(req.session.user.role==='admin'||r.status==='approved'||r.department===req.session.user.department));const events=requests.filter(r=>r.status==='approved'&&r.assignedStart).map(r=>({id:r.id,title:r.title,department:r.department,segmentId:r.segmentId,start:r.assignedStart,end:r.assignedEnd,status:r.status,priority:r.priority,kind:'work'}));db.segments.filter(s=>s.restricted&&s.restrictionStart&&s.restrictionEnd).forEach(s=>events.push({id:'restriction-'+s.id,title:'Restriction: '+s.name,department:'Administration',segmentId:s.id,start:s.restrictionStart,end:s.restrictionEnd,status:'restricted',kind:'restriction'}));db.segments.filter(s=>s.cooldownStart&&s.cooldownEnd&&new Date(s.cooldownEnd)>new Date()).forEach(s=>events.push({id:'cooldown-'+s.id,title:'Cooldown: '+s.name,department:'Administration',segmentId:s.id,start:s.cooldownStart,end:s.cooldownEnd,status:'cooldown',kind:'cooldown'}));res.json(events)});
app.get('/api/notifications',auth,(req,res)=>{const db=readDB();res.json(db.notifications.filter(n=>n.department==='All'||n.department===req.session.user.department||req.session.user.role==='admin'))});
app.post('/api/notifications/:id/read',auth,(req,res)=>{const db=readDB();const n=db.notifications.find(n=>n.id===req.params.id&&(req.session.user.role==='admin'||n.department==='All'||n.department===req.session.user.department));if(!n)return res.status(404).json({error:'Notification not found.'});n.read=true;writeDB(db);res.json({ok:true})});
app.get('/api/admin/overview',admin,(req,res)=>{const db=readDB();res.json({requests:db.requests,segments:db.segments,users:db.users.map(({password,...u})=>u),notifications:db.notifications,settings:db.settings,audit:db.audit})});
app.post('/api/admin/settings',admin,(req,res)=>{const db=readDB();const {collectionDays,restrictionDays,cooldownDays}=req.body||{};for(const [key,val] of Object.entries({collectionDays,restrictionDays,cooldownDays})){if(val!==undefined){const n=Number(val);if(!Number.isInteger(n)||n<1||n>365)return res.status(400).json({error:'Days must be a whole number from 1 to 365.'});db.settings[key]=n;}}audit(db,req.session.user.email,'SETTINGS_UPDATED',JSON.stringify(db.settings));writeDB(db);res.json({settings:db.settings})});
app.post('/api/admin/segments',admin,(req,res)=>{const {name,area,description}=req.body||{};if(!name||!area)return res.status(400).json({error:'Road name and area are required.'});const db=readDB();const segment={id:id('RD'),name:String(name).trim(),area:String(area).trim(),description:description||'',restrictionStart:null,restrictionEnd:null,restricted:false,cooldownDays:db.settings.cooldownDays};db.segments.push(segment);audit(db,req.session.user.email,'SEGMENT_CREATED',segment.id+' '+segment.name);writeDB(db);res.status(201).json({segment})});
app.post('/api/admin/segments/:id/restrict',admin,(req,res)=>{const {start,end,restricted=true}=req.body||{};if(!start||!end||new Date(start)>=new Date(end))return res.status(400).json({error:'Provide a valid restriction start and end.'});const db=readDB();const s=segmentOf(db,req.params.id);if(!s)return res.status(404).json({error:'Road segment not found.'});s.restricted=Boolean(restricted);s.restrictionStart=new Date(start).toISOString();s.restrictionEnd=new Date(end).toISOString();if(s.restricted){for(const dept of ['Electricity','Water Supply','Telecom','Public Works'])addNotification(db,dept,'Road restriction notice',`${s.name} (${s.id}) is restricted from ${new Date(start).toLocaleString()} to ${new Date(end).toLocaleString()}. Plan your work before the restriction window.`);}audit(db,req.session.user.email,'SEGMENT_RESTRICTION',s.id+' until '+s.restrictionEnd);writeDB(db);res.json({segment:s})});
app.post('/api/admin/requests/:id/schedule',admin,(req,res)=>{const {action,start,end,note='',mergeWith=null}=req.body||{};const db=readDB();const r=db.requests.find(x=>x.id===req.params.id);if(!r)return res.status(404).json({error:'Request not found.'});
if (action === 'reject') {

    if (r.status !== 'pending') {
        return res.status(400).json({
            error: 'Only pending requests can be rejected.'
        });
    }

    const reason = String(note || '').trim();

    if (!reason) {
        return res.status(400).json({
            error: 'A rejection reason is required.'
        });
    }

    r.status = 'rejected';
    r.adminNote = reason;

    r.rejectedAt = new Date().toISOString();
    r.rejectedBy = req.session.user.email;

    addNotification(
        db,
        r.department,
        'Request rejected',
        `${r.id}: ${reason}`,
        r.id
    );

    audit(
        db,
        req.session.user.email,
        'REQUEST_REJECTED',
        `${r.id}: ${reason}`
    );

    writeDB(db);

    return res.json({
        success: true,
        request: r
    });
}
if(action==='merge'){const other=db.requests.find(x=>x.id===mergeWith);if(!other||other.id===r.id||other.segmentId!==r.segmentId||other.status==='rejected')return res.status(400).json({error:'Merge proposal requires another active request on the same road segment.'});const group=r.mergeGroup||other.mergeGroup||id('MG');r.mergeGroup=group;other.mergeGroup=group;r.adminNote='Joint-work proposal: '+other.id;other.adminNote='Joint-work proposal: '+r.id;addNotification(db,r.department,'Joint-work proposal',`${r.id} may be coordinated with ${other.department}'s ${other.id}. Administration will confirm the shared slot.`,r.id);addNotification(db,other.department,'Joint-work proposal',`${other.id} may be coordinated with ${r.department}'s ${r.id}.`,other.id);audit(db,req.session.user.email,'MERGE_PROPOSED',r.id+' + '+other.id);writeDB(db);return res.json({request:r,mergeGroup:group})}if(action!=='approve')return res.status(400).json({error:'Choose approve, reject or merge.'});const startValue=start||r.start,endValue=end||r.end;if(new Date(startValue)>=new Date(endValue))return res.status(400).json({error:'Assigned end must be after start.'});const segment=segmentOf(db,r.segmentId);if(segment.restricted&&segment.restrictionEnd&&new Date(segment.restrictionEnd)>new Date(startValue))return res.status(409).json({error:'This road segment is restricted during the selected time.'});if(segment.cooldownEnd&&new Date(segment.cooldownEnd)>new Date(startValue))return res.status(409).json({error:'This road segment is in cooldown during the selected time.'});const candidate={...r,start:new Date(startValue).toISOString(),end:new Date(endValue).toISOString()};const conflicts=conflictFor(db,candidate,r.id);if(conflicts.length)return res.status(409).json({error:'Scheduling conflict with '+conflicts.map(x=>x.id+' ('+x.department+')').join(', ')+'. Try another time or propose a merge.',conflicts});r.status='approved';r.assignedStart=candidate.start;r.assignedEnd=candidate.end;r.adminNote=note;addNotification(db,r.department,'Request approved',`${r.id} is scheduled for ${new Date(r.assignedStart).toLocaleString()} – ${new Date(r.assignedEnd).toLocaleString()}.`,r.id);audit(db,req.session.user.email,'REQUEST_APPROVED',r.id+' at '+r.assignedStart);writeDB(db);res.json({request:r})});
app.post('/api/admin/requests/:id/complete',admin,(req,res)=>{const db=readDB();const r=db.requests.find(x=>x.id===req.params.id);if(!r)return res.status(404).json({error:'Request not found.'});if(r.status!=='approved')return res.status(400).json({error:'Only approved work can be marked complete.'});const completedAt=new Date().toISOString();r.status='completed';r.actualCompletion=completedAt;const s=segmentOf(db,r.segmentId);const days=Number(s.cooldownDays||db.settings.cooldownDays);s.cooldownStart=completedAt;s.cooldownEnd=new Date(Date.now()+days*86400000).toISOString();addNotification(db,r.department,'Work marked complete',`${r.id} is complete. Cooldown on ${s.name} remains active until ${new Date(s.cooldownEnd).toLocaleString()}.`,r.id);audit(db,req.session.user.email,'WORK_COMPLETED',r.id+'; cooldown '+days+' days');writeDB(db);res.json({request:r,segment:s})});
app.post('/api/admin/schedule-auto',admin,(req,res)=>{const db=readDB();const rank={Emergency:0,High:1,Medium:2,Low:3};const queue=db.requests.filter(r=>r.status==='pending').sort((a,b)=>new Date(a.deadline)-new Date(b.deadline)||(rank[a.priority]-rank[b.priority])||new Date(a.createdAt)-new Date(b.createdAt));const results=[];for(const r of queue){const s=segmentOf(db,r.segmentId);if(s.restricted&&s.restrictionEnd&&new Date(s.restrictionEnd)>new Date(r.start)){results.push({id:r.id,result:'blocked',reason:'Restriction window'});continue;}if(s.cooldownEnd&&new Date(s.cooldownEnd)>new Date(r.start)){results.push({id:r.id,result:'blocked',reason:'Cooldown'});continue;}const duration=new Date(r.end)-new Date(r.start);let candidateStart=new Date(r.start),placed=false;for(let tries=0;tries<45;tries++){const candidateEnd=new Date(candidateStart.getTime()+duration);const candidate={...r,start:candidateStart.toISOString(),end:candidateEnd.toISOString()};const conflicts=conflictFor(db,candidate,r.id);if(!conflicts.length){r.status='approved';r.assignedStart=candidate.start;r.assignedEnd=candidate.end;r.adminNote='Auto-scheduled by deadline/priority policy.';addNotification(db,r.department,'Request scheduled',`${r.id} has been scheduled for ${candidateStart.toLocaleString()}.`,r.id);results.push({id:r.id,result:'scheduled',start:r.assignedStart});placed=true;break;}candidateStart=new Date(Math.max(...conflicts.map(c=>new Date(c.assignedEnd).getTime())));}if(!placed)results.push({id:r.id,result:'waiting',reason:'No compatible slot found in search window'});}audit(db,req.session.user.email,'AUTO_SCHEDULE','Processed '+queue.length+' pending requests');writeDB(db);res.json({results})});
app.get('*',(req,res)=>res.sendFile(path.join(FRONTEND_DIR,'index.html')));
app.listen(PORT,()=>console.log(`RoadSync running at http://localhost:${PORT}`));
