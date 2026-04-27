/**
 * RuralCare Connect — Seed File (PostgreSQL / Supabase)
 * ─────────────────────────────────────────────────────
 *   node db/seed.js          → seed only if DB is empty
 *   node db/seed.js --reset  → wipe & re-seed everything
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const db = require('./database');
const { initializeSchema } = require('./init');

const SALT_ROUNDS = 10;
const reset = process.argv.includes('--reset');

// ─────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────

const HOSPITALS = [
  { id:1, name:'Kolar District Hospital',  type:'District Hospital', block:'Kolar',       district:'Kolar', lat:13.1357, lng:78.1294, phone:'08152-222310', beds_total:60, icu_total:10 },
  { id:2, name:'CHC Bangarpet',            type:'CHC',               block:'Bangarpet',   district:'Kolar', lat:13.0521, lng:78.1780, phone:'08153-222110', beds_total:30, icu_total:4  },
  { id:3, name:'PHC Malur',                type:'PHC',               block:'Malur',       district:'Kolar', lat:13.0050, lng:77.9389, phone:'08152-267100', beds_total:10, icu_total:0  },
  { id:4, name:'PHC Srinivaspur',          type:'PHC',               block:'Srinivaspur', district:'Kolar', lat:13.3416, lng:78.2105, phone:'08151-222400', beds_total:10, icu_total:0  },
  { id:5, name:'CHC Mulbagal',             type:'CHC',               block:'Mulbagal',    district:'Kolar', lat:13.1649, lng:78.3959, phone:'08152-288100', beds_total:20, icu_total:2  },
];

const USERS = [
  { login_id:'9876543210', password:'patient123',  role:'patient',  name:'Ramesh Kumar',     hospital_id:null },
  { login_id:'9432111200', password:'sunita123',   role:'patient',  name:'Sunita Devi',      hospital_id:null },
  { login_id:'HOSP001',    password:'hospital123', role:'hospital', name:'Dr. Priya Sharma', hospital_id:1    },
  { login_id:'HOSP002',    password:'hosp2pwd',    role:'hospital', name:'Dr. Arun Kumar',   hospital_id:2    },
  { login_id:'GOVT001',    password:'govt123',     role:'govt',     name:'Dr. R. Mehta',     hospital_id:null },
];

const HOSPITAL_RESOURCES = [
  { hospital_id:1, beds_free:14, icu_free:3, o2_cylinders:18, doctors_on_duty:5, ventilators_free:2, blood_bank_units:12, public_alert_msg:null },
  { hospital_id:2, beds_free:3,  icu_free:0, o2_cylinders:5,  doctors_on_duty:2, ventilators_free:0, blood_bank_units:4,  public_alert_msg:'Low O2 stock — contact district NHM' },
  { hospital_id:3, beds_free:0,  icu_free:0, o2_cylinders:1,  doctors_on_duty:1, ventilators_free:0, blood_bank_units:0,  public_alert_msg:'Beds full. Diverting to KDH Kolar' },
  { hospital_id:4, beds_free:8,  icu_free:0, o2_cylinders:10, doctors_on_duty:2, ventilators_free:0, blood_bank_units:2,  public_alert_msg:null },
  { hospital_id:5, beds_free:11, icu_free:1, o2_cylinders:12, doctors_on_duty:3, ventilators_free:1, blood_bank_units:5,  public_alert_msg:null },
];

const WARDS = [
  { hospital_id:1, ward_name:'General Medicine', beds_total:20, beds_occupied:14 },
  { hospital_id:1, ward_name:'Surgery',          beds_total:15, beds_occupied:8  },
  { hospital_id:1, ward_name:'Maternity',        beds_total:10, beds_occupied:9  },
  { hospital_id:1, ward_name:'Paediatrics',      beds_total:10, beds_occupied:9  },
  { hospital_id:1, ward_name:'Emergency',        beds_total:5,  beds_occupied:6  },
  { hospital_id:1, ward_name:'ICU',              beds_total:10, beds_occupied:7  },
];

const THRESHOLDS = [
  { hospital_id:1, resource_key:'beds_free',       threshold_value:5 },
  { hospital_id:1, resource_key:'icu_free',         threshold_value:2 },
  { hospital_id:1, resource_key:'o2_cylinders',     threshold_value:5 },
  { hospital_id:1, resource_key:'blood_bank_units', threshold_value:5 },
];

const PATIENTS = [
  { patient_ref:'PAT-0041', name:'Ramesh Kumar',     mobile:'+91-98765-43210', age:42, gender:'M', blood_group:'O+',  village:'Kolar Block',  aadhaar_masked:'XXXX-XXXX-4120', registered_hospital_id:1, status:'active'     },
  { patient_ref:'PAT-0039', name:'Sunita Devi',      mobile:'+91-94321-11200', age:28, gender:'F', blood_group:'A+',  village:'Bangarpet',    aadhaar_masked:'XXXX-XXXX-7823', registered_hospital_id:2, status:'active'     },
  { patient_ref:'PAT-0037', name:'Krishnamurthy R.', mobile:'+91-90012-33456', age:65, gender:'M', blood_group:'B+',  village:'Malur',        aadhaar_masked:'XXXX-XXXX-3341', registered_hospital_id:1, status:'active'     },
  { patient_ref:'PAT-0035', name:'Lakshmi Bai',      mobile:'+91-87654-98765', age:45, gender:'F', blood_group:'AB+', village:'Srinivaspur',  aadhaar_masked:'XXXX-XXXX-6612', registered_hospital_id:1, status:'active'     },
  { patient_ref:'PAT-0033', name:'Venkatesh G.',     mobile:'+91-99887-12340', age:34, gender:'M', blood_group:'O-',  village:'Mulbagal',     aadhaar_masked:'XXXX-XXXX-9901', registered_hospital_id:1, status:'discharged' },
  { patient_ref:'PAT-0031', name:'Meena Kumari',     mobile:'+91-88776-54321', age:19, gender:'F', blood_group:'A-',  village:'Kolar Block',  aadhaar_masked:'XXXX-XXXX-2234', registered_hospital_id:1, status:'discharged' },
  { patient_ref:'PAT-0029', name:'Raju Nayak',       mobile:'+91-97651-23456', age:52, gender:'M', blood_group:'B-',  village:'Bangarpet',    aadhaar_masked:'XXXX-XXXX-5567', registered_hospital_id:1, status:'active'     },
];

const PATIENT_CONDITIONS = [
  { patient_ref:'PAT-0041', conditions:['Type 2 Diabetes','Hypertension'] },
  { patient_ref:'PAT-0039', conditions:['Anaemia','Pregnancy (7th month)'] },
  { patient_ref:'PAT-0037', conditions:['COPD','Hypertension'] },
  { patient_ref:'PAT-0035', conditions:['Tuberculosis'] },
  { patient_ref:'PAT-0029', conditions:['Post-cardiac surgery follow-up'] },
];

const PATIENT_MEDICATIONS = [
  { patient_ref:'PAT-0041', meds:[{name:'Metformin 500mg',  dose:'1-0-1 after meals', by:'Dr. Priya (KDH)', since:'2024-03-01'},{name:'Amlodipine 5mg',dose:'0-0-1',by:'Dr. Priya (KDH)',since:'2024-01-01'}]},
  { patient_ref:'PAT-0039', meds:[{name:'Iron-Folic Acid',  dose:'1-0-0',             by:'Dr. Arun (CHC)',  since:'2025-02-01'},{name:'Calcium 500mg',dose:'0-0-1',by:'Dr. Arun (CHC)',since:'2025-02-01'}]},
  { patient_ref:'PAT-0037', meds:[{name:'Salbutamol Inhaler',dose:'SOS',              by:'Dr. Priya (KDH)', since:'2024-06-01'},{name:'Amlodipine 5mg',dose:'0-0-1',by:'Dr. Priya (KDH)',since:'2024-06-01'}]},
  { patient_ref:'PAT-0035', meds:[{name:'DOTS regimen',     dose:'Daily',             by:'Dr. Priya (KDH)', since:'2025-01-01'}]},
  { patient_ref:'PAT-0031', meds:[{name:'Paracetamol 500mg',dose:'1-1-1',             by:'Dr. Arun (CHC)',  since:'2025-03-25'}]},
  { patient_ref:'PAT-0029', meds:[{name:'Aspirin 75mg',dose:'0-1-0',by:'Dr. Priya (KDH)',since:'2025-04-01'},{name:'Atorvastatin 20mg',dose:'0-0-1',by:'Dr. Priya (KDH)',since:'2025-04-01'},{name:'Metoprolol 25mg',dose:'1-0-1',by:'Dr. Priya (KDH)',since:'2025-04-01'}]},
];

const PATIENT_VISITS = [
  { patient_ref:'PAT-0041', visits:[
    { date:'2025-04-15', loc:'Kolar District Hospital', doc:'Dr. Priya Sharma', notes:'Routine checkup · BP: 130/85 mmHg · Blood sugar: 142 mg/dL', rx:null },
    { date:'2025-01-02', loc:'CHC Bangarpet',           doc:'Dr. Arun Kumar',   notes:'Fever & cough · Amoxicillin 250mg prescribed',                rx:'Amoxicillin 250mg added' },
    { date:'2024-10-18', loc:'Kolar District Hospital', doc:'Dr. Priya Sharma', notes:'Diabetes follow-up · Metformin dose adjusted 250mg → 500mg',  rx:'Metformin increased to 500mg' },
  ]},
  { patient_ref:'PAT-0039', visits:[
    { date:'2025-04-20', loc:'Kolar District Hospital', doc:'Dr. Priya Sharma', notes:'ANC checkup · Hb: 9.8 g/dL · Iron supplementation increased', rx:'Iron-Folic dose increased' },
    { date:'2025-04-05', loc:'CHC Bangarpet',           doc:'Dr. Arun Kumar',   notes:'Routine ANC · BP normal · USG done · Baby healthy',           rx:null },
  ]},
  { patient_ref:'PAT-0037', visits:[
    { date:'2025-04-10', loc:'Kolar District Hospital', doc:'Dr. Priya Sharma', notes:'COPD exacerbation · O2 sat 88% on admission, improved to 96%', rx:'Salbutamol nebulization' },
  ]},
  { patient_ref:'PAT-0029', visits:[
    { date:'2025-04-21', loc:'Kolar District Hospital', doc:'Dr. Priya Sharma', notes:'Post-op cardiac follow-up · ECG normal', rx:null },
    { date:'2025-04-01', loc:'Kolar District Hospital', doc:'Dr. Priya Sharma', notes:'Cardiac bypass surgery (CABG) performed', rx:'Aspirin, Atorvastatin, Metoprolol started' },
  ]},
];

const MEDICINES = [
  { hospital_id:1, name:'Paracetamol 500mg',  generic_name:'Paracetamol',    strength:'500mg',  quantity_available:240, unit_price_govt:2.50, unit_price_private:8.00  },
  { hospital_id:1, name:'Amoxicillin 250mg',  generic_name:'Amoxicillin',    strength:'250mg',  quantity_available:180, unit_price_govt:4.00, unit_price_private:14.00 },
  { hospital_id:1, name:'Amlodipine 5mg',     generic_name:'Amlodipine',     strength:'5mg',    quantity_available:90,  unit_price_govt:3.20, unit_price_private:11.00 },
  { hospital_id:1, name:'Metformin 500mg',    generic_name:'Metformin',      strength:'500mg',  quantity_available:120, unit_price_govt:1.80, unit_price_private:6.50  },
  { hospital_id:2, name:'Metformin 500mg',    generic_name:'Metformin',      strength:'500mg',  quantity_available:30,  unit_price_govt:1.80, unit_price_private:6.50  },
  { hospital_id:3, name:'Salbutamol Inhaler', generic_name:'Salbutamol',     strength:'100mcg', quantity_available:0,   unit_price_govt:0,    unit_price_private:85.00 },
  { hospital_id:1, name:'Aspirin 75mg',       generic_name:'Aspirin',        strength:'75mg',   quantity_available:150, unit_price_govt:1.00, unit_price_private:4.00  },
  { hospital_id:1, name:'Iron-Folic Acid',    generic_name:'Ferrous Sulfate',strength:'60mg',   quantity_available:200, unit_price_govt:0.80, unit_price_private:3.50  },
];

const VENDORS = [
  { name:'HLL Lifecare Ltd.',  type:'Medicines & supplies', rating:4.8, avg_delivery_days:2, contact:'1800-180-8180', verified:1 },
  { name:'KMSCL',              type:'All medical supplies', rating:4.6, avg_delivery_days:1, contact:'044-24334000',  verified:1 },
  { name:'Invacare India',     type:'O2 & equipment',       rating:4.5, avg_delivery_days:4, contact:'022-41501500',  verified:1 },
];

const SHORTAGE_REQUESTS = [
  { ref_number:'SR-2025-0039', hospital_id:1, item_name:'Salbutamol Inhaler', quantity_needed:100, current_stock:0,  priority:'normal',   justification:'Regular stock replenishment',                         status:'delivered', raised_at:'2025-04-10 09:00' },
  { ref_number:'SR-2025-0040', hospital_id:1, item_name:'O2 cylinders',       quantity_needed:5,   current_stock:3,  priority:'high',     justification:'Increased respiratory cases this week',              status:'approved',  raised_at:'2025-04-18 10:30' },
  { ref_number:'SR-2025-0041', hospital_id:1, item_name:'ICU ventilator',      quantity_needed:1,   current_stock:0,  priority:'critical', justification:'Only 2 functional, one broke down during surgery',   status:'pending',   raised_at:'2025-04-21 14:00' },
  { ref_number:'SR-2025-0042', hospital_id:3, item_name:'O2 cylinders',        quantity_needed:10,  current_stock:1,  priority:'critical', justification:'PHC Malur critically low, last cylinder in use',     status:'pending',   raised_at:'2025-04-22 08:00' },
  { ref_number:'SR-2025-0043', hospital_id:2, item_name:'Metformin 500mg',     quantity_needed:500, current_stock:30, priority:'high',     justification:'Low stock, high diabetic patient load in Bangarpet', status:'pending',   raised_at:'2025-04-22 11:00' },
];

const AUDIT_ENTRIES = [
  { user_name:'Dr. Priya Sharma', action_type:'update',   description:'Beds updated: 16 → 14 (2 new admissions)',                      entity_type:'hospital_resources', entity_id:1 },
  { user_name:'Nurse Kavitha R.', action_type:'update',   description:'ICU count updated: 4 → 3',                                       entity_type:'hospital_resources', entity_id:1 },
  { user_name:'Pharmacist Rajan', action_type:'shortage', description:'Shortage request #SR-2025-0041 raised: ICU ventilator (qty: 1)', entity_type:'shortage_requests',  entity_id:3 },
  { user_name:'Dr. Priya Sharma', action_type:'submit',   description:'Daily resource report submitted to NHM portal',                  entity_type:'hospital_resources', entity_id:1 },
  { user_name:'Admin Suresh K.',  action_type:'admin',    description:'Vendor "Invacare India" added to approved list',                 entity_type:'vendors',            entity_id:3 },
];

// ─────────────────────────────────────────────
// SEED ENGINE
// ─────────────────────────────────────────────

async function clearAll() {
  const tables = ['audit_log','emergency_calls','shortage_requests','medicine_reservations',
    'medicines','patient_visits','patient_medications','patient_conditions','patients',
    'resource_thresholds','ward_status','hospital_resources','users','vendors','hospitals','bed_reservations'];
  for (const t of tables) {
    await db.exec(`TRUNCATE TABLE ${t} CASCADE`);
  }
  console.log('🗑️  All tables cleared');
}

async function resetSequences() {
  const tables = ['hospitals','users','hospital_resources','ward_status','resource_thresholds',
    'patients','patient_conditions','patient_medications','patient_visits',
    'medicines','medicine_reservations','vendors','shortage_requests',
    'emergency_calls','audit_log','bed_reservations'];
  for (const t of tables) {
    await db.exec(
      `SELECT setval(pg_get_serial_sequence('${t}','id'), COALESCE((SELECT MAX(id) FROM ${t}),0)+1, false)`
    );
  }
}

async function seedDatabase() {
  console.log('🌱 Seeding RuralCare database (Supabase)...');

  // Hospitals (insert with explicit IDs)
  for (const h of HOSPITALS) {
    await db.run(
      `INSERT INTO hospitals (id,name,type,block,district,lat,lng,phone,beds_total,icu_total)
       VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT (id) DO NOTHING`,
      [h.id,h.name,h.type,h.block,h.district,h.lat,h.lng,h.phone,h.beds_total,h.icu_total]
    );
  }
  console.log(`  ✅ ${HOSPITALS.length} hospitals`);

  // Users
  for (const u of USERS) {
    const hash = bcrypt.hashSync(u.password, SALT_ROUNDS);
    await db.run(
      `INSERT INTO users (login_id,password_hash,role,name,hospital_id)
       VALUES (?,?,?,?,?) ON CONFLICT (login_id) DO NOTHING`,
      [u.login_id, hash, u.role, u.name, u.hospital_id]
    );
  }
  console.log(`  ✅ ${USERS.length} users`);

  // Hospital resources
  for (const r of HOSPITAL_RESOURCES) {
    await db.run(
      `INSERT INTO hospital_resources (hospital_id,beds_free,icu_free,o2_cylinders,doctors_on_duty,ventilators_free,blood_bank_units,public_alert_msg)
       VALUES (?,?,?,?,?,?,?,?) ON CONFLICT (hospital_id) DO NOTHING`,
      [r.hospital_id,r.beds_free,r.icu_free,r.o2_cylinders,r.doctors_on_duty,r.ventilators_free,r.blood_bank_units,r.public_alert_msg]
    );
  }

  // Wards
  for (const w of WARDS) {
    await db.run(
      `INSERT INTO ward_status (hospital_id,ward_name,beds_total,beds_occupied)
       VALUES (?,?,?,?) ON CONFLICT (hospital_id,ward_name) DO NOTHING`,
      [w.hospital_id,w.ward_name,w.beds_total,w.beds_occupied]
    );
  }

  // Thresholds
  for (const t of THRESHOLDS) {
    await db.run(
      `INSERT INTO resource_thresholds (hospital_id,resource_key,threshold_value)
       VALUES (?,?,?) ON CONFLICT (hospital_id,resource_key) DO NOTHING`,
      [t.hospital_id,t.resource_key,t.threshold_value]
    );
  }

  // Patients
  for (const p of PATIENTS) {
    await db.run(
      `INSERT INTO patients (patient_ref,name,mobile,age,gender,blood_group,village,aadhaar_masked,registered_hospital_id,status)
       VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT (patient_ref) DO NOTHING`,
      [p.patient_ref,p.name,p.mobile,p.age,p.gender,p.blood_group,p.village,p.aadhaar_masked,p.registered_hospital_id,p.status]
    );
  }

  // Link patient user → patient record
  const ramesh = await db.get("SELECT id FROM users WHERE login_id='9876543210'");
  if (ramesh) await db.run("UPDATE patients SET linked_user_id=? WHERE patient_ref='PAT-0041'", [ramesh.id]);
  const sunita = await db.get("SELECT id FROM users WHERE login_id='9432111200'");
  if (sunita)  await db.run("UPDATE patients SET linked_user_id=? WHERE patient_ref='PAT-0039'", [sunita.id]);

  // Conditions
  for (const pc of PATIENT_CONDITIONS) {
    const pat = await db.get('SELECT id FROM patients WHERE patient_ref=?', [pc.patient_ref]);
    if (pat) for (const c of pc.conditions) {
      await db.run('INSERT INTO patient_conditions (patient_id,condition_name) VALUES (?,?)', [pat.id,c]);
    }
  }

  // Medications
  for (const pm of PATIENT_MEDICATIONS) {
    const pat = await db.get('SELECT id FROM patients WHERE patient_ref=?', [pm.patient_ref]);
    if (pat) for (const m of pm.meds) {
      await db.run(
        'INSERT INTO patient_medications (patient_id,medicine_name,dose,prescribed_by,since_date) VALUES (?,?,?,?,?)',
        [pat.id,m.name,m.dose,m.by,m.since]
      );
    }
  }

  // Visits
  for (const pv of PATIENT_VISITS) {
    const pat = await db.get('SELECT id FROM patients WHERE patient_ref=?', [pv.patient_ref]);
    if (pat) for (const v of pv.visits) {
      await db.run(
        'INSERT INTO patient_visits (patient_id,visit_date,location,doctor,notes,prescription_change) VALUES (?,?,?,?,?,?)',
        [pat.id,v.date,v.loc,v.doc,v.notes,v.rx]
      );
    }
  }
  console.log(`  ✅ ${PATIENTS.length} patients with conditions, meds & visits`);

  // Medicines
  for (const m of MEDICINES) {
    await db.run(
      `INSERT INTO medicines (hospital_id,name,generic_name,strength,quantity_available,unit_price_govt,unit_price_private,source)
       VALUES (?,?,?,?,?,?,?,'govt') ON CONFLICT DO NOTHING`,
      [m.hospital_id,m.name,m.generic_name,m.strength,m.quantity_available,m.unit_price_govt,m.unit_price_private]
    );
  }
  console.log(`  ✅ ${MEDICINES.length} medicine records`);

  // Vendors
  for (const v of VENDORS) {
    await db.run(
      `INSERT INTO vendors (name,type,rating,avg_delivery_days,contact,verified) VALUES (?,?,?,?,?,?) ON CONFLICT DO NOTHING`,
      [v.name,v.type,v.rating,v.avg_delivery_days,v.contact,v.verified]
    );
  }

  // Shortage requests
  const hospUser = await db.get("SELECT id FROM users WHERE login_id='HOSP001'");
  for (const s of SHORTAGE_REQUESTS) {
    await db.run(
      `INSERT INTO shortage_requests (ref_number,hospital_id,item_name,quantity_needed,current_stock,priority,justification,status,raised_by,raised_at)
       VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT (ref_number) DO NOTHING`,
      [s.ref_number,s.hospital_id,s.item_name,s.quantity_needed,s.current_stock,s.priority,s.justification,s.status,hospUser?.id||null,s.raised_at]
    );
  }
  console.log(`  ✅ ${SHORTAGE_REQUESTS.length} shortage requests`);

  // Audit log
  for (const a of AUDIT_ENTRIES) {
    await db.run(
      `INSERT INTO audit_log (user_name,action_type,description,entity_type,entity_id) VALUES (?,?,?,?,?)`,
      [a.user_name,a.action_type,a.description,a.entity_type,a.entity_id]
    );
  }
  console.log(`  ✅ ${AUDIT_ENTRIES.length} audit entries`);

  // Reset sequences so auto-increment works correctly after explicit ID inserts
  await resetSequences();

  console.log('\n🎉 Seed complete!\n');
  console.log('Demo credentials:');
  console.log('  Patient  → 9876543210 / patient123');
  console.log('  Hospital → HOSP001    / hospital123');
  console.log('  Govt     → GOVT001    / govt123\n');
}

module.exports = { seedDatabase, clearAll };

// Standalone runner
if (require.main === module) {
  (async () => {
    await initializeSchema();
    if (reset) {
      await clearAll();
      await seedDatabase();
    } else {
      const { isSeeded } = require('./init');
      if (!(await isSeeded())) {
        await seedDatabase();
      } else {
        console.log('ℹ️  Already seeded. Use --reset to re-seed.');
      }
    }
    process.exit(0);
  })().catch(e => { console.error(e); process.exit(1); });
}
