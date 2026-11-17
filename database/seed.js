const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const file = path.join(__dirname,'db.json');
const db = {
 users: [
  {id:'u-admin',name:'System Administrator',email:'admin@roadsync.gov',password:bcrypt.hashSync('Admin@12345',10),role:'admin',department:'Administration'},
  {id:'u-elec',name:'Electricity Department',email:'electricity@road.gov',password:bcrypt.hashSync('Demo@12345',10),role:'department',department:'Electricity'},
  {id:'u-water',name:'Water Supply Department',email:'water@road.gov',password:bcrypt.hashSync('Demo@12345',10),role:'department',department:'Water Supply'},
  {id:'u-tele',name:'Telecom Department',email:'telecom@road.gov',password:bcrypt.hashSync('Demo@12345',10),role:'department',department:'Telecom'},
  {id:'u-pwd',name:'Public Works Department',email:'pwd@road.gov',password:bcrypt.hashSync('Demo@12345',10),role:'department',department:'Public Works'}
 ],
 segments:[
  {id:'RD-014',name:'MG Road — Central Junction',area:'Central Zone',description:'Main market road segment',restrictionStart:null,restrictionEnd:null,restricted:false,cooldownDays:14},
  {id:'RD-021',name:'Mall Road — North Stretch',area:'North Zone',description:'Tourism and pedestrian corridor',restrictionStart:null,restrictionEnd:null,restricted:false,cooldownDays:14},
  {id:'RD-032',name:'Lake View Road — East',area:'East Zone',description:'Residential access road',restrictionStart:null,restrictionEnd:null,restricted:false,cooldownDays:14}
 ], requests:[], notifications:[], settings:{collectionDays:30,restrictionDays:30,cooldownDays:14},audit:[]
};
const now = new Date();
const future = d => { const x=new Date(now); x.setDate(x.getDate()+d); x.setHours(9,0,0,0); return x.toISOString(); };
db.requests = [
 {id:'RS-1001',department:'Water Supply',createdBy:'u-water',segmentId:'RD-014',title:'Water pipeline maintenance',workType:'Repair',description:'Replace a leaking section of the main water pipeline.',start:future(5),end:future(5).replace('09:00:00','13:00:00'),deadline:future(12),priority:'High',status:'approved',assignedStart:future(5),assignedEnd:future(5).replace('09:00:00','13:00:00'),mergeGroup:null,createdAt:now.toISOString(),actualCompletion:null},
 {id:'RS-1002',department:'Electricity',createdBy:'u-elec',segmentId:'RD-014',title:'Underground cable inspection',workType:'Inspection',description:'Inspect underground electricity cable near the junction.',start:future(5),end:future(5).replace('09:00:00','11:00:00'),deadline:future(10),priority:'Medium',status:'pending',assignedStart:null,assignedEnd:null,mergeGroup:null,createdAt:now.toISOString(),actualCompletion:null},
 {id:'RS-1003',department:'Telecom',createdBy:'u-tele',segmentId:'RD-021',title:'Fiber optic cable work',workType:'Installation',description:'Extend fiber optic cable to nearby offices.',start:future(8),end:future(8).replace('09:00:00','12:00:00'),deadline:future(15),priority:'Medium',status:'pending',assignedStart:null,assignedEnd:null,mergeGroup:null,createdAt:now.toISOString(),actualCompletion:null}
];
fs.writeFileSync(file,JSON.stringify(db,null,2)); console.log('RoadSync demo data seeded.');
