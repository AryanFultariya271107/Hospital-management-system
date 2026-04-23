/* ============================================================
   MediCore HMS — app.js v2
   All API calls → Flask at localhost:5000
============================================================ */
const API = 'http://localhost:5000/api';

/* ============================================================
   STATE
============================================================ */
const state = {
  patients: { page:1, search:'', data:[] },
  appts: { status:'', date:'' },
  emergency: { status:'' },
  admissions: { status:'' },
  labs: { status:'' },
  beds: { type:'' },
  billing: { status:'' },
};

/* ============================================================
   INIT
============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  clock();
  setInterval(clock, 1000);
  document.getElementById('dashDate').textContent =
    new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  loadDashboard();
  setInterval(()=>{ loadEmergency(); refreshEmergencyBadge(); }, 30000);
});

function clock(){
  const el = document.getElementById('timeDisplay');
  if(el) el.textContent = new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
}

/* ============================================================
   NAVIGATION
============================================================ */
const PAGE_TITLES = {
  dashboard:'Dashboard', patients:'Patient Registry', doctors:'Medical Staff',
  departments:'Departments', appointments:'Appointments', emergency:'Emergency Queue',
  admissions:'Admissions', beds:'Bed Management', labtests:'Lab Tests',
  records:'Medical Records', billing:'Billing', audit:'Audit Log'
};
const PAGE_LOADERS = {
  dashboard:loadDashboard, patients:loadPatients, doctors:loadDoctors,
  departments:loadDepartments, appointments:loadAppointments, emergency:loadEmergency,
  admissions:loadAdmissions, beds:loadBeds, labtests:loadLabTests,
  records:loadRecords, billing:loadBilling, audit:loadAudit
};

function showPage(name){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById('page-'+name).classList.add('active');
  document.querySelector(`[data-page="${name}"]`)?.classList.add('active');
  document.getElementById('pageTitle').textContent = PAGE_TITLES[name]||name;
  if(PAGE_LOADERS[name]) PAGE_LOADERS[name]();
}

function toggleSidebar(){
  const s = document.getElementById('sidebar');
  if(window.innerWidth<=768) s.classList.toggle('mobile-open');
  else s.classList.toggle('collapsed');
}

/* ============================================================
   API HELPERS
============================================================ */
async function api(url, opts={}){
  try{
    const res = await fetch(API+url,{headers:{'Content-Type':'application/json'},...opts});
    return await res.json();
  }catch(e){
    console.error(e);
    toast('Connection error — is Flask running on :5000?','error');
    return null;
  }
}

/* ============================================================
   TOAST
============================================================ */
function toast(msg, type='info'){
  const icons = {success:'✓',error:'✕',info:'ℹ',warn:'⚠'};
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<span class="toast-icon">${icons[type]||'ℹ'}</span><span>${msg}</span>`;
  c.appendChild(t);
  requestAnimationFrame(()=>{ requestAnimationFrame(()=>t.classList.add('show')); });
  setTimeout(()=>{ t.classList.remove('show'); setTimeout(()=>t.remove(),350); }, 3200);
}

/* ============================================================
   MODALS
============================================================ */
function openModal(id){
  document.getElementById(id).classList.add('open');
  prefillDropdowns(id);
}
function closeModal(id){
  document.getElementById(id).classList.remove('open');
}
document.addEventListener('click', e=>{
  if(e.target.classList.contains('modal-overlay')) e.target.classList.remove('open');
});

async function prefillDropdowns(id){
  const needsPatients = ['addPatientModal','addApptModal','addEmergencyModal','addAdmissionModal','addLabModal','addRecordModal','addBillingModal'];
  const needsDoctors  = ['addApptModal','addRecordModal','addDoctorModal'];
  if(needsPatients.includes(id)) await fillPatientDropdowns();
  if(id==='addApptModal'||id==='addRecordModal') await fillDoctorDropdowns();
  if(id==='addDoctorModal') await fillDeptDropdown();
  if(id==='addAdmissionModal') await fillAvailableBeds();
}

async function fillPatientDropdowns(){
  const r = await api('/patients?limit=500');
  if(!r?.success) return;
  const opts = r.data.map(p=>`<option value="${p.patient_id}">${esc(p.name)} (${p.blood_group||'?'})</option>`).join('');
  ['a_patient','e_patient','ad_patient','l_patient','r_patient','bill_patient'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.innerHTML = '<option value="">Select patient</option>'+opts;
  });
}
async function fillDoctorDropdowns(){
  const r = await api('/doctors');
  if(!r?.success) return;
  const opts = r.data.map(d=>`<option value="${d.doctor_id}">${esc(d.name)} — ${esc(d.specialization||'General')}</option>`).join('');
  ['a_doctor','r_doctor'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.innerHTML = '<option value="">Select doctor</option>'+opts;
  });
}
async function fillDeptDropdown(){
  const r = await api('/departments');
  if(!r?.success) return;
  const el = document.getElementById('d_dept');
  if(el) el.innerHTML = '<option value="">— No dept —</option>'+r.data.map(d=>`<option value="${d.dept_id}">${esc(d.name)}</option>`).join('');
}
async function fillAvailableBeds(){
  const r = await api('/beds?occupied=false');
  if(!r?.success) return;
  const el = document.getElementById('ad_bed');
  if(el) el.innerHTML = '<option value="">No specific bed</option>'+
    r.data.map(b=>`<option value="${b.bed_id}">${esc(b.bed_number)} — ${esc(b.type)} (Ward ${esc(b.ward||'?')})</option>`).join('');
}

/* ============================================================
   DASHBOARD
============================================================ */
async function loadDashboard(){
  const r = await api('/dashboard');
  if(!r?.success) return;
  const d = r.data;

  setText('sd-patients',  d.total_patients??'—');
  setText('sd-doctors',   d.total_doctors??'—');
  setText('sd-beds',      `${d.available_beds}/${d.total_beds}`);
  setText('sd-beds-sub',  `of ${d.total_beds} total beds`);
  setText('sd-emerg',     d.active_emergencies??'—');
  setText('sd-appts',     d.today_appointments??'—');
  setText('sd-labs',      d.pending_labs??'—');
  setText('sd-admissions',d.active_admissions??'—');
  setText('sd-bills',     d.unpaid_bills??'—');

  // Emergency badge
  const badge = document.getElementById('emergencyBadge');
  const dot   = document.getElementById('notifDot');
  if(d.active_emergencies>0){
    badge.textContent = d.active_emergencies;
    badge.style.display='';
    if(dot) dot.style.display='';
  } else {
    badge.style.display='none';
    if(dot) dot.style.display='none';
  }

  // Bed occupancy
  const occEl = document.getElementById('dashBedOcc');
  if(d.bed_occupancy?.length){
    const typeColors = {General:'var(--blue)',ICU:'var(--red)',Emergency:'var(--orange)',Private:'var(--purple)'};
    occEl.innerHTML = d.bed_occupancy.map(b=>{
      const pct = b.total_beds>0 ? Math.round((b.occupied/b.total_beds)*100) : 0;
      const col = typeColors[b.type]||'var(--teal)';
      return `<div class="occ-row">
        <div class="occ-type" style="color:${col}">${b.type}</div>
        <div class="occ-track"><div class="occ-fill" style="width:${pct}%;background:${col}"></div></div>
        <div class="occ-nums">${b.occupied}/${b.total_beds}</div>
      </div>`;
    }).join('');
  }

  // Recent emergencies
  const emEl = document.getElementById('dashEmergency');
  if(d.recent_emergencies?.length){
    emEl.innerHTML = d.recent_emergencies.map(e=>`
      <div class="mini-emerg">
        <div class="triage-dot td${e.triage_level}">${e.triage_level}</div>
        <div style="min-width:0">
          <div class="mini-emerg-name">${esc(e.patient_name)}</div>
          <div class="mini-emerg-info">${esc(e.blood_group||'—')} • ${triageLabel(e.triage_level)} • ${statusBadge(e.status)}</div>
        </div>
      </div>`).join('');
  } else {
    emEl.innerHTML = '<p style="color:var(--text3);font-size:13px;padding:12px 0">No active emergencies</p>';
  }

  // Today's appointments
  const apEl = document.getElementById('dashAppts');
  if(d.today_appt_list?.length){
    apEl.innerHTML = d.today_appt_list.map(a=>`
      <div class="mini-appt">
        <div class="mini-appt-time">${fmtTime(a.scheduled_at)}</div>
        <div class="mini-appt-info">
          <div class="mini-appt-patient">${esc(a.patient_name)}</div>
          <div class="mini-appt-doctor">Dr. ${esc(a.doctor_name)}</div>
        </div>
      </div>`).join('');
  } else {
    apEl.innerHTML = '<p style="color:var(--text3);font-size:13px;padding:12px 0">No appointments scheduled today</p>';
  }
}

async function refreshEmergencyBadge(){
  const r = await api('/dashboard');
  if(!r?.success) return;
  const badge = document.getElementById('emergencyBadge');
  badge.textContent = r.data.active_emergencies||0;
  badge.style.display = r.data.active_emergencies>0?'':'none';
}

/* ============================================================
   PATIENTS
============================================================ */
let patientPage = 1;

async function loadPatients(){
  const s = state.patients;
  const r = await api(`/patients?page=${s.page}&limit=25&search=${encodeURIComponent(s.search)}`);
  if(!r?.success) return;
  const tbody = document.getElementById('patientsBody');
  if(!r.data.length){
    tbody.innerHTML = `<tr><td colspan="7" class="table-empty">No patients found</td></tr>`;
  } else {
    tbody.innerHTML = r.data.map(p=>`<tr>
      <td><div class="td-name">${esc(p.name)}</div><div class="td-muted" style="font-size:11px">${esc(p.patient_id).substring(0,8)}…</div></td>
      <td class="td-muted">${p.dob||'—'}</td>
      <td><span class="badge bi">${esc(p.blood_group||'—')}</span></td>
      <td class="td-muted">${esc(p.phone||'—')}</td>
      <td class="td-muted">${esc(p.email||'—')}</td>
      <td class="td-muted">${esc(p.emergency_contact||'—')}</td>
      <td>
        <div style="display:flex;gap:5px">
          <button class="btn btn-xs btn-secondary" onclick="editPatient(${JSON.stringify(p).replace(/"/g,'&quot;')})">Edit</button>
          <button class="btn btn-xs btn-ghost" onclick="deletePatient('${p.patient_id}','${esc(p.name)}')">✕</button>
        </div>
      </td>
    </tr>`).join('');
  }
  // Pagination
  renderPagination('patientsPagination', r.page, r.pages, n=>{ state.patients.page=n; loadPatients(); });
}

async function searchPatients(){
  state.patients.search = document.getElementById('patientSearch').value;
  state.patients.page = 1;
  await loadPatients();
}

async function savePatient(){
  const pid = document.getElementById('p_id').value;
  const name = document.getElementById('p_name').value.trim();
  if(!name){ toast('Patient name is required','error'); return; }
  const body = {
    name, dob: val('p_dob'), blood_group: val('p_blood'),
    phone: val('p_phone'), email: val('p_email'),
    emergency_contact: val('p_emergency'), address: val('p_address')
  };
  const method = pid ? 'PUT' : 'POST';
  const url    = pid ? `/patients/${pid}` : '/patients';
  const r = await api(url,{method,body:JSON.stringify(body)});
  if(r?.success){
    toast(pid?'Patient updated':'Patient registered','success');
    closeModal('addPatientModal');
    clearForm('p_id','p_name','p_dob','p_blood','p_phone','p_email','p_emergency','p_address');
    loadPatients();
  } else {
    toast(r?.message||'Operation failed','error');
  }
}

function editPatient(p){
  document.getElementById('patientModalTitle').textContent = 'Edit Patient';
  setVal('p_id',p.patient_id); setVal('p_name',p.name);
  setVal('p_dob',p.dob||''); setVal('p_blood',p.blood_group||'');
  setVal('p_phone',p.phone||''); setVal('p_email',p.email||'');
  setVal('p_emergency',p.emergency_contact||''); setVal('p_address',p.address||'');
  openModal('addPatientModal');
}

async function deletePatient(id, name){
  if(!confirm(`Remove patient "${name}"? This will delete all related records.`)) return;
  const r = await api(`/patients/${id}`,{method:'DELETE'});
  if(r?.success){ toast('Patient removed','info'); loadPatients(); }
}

/* ============================================================
   DOCTORS
============================================================ */
async function loadDoctors(){
  const r = await api('/doctors');
  if(!r?.success) return;
  const tbody = document.getElementById('doctorsBody');
  if(!r.data.length){
    tbody.innerHTML = `<tr><td colspan="7" class="table-empty">No doctors registered</td></tr>`;
    return;
  }
  tbody.innerHTML = r.data.map(d=>`<tr>
    <td><div class="td-name">${esc(d.name)}</div></td>
    <td class="td-muted">${esc(d.specialization||'—')}</td>
    <td><span class="badge bp">${esc(d.dept_name||'—')}</span></td>
    <td class="td-muted">${esc(d.phone||'—')}</td>
    <td class="td-muted">${esc(d.email||'—')}</td>
    <td><span class="badge bi">${d.today_appts||0} today</span></td>
    <td>
      <div style="display:flex;gap:5px">
        <button class="btn btn-xs btn-secondary" onclick="editDoctor(${JSON.stringify(d).replace(/"/g,'&quot;')})">Edit</button>
        <button class="btn btn-xs btn-ghost" onclick="deleteDoctor('${d.doctor_id}','${esc(d.name)}')">✕</button>
      </div>
    </td>
  </tr>`).join('');
}

async function saveDoctor(){
  const did = val('d_id');
  const name = val('d_name').trim();
  if(!name){ toast('Doctor name is required','error'); return; }
  const body = {name, specialization:val('d_spec'), dept_id:val('d_dept')||null, phone:val('d_phone'), email:val('d_email')};
  const method = did?'PUT':'POST';
  const url    = did?`/doctors/${did}`:'/doctors';
  const r = await api(url,{method,body:JSON.stringify(body)});
  if(r?.success){
    toast(did?'Doctor updated':'Doctor added','success');
    closeModal('addDoctorModal');
    clearForm('d_id','d_name','d_spec','d_phone','d_email');
    loadDoctors();
  }
}

function editDoctor(d){
  document.getElementById('doctorModalTitle').textContent = 'Edit Doctor';
  setVal('d_id',d.doctor_id); setVal('d_name',d.name);
  setVal('d_spec',d.specialization||''); setVal('d_phone',d.phone||''); setVal('d_email',d.email||'');
  openModal('addDoctorModal');
  setTimeout(()=>setVal('d_dept',d.dept_id||''), 300);
}

async function deleteDoctor(id,name){
  if(!confirm(`Remove Dr. ${name}?`)) return;
  const r = await api(`/doctors/${id}`,{method:'DELETE'});
  if(r?.success){ toast('Doctor removed','info'); loadDoctors(); }
}

/* ============================================================
   DEPARTMENTS
============================================================ */
async function loadDepartments(){
  const r = await api('/departments');
  if(!r?.success) return;
  const tbody = document.getElementById('deptsBody');
  if(!r.data.length){
    tbody.innerHTML = `<tr><td colspan="4" class="table-empty">No departments</td></tr>`;
    return;
  }
  tbody.innerHTML = r.data.map(d=>`<tr>
    <td class="td-name">${esc(d.name)}</td>
    <td class="td-muted">Floor ${d.floor||'—'}</td>
    <td><span class="badge bi">${d.doctor_count||0} doctors</span></td>
    <td><button class="btn btn-xs btn-ghost" onclick="deleteDept(${d.dept_id},'${esc(d.name)}')">✕</button></td>
  </tr>`).join('');
}

async function addDepartment(){
  const name = val('dept_name').trim();
  if(!name){ toast('Name required','error'); return; }
  const r = await api('/departments',{method:'POST',body:JSON.stringify({name,floor:val('dept_floor')||1})});
  if(r?.success){ toast('Department added','success'); closeModal('addDeptModal'); clearForm('dept_name','dept_floor'); loadDepartments(); }
}

async function deleteDept(id,name){
  if(!confirm(`Delete department "${name}"?`)) return;
  const r = await api(`/departments/${id}`,{method:'DELETE'});
  if(r?.success){ toast('Department deleted','info'); loadDepartments(); }
}

/* ============================================================
   APPOINTMENTS
============================================================ */
function apptFilter(btn, status){
  document.querySelectorAll('#page-appointments .ftab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  state.appts.status = status;
  loadAppointments();
}

async function loadAppointments(){
  const s = state.appts;
  const df = document.getElementById('apptDateFilter')?.value||'';
  let url = `/appointments?status=${s.status}`;
  if(df) url += `&date=${df}`;
  const r = await api(url);
  if(!r?.success) return;
  const tbody = document.getElementById('appointmentsBody');
  if(!r.data.length){
    tbody.innerHTML = `<tr><td colspan="7" class="table-empty">No appointments found</td></tr>`;
    return;
  }
  tbody.innerHTML = r.data.map(a=>`<tr>
    <td><div class="td-name">${esc(a.patient_name)}</div><div class="td-muted" style="font-size:11px">${esc(a.patient_phone||'')}</div></td>
    <td class="td-name">${esc(a.doctor_name)}</td>
    <td class="td-muted">${esc(a.specialization||'—')}</td>
    <td class="td-mono">${fmtDt(a.scheduled_at)}</td>
    <td class="td-muted" style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(a.reason||'—')}</td>
    <td>${statusBadge(a.status)}</td>
    <td>
      <select class="select-inline" onchange="updateApptStatus('${a.appt_id}',this.value);this.value=''">
        <option value="">Update…</option>
        <option value="Completed">Completed</option>
        <option value="Cancelled">Cancelled</option>
        <option value="No-Show">No-Show</option>
        <option value="Scheduled">Re-schedule</option>
      </select>
    </td>
  </tr>`).join('');
}

async function bookAppointment(){
  const pat=val('a_patient'), doc=val('a_doctor'), dt=val('a_datetime');
  if(!pat||!doc||!dt){ toast('Patient, doctor and time are required','error'); return; }
  const r = await api('/appointments',{method:'POST',body:JSON.stringify({patient_id:pat,doctor_id:doc,scheduled_at:dt,reason:val('a_reason')})});
  if(r?.success){ toast('Appointment booked','success'); closeModal('addApptModal'); clearForm('a_patient','a_doctor','a_datetime','a_reason'); loadAppointments(); }
  else toast(r?.message||'Booking failed','error');
}

async function updateApptStatus(id, status){
  if(!status) return;
  const r = await api(`/appointments/${id}/status`,{method:'PUT',body:JSON.stringify({status})});
  if(r?.success){ toast(`Status → ${status}`,'info'); loadAppointments(); }
}

/* ============================================================
   EMERGENCY
============================================================ */
function emergFilter(btn, status){
  document.querySelectorAll('#page-emergency .ftab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  state.emergency.status = status;
  loadEmergency();
}

async function loadEmergency(){
  const r = await api(`/emergency?status=${state.emergency.status}`);
  if(!r?.success) return;
  const tbody = document.getElementById('emergencyBody');
  if(!r.data.length){
    tbody.innerHTML = `<tr><td colspan="7" class="table-empty">No emergency cases</td></tr>`;
    return;
  }
  tbody.innerHTML = r.data.map(e=>`<tr class="tl${e.triage_level}">
    <td>
      <div class="td-name">${esc(e.patient_name)}</div>
      <div class="td-muted" style="font-size:11px">${esc(e.patient_phone||'')}${e.emergency_contact?` • EC: ${esc(e.emergency_contact)}`:''}</div>
    </td>
    <td><span class="badge bi">${esc(e.blood_group||'—')}</span></td>
    <td>
      <div class="triage-dot td${e.triage_level}" style="display:inline-flex;margin-right:6px">${e.triage_level}</div>
      <small>${triageLabel(e.triage_level)}</small>
    </td>
    <td class="td-mono" style="font-size:12px">${fmtDt(e.arrival_time)}</td>
    <td class="td-muted" style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(e.notes||'—')}</td>
    <td>${statusBadge(e.status)}</td>
    <td>
      <select class="select-inline" onchange="updateEmergStatus('${e.emergency_id}',this.value);this.value=''">
        <option value="">Update…</option>
        <option value="In Treatment">In Treatment</option>
        <option value="Admitted">Admitted</option>
        <option value="Discharged">Discharged</option>
        <option value="Waiting">Waiting</option>
      </select>
    </td>
  </tr>`).join('');
}

async function addEmergency(){
  const pat=val('e_patient'), lvl=val('e_triage');
  if(!pat){ toast('Select a patient','error'); return; }
  const r = await api('/emergency',{method:'POST',body:JSON.stringify({patient_id:pat,triage_level:parseInt(lvl),notes:val('e_notes')})});
  if(r?.success){ toast('Emergency registered','success'); closeModal('addEmergencyModal'); clearForm('e_patient','e_notes'); loadEmergency(); refreshEmergencyBadge(); }
}

async function updateEmergStatus(id,status){
  if(!status) return;
  const r = await api(`/emergency/${id}/status`,{method:'PUT',body:JSON.stringify({status})});
  if(r?.success){ toast(`Status → ${status}`,'info'); loadEmergency(); refreshEmergencyBadge(); }
}

async function refreshEmergencyBadge(){
  const r = await api('/dashboard');
  if(!r?.success) return;
  const badge = document.getElementById('emergencyBadge');
  const n = r.data.active_emergencies||0;
  badge.textContent=n; badge.style.display=n>0?'':'none';
}

/* ============================================================
   ADMISSIONS
============================================================ */
function admFilter(btn,status){
  document.querySelectorAll('#page-admissions .ftab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  state.admissions.status=status; loadAdmissions();
}

async function loadAdmissions(){
  const r = await api(`/admissions?status=${state.admissions.status}`);
  if(!r?.success) return;
  const tbody = document.getElementById('admissionsBody');
  if(!r.data.length){
    tbody.innerHTML=`<tr><td colspan="8" class="table-empty">No admissions found</td></tr>`; return;
  }
  tbody.innerHTML = r.data.map(a=>`<tr>
    <td class="td-name">${esc(a.patient_name)}</td>
    <td><span class="badge bi">${esc(a.blood_group||'—')}</span></td>
    <td class="td-mono">${esc(a.bed_number||'—')}</td>
    <td class="td-muted">${esc(a.ward||'—')}</td>
    <td class="td-muted">${esc(a.bed_type||'—')}</td>
    <td class="td-mono" style="font-size:12px">${fmtDt(a.admitted_at)}</td>
    <td>${a.discharged_at?`<span class="td-mono" style="font-size:12px">${fmtDt(a.discharged_at)}</span>`:'<span class="badge bg">Active</span>'}</td>
    <td>
      ${!a.discharged_at
        ?`<button class="btn btn-xs btn-secondary" onclick="dischargePatient('${a.admission_id}','${esc(a.patient_name)}')">Discharge</button>`
        :'<span class="td-muted">—</span>'}
    </td>
  </tr>`).join('');
}

async function admitPatient(){
  const pat=val('ad_patient');
  if(!pat){ toast('Select a patient','error'); return; }
  const r = await api('/admissions',{method:'POST',body:JSON.stringify({patient_id:pat,bed_id:val('ad_bed')||null,notes:val('ad_notes')})});
  if(r?.success){ toast('Patient admitted','success'); closeModal('addAdmissionModal'); clearForm('ad_patient','ad_bed','ad_notes'); loadAdmissions(); loadBeds(); }
  else toast(r?.message||'Admission failed','error');
}

async function dischargePatient(id,name){
  if(!confirm(`Discharge ${name}?`)) return;
  const r = await api(`/admissions/${id}/discharge`,{method:'PUT'});
  if(r?.success){ toast('Patient discharged','info'); loadAdmissions(); loadBeds(); }
}

/* ============================================================
   BEDS
============================================================ */
function bedFilter(btn,type){
  document.querySelectorAll('#page-beds .ftab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  state.beds.type=type; loadBeds();
}

async function loadBeds(){
  const t=state.beds.type;
  const r = await api(`/beds${t?'?type='+t:''}`);
  if(!r?.success) return;

  // Overview cards
  const overviewEl = document.getElementById('bedsOverview');
  const typeInfo = {General:{col:'var(--blue)',icon:'⊞'},ICU:{col:'var(--red)',icon:'❤'},Emergency:{col:'var(--orange)',icon:'⚠'},Private:{col:'var(--purple)',icon:'★'}};
  const summary = {};
  r.data.forEach(b=>{ if(!summary[b.type]) summary[b.type]={total:0,occ:0}; summary[b.type].total++; if(b.is_occupied) summary[b.type].occ++; });
  overviewEl.innerHTML = Object.entries(summary).map(([type,s])=>{
    const ti = typeInfo[type]||{col:'var(--teal)',icon:'⊞'};
    return `<div class="panel" style="border-top:2px solid ${ti.col}">
      <div class="panel-title" style="color:${ti.col}">${ti.icon} ${type}</div>
      <div style="font-size:28px;font-family:var(--fh);font-weight:800;color:${ti.col}">${s.total-s.occ}<span style="font-size:14px;color:var(--text3)">/${s.total}</span></div>
      <div style="font-size:11px;color:var(--text3);margin-top:4px">Available</div>
    </div>`;
  }).join('');

  // Bed grid
  const grid = document.getElementById('bedsGrid');
  const tColors = {General:'var(--blue)',ICU:'var(--red)',Emergency:'var(--orange)',Private:'var(--purple)'};
  grid.innerHTML = r.data.map(b=>`
    <div class="bed-card ${b.is_occupied?'occupied':'available'}">
      <div class="bed-number" style="color:${tColors[b.type]||'var(--teal)'}">${esc(b.bed_number)}</div>
      <div class="bed-meta">Ward ${esc(b.ward||'?')}</div>
      <span class="badge ${b.is_occupied?'br':'bg'}" style="font-size:11px">${b.is_occupied?'Occupied':'Available'}</span>
      <div style="margin-top:6px"><span class="badge bx" style="font-size:10px">${esc(b.type)}</span></div>
    </div>`).join('');
}

async function addBed(){
  const num = val('b_number').trim();
  if(!num){ toast('Bed number required','error'); return; }
  const r = await api('/beds',{method:'POST',body:JSON.stringify({ward:val('b_ward'),bed_number:num,type:val('b_type')})});
  if(r?.success){ toast('Bed added','success'); closeModal('addBedModal'); clearForm('b_ward','b_number'); loadBeds(); }
}

/* ============================================================
   LAB TESTS
============================================================ */
function labFilter(btn,status){
  document.querySelectorAll('#page-labtests .ftab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  state.labs.status=status; loadLabTests();
}

async function loadLabTests(){
  const r = await api(`/labtests?status=${state.labs.status}`);
  if(!r?.success) return;
  const tbody = document.getElementById('labBody');
  if(!r.data.length){
    tbody.innerHTML=`<tr><td colspan="6" class="table-empty">No lab tests</td></tr>`; return;
  }
  tbody.innerHTML = r.data.map(l=>`<tr>
    <td class="td-name">${esc(l.patient_name)}</td>
    <td class="td-name">${esc(l.test_name)}</td>
    <td class="td-mono" style="font-size:12px">${fmtDt(l.tested_at)}</td>
    <td>${statusBadge(l.status)}</td>
    <td class="td-muted" style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(l.result||'—')}</td>
    <td>
      <div style="display:flex;gap:5px">
        <button class="btn btn-xs btn-info" onclick="openUpdateLab('${l.test_id}',${JSON.stringify(l.result||'').replace(/"/g,'&quot;')},'${l.status}')">Update</button>
        <button class="btn btn-xs btn-ghost" onclick="deleteLabTest('${l.test_id}')">✕</button>
      </div>
    </td>
  </tr>`).join('');
}

async function addLabTest(){
  const pat=val('l_patient'), test=val('l_test').trim();
  if(!pat||!test){ toast('Patient and test name required','error'); return; }
  const r = await api('/labtests',{method:'POST',body:JSON.stringify({patient_id:pat,test_name:test,result:val('l_result')})});
  if(r?.success){ toast('Test ordered','success'); closeModal('addLabModal'); clearForm('l_patient','l_test','l_result'); loadLabTests(); }
}

function openUpdateLab(id,result,status){
  setVal('ul_id',id); setVal('ul_result',result); setVal('ul_status',status);
  openModal('updateLabModal');
}

async function updateLabResult(){
  const id=val('ul_id');
  const r = await api(`/labtests/${id}`,{method:'PUT',body:JSON.stringify({result:val('ul_result'),status:val('ul_status')})});
  if(r?.success){ toast('Result saved','success'); closeModal('updateLabModal'); loadLabTests(); }
}

async function deleteLabTest(id){
  if(!confirm('Delete this lab test?')) return;
  await api(`/labtests/${id}`,{method:'DELETE'});
  toast('Test deleted','info'); loadLabTests();
}

/* ============================================================
   MEDICAL RECORDS
============================================================ */
async function loadRecords(){
  const r = await api('/records');
  if(!r?.success) return;
  const tbody = document.getElementById('recordsBody');
  if(!r.data.length){
    tbody.innerHTML=`<tr><td colspan="7" class="table-empty">No medical records</td></tr>`; return;
  }
  tbody.innerHTML = r.data.map(rec=>`<tr>
    <td><div class="td-name">${esc(rec.patient_name)}</div><span class="badge bi" style="font-size:10px">${esc(rec.blood_group||'?')}</span></td>
    <td class="td-muted">${esc(rec.doctor_name)}</td>
    <td class="td-muted" style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(rec.diagnosis||'—')}</td>
    <td class="td-muted" style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(rec.prescription||'—')}</td>
    <td class="td-muted" style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(rec.notes||'—')}</td>
    <td class="td-mono" style="font-size:12px">${fmtDt(rec.created_at)}</td>
    <td>
      <div style="display:flex;gap:5px">
        <button class="btn btn-xs btn-secondary" onclick="editRecord(${JSON.stringify(rec).replace(/"/g,'&quot;')})">Edit</button>
        <button class="btn btn-xs btn-ghost" onclick="deleteRecord('${rec.record_id}')">✕</button>
      </div>
    </td>
  </tr>`).join('');
}

async function saveRecord(){
  const rid = val('rec_id');
  const pat=val('r_patient'), doc=val('r_doctor');
  if(!pat||!doc){ toast('Patient and doctor required','error'); return; }
  const body = {patient_id:pat,doctor_id:doc,diagnosis:val('r_diagnosis'),prescription:val('r_prescription'),notes:val('r_notes')};
  const method = rid?'PUT':'POST';
  const url    = rid?`/records/${rid}`:'/records';
  const r = await api(url,{method,body:JSON.stringify(body)});
  if(r?.success){ toast(rid?'Record updated':'Record saved','success'); closeModal('addRecordModal'); clearForm('rec_id','r_patient','r_doctor','r_diagnosis','r_prescription','r_notes'); loadRecords(); }
}

function editRecord(rec){
  setVal('rec_id',rec.record_id);
  openModal('addRecordModal');
  setTimeout(()=>{
    setVal('r_patient',rec.patient_id); setVal('r_doctor',rec.doctor_id);
    setVal('r_diagnosis',rec.diagnosis||''); setVal('r_prescription',rec.prescription||''); setVal('r_notes',rec.notes||'');
  },300);
}

async function deleteRecord(id){
  if(!confirm('Delete this medical record?')) return;
  await api(`/records/${id}`,{method:'DELETE'});
  toast('Record deleted','info'); loadRecords();
}

/* ============================================================
   BILLING
============================================================ */
function billFilter(btn,status){
  document.querySelectorAll('#page-billing .ftab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  state.billing.status=status; loadBilling();
}

async function loadBilling(){
  const r = await api(`/billing`);
  if(!r?.success) return;
  const all = state.billing.status ? r.data.filter(b=>b.status===state.billing.status) : r.data;
  const tbody = document.getElementById('billingBody');
  if(!all.length){
    tbody.innerHTML=`<tr><td colspan="7" class="table-empty">No bills found</td></tr>`; return;
  }
  tbody.innerHTML = all.map(b=>`<tr>
    <td class="td-name">${esc(b.patient_name)}</td>
    <td class="td-muted">${esc(b.description||'—')}</td>
    <td><span class="bill-amount ${b.status==='Paid'?'bill-paid':'bill-unpaid'}">₹${parseFloat(b.amount).toLocaleString('en-IN',{minimumFractionDigits:2})}</span></td>
    <td>${billStatusBadge(b.status)}</td>
    <td class="td-mono" style="font-size:12px">${fmtDt(b.created_at)}</td>
    <td class="td-mono" style="font-size:12px">${b.paid_at?fmtDt(b.paid_at):'—'}</td>
    <td>
      <div style="display:flex;gap:5px">
        ${b.status==='Unpaid'?`<button class="btn btn-xs btn-success" onclick="payBill('${b.bill_id}')">Mark Paid</button>`:''}
        <button class="btn btn-xs btn-ghost" onclick="deleteBill('${b.bill_id}')">✕</button>
      </div>
    </td>
  </tr>`).join('');
}

async function addBill(){
  const pat=val('bill_patient'), amt=val('bill_amount');
  if(!pat||!amt){ toast('Patient and amount required','error'); return; }
  const r = await api('/billing',{method:'POST',body:JSON.stringify({patient_id:pat,amount:parseFloat(amt),description:val('bill_desc')})});
  if(r?.success){ toast('Bill created','success'); closeModal('addBillingModal'); clearForm('bill_patient','bill_amount','bill_desc'); loadBilling(); }
}

async function payBill(id){
  const r = await api(`/billing/${id}/pay`,{method:'PUT'});
  if(r?.success){ toast('Bill marked as paid','success'); loadBilling(); }
}

async function deleteBill(id){
  if(!confirm('Delete this bill?')) return;
  await api(`/billing/${id}`,{method:'DELETE'});
  toast('Bill deleted','info'); loadBilling();
}

/* ============================================================
   AUDIT LOG
============================================================ */
async function loadAudit(){
  const t = document.getElementById('auditTableFilter')?.value||'';
  const r = await api(`/audit?table=${t}`);
  if(!r?.success) return;
  const tbody = document.getElementById('auditBody');
  if(!r.data.length){
    tbody.innerHTML=`<tr><td colspan="6" class="table-empty">No audit entries</td></tr>`; return;
  }
  const actionColors = {SELECT:'bi',INSERT:'bg',UPDATE:'bw',DELETE:'br'};
  tbody.innerHTML = r.data.map(l=>`<tr>
    <td><code style="font-family:var(--fm);font-size:12px;color:var(--purple)">${esc(l.table_name)}</code></td>
    <td><span class="badge ${actionColors[l.action]||'bx'}">${esc(l.action)}</span></td>
    <td class="td-mono" style="font-size:11px;color:var(--text3)">${esc(String(l.record_id||'').substring(0,13))}…</td>
    <td class="td-muted">${esc(l.performed_by||'admin')}</td>
    <td class="td-mono" style="font-size:11px">${fmtDt(l.performed_at)}</td>
    <td class="td-muted" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(l.details||'—')}</td>
  </tr>`).join('');
}

/* ============================================================
   UTILITIES
============================================================ */
function esc(s){
  if(s==null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtDt(dt){
  if(!dt) return '—';
  try{ return new Date(dt).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}); }
  catch(e){ return dt; }
}
function fmtTime(dt){
  if(!dt) return '—';
  try{ return new Date(dt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}); }
  catch(e){ return dt; }
}

function statusBadge(s){
  const m={
    'Scheduled':'bi','Completed':'bg','Cancelled':'bx','No-Show':'bw',
    'Waiting':'bw','In Treatment':'br','Admitted':'bi','Discharged':'bg',
    'Pending':'bw','Active':'bg','Unpaid':'bw','Paid':'bg','Waived':'bx'
  };
  return `<span class="badge ${m[s]||'bx'}">${esc(s)}</span>`;
}
function billStatusBadge(s){
  const m={Unpaid:'bw',Paid:'bg',Waived:'bx'};
  return `<span class="badge ${m[s]||'bx'}">${esc(s)}</span>`;
}
function triageLabel(l){
  return ['','Critical','Emergent','Urgent','Less Urgent','Non-Urgent'][l]||'—';
}

function val(id){ const el=document.getElementById(id); return el?el.value:''; }
function setVal(id,v){ const el=document.getElementById(id); if(el) el.value=v; }
function setText(id,v){ const el=document.getElementById(id); if(el) el.textContent=v; }
function clearForm(...ids){ ids.forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; }); }

function renderPagination(containerId, currentPage, totalPages, onPage){
  const el = document.getElementById(containerId);
  if(!el||totalPages<=1){ if(el) el.innerHTML=''; return; }
  let html = `<button class="page-btn" ${currentPage===1?'disabled':''} onclick="(${onPage})(${currentPage-1})">‹</button>`;
  for(let i=1;i<=totalPages;i++){
    if(i===1||i===totalPages||Math.abs(i-currentPage)<=1){
      html+=`<button class="page-btn ${i===currentPage?'active':''}" onclick="(${onPage})(${i})">${i}</button>`;
    } else if(Math.abs(i-currentPage)===2){
      html+='<span class="page-info">…</span>';
    }
  }
  html+=`<button class="page-btn" ${currentPage===totalPages?'disabled':''} onclick="(${onPage})(${currentPage+1})">›</button>`;
  html+=`<span class="page-info">Page ${currentPage} of ${totalPages}</span>`;
  el.innerHTML = html;
}
