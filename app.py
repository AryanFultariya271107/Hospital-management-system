"""
Hospital Management System - Flask Backend (v2 Improved)
Compatible with XAMPP MySQL on localhost
Run: python app.py
"""

from flask import Flask, request, jsonify, render_template  # type: ignore
from flask_cors import CORS  # type: ignore
import mysql.connector  # type: ignore
from mysql.connector import Error  # type: ignore
import uuid
from datetime import datetime, date
import json

app = Flask(__name__)
CORS(app)

DB_CONFIG = {
    'host': 'localhost', 'port': 3306,
    'user': 'root', 'password': '',
    'database': 'hospital_mgmt', 'charset': 'utf8mb4'
}

# ============================================================
# CORE HELPERS
# ============================================================
def get_db():
    try:
        return mysql.connector.connect(**DB_CONFIG)
    except Error as e:
        print(f"[DB] {e}"); return None

def query(sql, params=None, fetch=True):
    conn = get_db()
    if not conn: return None
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute(sql, params or ())
        if fetch:
            res = cur.fetchall(); cur.close(); conn.close(); return res
        else:
            conn.commit()
            res = {'affected': cur.rowcount, 'last_id': cur.lastrowid}
            cur.close(); conn.close(); return res
    except Error as e:
        print(f"[SQL] {e}"); 
        try: conn.rollback()
        except: pass
        conn.close(); return None

def _ser(obj):
    if isinstance(obj, (datetime, date)): return obj.isoformat()
    if isinstance(obj, bool): return obj
    if obj is None: return None
    # Handle any other non-serializable types by converting to int/string
    try:
        return int(obj) if isinstance(obj, (int, float)) else str(obj)
    except:
        return str(obj)

def rows(data): return json.loads(json.dumps(data or [], default=_ser))
def uid(): return str(uuid.uuid4())
def ok(data=None, code=200, **kw):
    r = {'success': True}
    if data is not None: r['data'] = data
    r.update(kw); return jsonify(r), code
def bad(msg, code=400): return jsonify({'success': False, 'message': msg}), code
def need(d, *f):
    for k in f:
        if not d.get(k): return k
    return None

def audit(table, rid, action, detail='', user='admin'):
    try:
        query("INSERT INTO Audit_Log (table_name,record_id,action,performed_by,details) VALUES (%s,%s,%s,%s,%s)",
              (table, str(rid), action, user, detail), fetch=False)
    except: pass

# ============================================================
# ROOT
# ============================================================
@app.route('/')
def index(): return render_template('index.html')

# ============================================================
# DASHBOARD
# ============================================================
@app.route('/api/dashboard')
def dashboard():
    def cnt(sql, p=None):
        r = query(sql, p); return r[0]['cnt'] if r else 0

    data = {
        'total_patients':     cnt("SELECT COUNT(*) AS cnt FROM Patients"),
        'total_doctors':      cnt("SELECT COUNT(*) AS cnt FROM Doctors"),
        'available_beds':     cnt("SELECT COUNT(*) AS cnt FROM Beds WHERE is_occupied=FALSE"),
        'total_beds':         cnt("SELECT COUNT(*) AS cnt FROM Beds"),
        'active_emergencies': cnt("SELECT COUNT(*) AS cnt FROM Emergency_Cases WHERE status IN ('Waiting','In Treatment')"),
        'today_appointments': cnt("SELECT COUNT(*) AS cnt FROM Appointments WHERE DATE(scheduled_at)=CURDATE() AND status='Scheduled'"),
        'pending_labs':       cnt("SELECT COUNT(*) AS cnt FROM Lab_Tests WHERE status='Pending'"),
        'active_admissions':  cnt("SELECT COUNT(*) AS cnt FROM Admissions WHERE discharged_at IS NULL"),
        'total_departments':  cnt("SELECT COUNT(*) AS cnt FROM Departments"),
        'unpaid_bills':       cnt("SELECT COUNT(*) AS cnt FROM Billing WHERE status='Unpaid'"),
        'bed_occupancy': rows(query("SELECT * FROM v_bed_occupancy")),
        'recent_emergencies': rows(query(
            "SELECT e.emergency_id,e.triage_level,e.status,e.arrival_time,"
            "p.name AS patient_name,p.blood_group "
            "FROM Emergency_Cases e JOIN Patients p ON e.patient_id=p.patient_id "
            "WHERE e.status IN ('Waiting','In Treatment') "
            "ORDER BY e.triage_level,e.arrival_time LIMIT 5")),
        'today_appt_list': rows(query(
            "SELECT a.appt_id,a.scheduled_at,a.status,"
            "p.name AS patient_name,d.name AS doctor_name "
            "FROM Appointments a "
            "JOIN Patients p ON a.patient_id=p.patient_id "
            "JOIN Doctors d ON a.doctor_id=d.doctor_id "
            "WHERE DATE(a.scheduled_at)=CURDATE() AND a.status='Scheduled' "
            "ORDER BY a.scheduled_at LIMIT 6")),
        'weekly_patients': rows(query(
            "SELECT DATE(created_at) AS day, COUNT(*) AS count FROM Patients "
            "WHERE created_at >= DATE_SUB(CURDATE(),INTERVAL 7 DAY) "
            "GROUP BY DATE(created_at) ORDER BY day")),
        'blood_groups': rows(query(
            "SELECT blood_group, COUNT(*) AS count FROM Patients "
            "WHERE blood_group IS NOT NULL GROUP BY blood_group ORDER BY count DESC")),
    }
    return ok(data)

# ============================================================
# PATIENTS
# ============================================================
@app.route('/api/patients')
def get_patients():
    s = request.args.get('search','').strip()
    page  = max(1, int(request.args.get('page', 1)))
    limit = min(100, int(request.args.get('limit', 50)))
    off   = (page-1)*limit
    if s:
        data = rows(query("SELECT * FROM Patients WHERE name LIKE %s OR blood_group=%s OR phone LIKE %s ORDER BY name LIMIT %s OFFSET %s",
                          (f'%{s}%', s, f'%{s}%', limit, off)))
        total = (query("SELECT COUNT(*) AS cnt FROM Patients WHERE name LIKE %s OR blood_group=%s OR phone LIKE %s",
                       (f'%{s}%', s, f'%{s}%')) or [{'cnt':0}])[0]['cnt']
    else:
        data = rows(query("SELECT * FROM Patients ORDER BY created_at DESC LIMIT %s OFFSET %s", (limit, off)))
        total = (query("SELECT COUNT(*) AS cnt FROM Patients") or [{'cnt':0}])[0]['cnt']
    return ok(data, total=total, page=page, pages=max(1,-(-total//limit)))

@app.route('/api/patients/<pid>')
def get_patient(pid):
    r = query("SELECT * FROM Patients WHERE patient_id=%s", (pid,))
    if not r: return bad('Not found', 404)
    return ok(rows(r)[0])

@app.route('/api/patients', methods=['POST'])
def add_patient():
    d = request.json or {}
    m = need(d,'name')
    if m: return bad(f"'{m}' required")
    pid = uid()
    r = query("INSERT INTO Patients (patient_id,name,dob,blood_group,emergency_contact,email,phone,address) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
              (pid, d['name'].strip(), d.get('dob') or None, d.get('blood_group'),
               d.get('emergency_contact'), d.get('email'), d.get('phone'), d.get('address')), fetch=False)
    if not r: return bad('Failed', 500)
    audit('Patients', pid, 'INSERT', f"Registered: {d['name']}")
    return ok(patient_id=pid, code=201)

@app.route('/api/patients/<pid>', methods=['PUT'])
def update_patient(pid):
    d = request.json or {}
    m = need(d,'name')
    if m: return bad(f"'{m}' required")
    query("UPDATE Patients SET name=%s,dob=%s,blood_group=%s,emergency_contact=%s,email=%s,phone=%s,address=%s WHERE patient_id=%s",
          (d['name'].strip(), d.get('dob') or None, d.get('blood_group'),
           d.get('emergency_contact'), d.get('email'), d.get('phone'), d.get('address'), pid), fetch=False)
    audit('Patients', pid, 'UPDATE', f"Updated: {d['name']}")
    return ok()

@app.route('/api/patients/<pid>', methods=['DELETE'])
def delete_patient(pid):
    r = query("SELECT name FROM Patients WHERE patient_id=%s", (pid,))
    if not r: return bad('Not found', 404)
    query("DELETE FROM Patients WHERE patient_id=%s", (pid,), fetch=False)
    audit('Patients', pid, 'DELETE', f"Removed: {r[0]['name']}")
    return ok()

# ============================================================
# DOCTORS
# ============================================================
@app.route('/api/doctors')
def get_doctors():
    data = rows(query("""
        SELECT d.*, dep.name AS dept_name,
        (SELECT COUNT(*) FROM Appointments a WHERE a.doctor_id=d.doctor_id AND DATE(a.scheduled_at)=CURDATE() AND a.status='Scheduled') AS today_appts
        FROM Doctors d LEFT JOIN Departments dep ON d.dept_id=dep.dept_id ORDER BY d.name
    """))
    return ok(data)

@app.route('/api/doctors', methods=['POST'])
def add_doctor():
    d = request.json or {}
    m = need(d,'name'); 
    if m: return bad(f"'{m}' required")
    did = uid()
    query("INSERT INTO Doctors (doctor_id,name,specialization,dept_id,email,phone) VALUES (%s,%s,%s,%s,%s,%s)",
          (did, d['name'].strip(), d.get('specialization'), d.get('dept_id') or None, d.get('email'), d.get('phone')), fetch=False)
    audit('Doctors', did, 'INSERT', d['name'])
    return ok(doctor_id=did, code=201)

@app.route('/api/doctors/<did>', methods=['PUT'])
def update_doctor(did):
    d = request.json or {}
    query("UPDATE Doctors SET name=%s,specialization=%s,dept_id=%s,email=%s,phone=%s WHERE doctor_id=%s",
          (d.get('name','').strip(), d.get('specialization'), d.get('dept_id') or None, d.get('email'), d.get('phone'), did), fetch=False)
    audit('Doctors', did, 'UPDATE', d.get('name',''))
    return ok()

@app.route('/api/doctors/<did>', methods=['DELETE'])
def delete_doctor(did):
    r = query("SELECT name FROM Doctors WHERE doctor_id=%s", (did,))
    if not r: return bad('Not found', 404)
    query("DELETE FROM Doctors WHERE doctor_id=%s", (did,), fetch=False)
    audit('Doctors', did, 'DELETE', r[0]['name'])
    return ok()

# ============================================================
# DEPARTMENTS
# ============================================================
@app.route('/api/departments')
def get_departments():
    data = rows(query("SELECT dep.*, (SELECT COUNT(*) FROM Doctors d WHERE d.dept_id=dep.dept_id) AS doctor_count FROM Departments dep ORDER BY dep.name"))
    return ok(data)

@app.route('/api/departments', methods=['POST'])
def add_department():
    d = request.json or {}
    m = need(d,'name');
    if m: return bad(f"'{m}' required")
    query("INSERT INTO Departments (name,floor) VALUES (%s,%s)", (d['name'].strip(), d.get('floor',1)), fetch=False)
    return ok(code=201)

@app.route('/api/departments/<int:dept_id>', methods=['PUT'])
def update_department(dept_id):
    d = request.json or {}
    query("UPDATE Departments SET name=%s,floor=%s WHERE dept_id=%s", (d.get('name'), d.get('floor',1), dept_id), fetch=False)
    return ok()

@app.route('/api/departments/<int:dept_id>', methods=['DELETE'])
def delete_department(dept_id):
    query("DELETE FROM Departments WHERE dept_id=%s", (dept_id,), fetch=False)
    return ok()

# ============================================================
# BEDS
# ============================================================
@app.route('/api/beds')
def get_beds():
    sql = "SELECT * FROM Beds WHERE 1=1"; p=[]
    t = request.args.get('type','')
    o = request.args.get('occupied','')
    if t: sql+=" AND type=%s"; p.append(t)
    if o!='': sql+=" AND is_occupied=%s"; p.append(o=='true')
    sql+=" ORDER BY ward,bed_number"
    return ok(rows(query(sql,p)))

@app.route('/api/beds', methods=['POST'])
def add_bed():
    d = request.json or {}
    m = need(d,'bed_number');
    if m: return bad(f"'{m}' required")
    query("INSERT INTO Beds (ward,bed_number,type) VALUES (%s,%s,%s)",
          (d.get('ward'), d['bed_number'].strip(), d.get('type','General')), fetch=False)
    return ok(code=201)

@app.route('/api/beds/<int:bid>', methods=['DELETE'])
def delete_bed(bid):
    query("DELETE FROM Beds WHERE bed_id=%s", (bid,), fetch=False); return ok()

# ============================================================
# ADMISSIONS
# ============================================================
@app.route('/api/admissions')
def get_admissions():
    s = request.args.get('status','')
    sql = "SELECT a.*,p.name AS patient_name,p.blood_group,b.bed_number,b.type AS bed_type,b.ward FROM Admissions a JOIN Patients p ON a.patient_id=p.patient_id LEFT JOIN Beds b ON a.bed_id=b.bed_id"
    p = []
    if s=='active':     sql+=" WHERE a.discharged_at IS NULL"
    elif s=='discharged': sql+=" WHERE a.discharged_at IS NOT NULL"
    sql+=" ORDER BY a.admitted_at DESC LIMIT 100"
    return ok(rows(query(sql,p)))

@app.route('/api/admissions', methods=['POST'])
def admit_patient():
    d = request.json or {}
    m = need(d,'patient_id');
    if m: return bad(f"'{m}' required")
    ex = query("SELECT admission_id FROM Admissions WHERE patient_id=%s AND discharged_at IS NULL", (d['patient_id'],))
    if ex: return bad('Patient already admitted', 409)
    aid = uid()
    query("INSERT INTO Admissions (admission_id,patient_id,bed_id,notes) VALUES (%s,%s,%s,%s)",
          (aid, d['patient_id'], d.get('bed_id') or None, d.get('notes')), fetch=False)
    audit('Admissions', aid, 'INSERT', 'Admitted')
    return ok(admission_id=aid, code=201)

@app.route('/api/admissions/<aid>/discharge', methods=['PUT'])
def discharge_patient(aid):
    r = query("SELECT admission_id FROM Admissions WHERE admission_id=%s AND discharged_at IS NULL", (aid,))
    if not r: return bad('Not found or already discharged', 404)
    query("UPDATE Admissions SET discharged_at=NOW() WHERE admission_id=%s", (aid,), fetch=False)
    audit('Admissions', aid, 'UPDATE', 'Discharged')
    return ok()

# ============================================================
# APPOINTMENTS
# ============================================================
@app.route('/api/appointments')
def get_appointments():
    sql = "SELECT a.*,p.name AS patient_name,p.phone AS patient_phone,d.name AS doctor_name,d.specialization FROM Appointments a JOIN Patients p ON a.patient_id=p.patient_id JOIN Doctors d ON a.doctor_id=d.doctor_id WHERE 1=1"
    p = []
    df = request.args.get('date','')
    sf = request.args.get('status','')
    di = request.args.get('doctor_id','')
    if df: sql+=" AND DATE(a.scheduled_at)=%s"; p.append(df)
    if sf: sql+=" AND a.status=%s"; p.append(sf)
    if di: sql+=" AND a.doctor_id=%s"; p.append(di)
    sql+=" ORDER BY a.scheduled_at DESC LIMIT 200"
    return ok(rows(query(sql,p)))

@app.route('/api/appointments', methods=['POST'])
def book_appointment():
    d = request.json or {}
    m = need(d,'patient_id','doctor_id','scheduled_at');
    if m: return bad(f"'{m}' required")
    conflict = query("SELECT appt_id FROM Appointments WHERE doctor_id=%s AND scheduled_at=%s AND status='Scheduled'",
                     (d['doctor_id'], d['scheduled_at']))
    if conflict: return bad('Doctor has appointment at this time', 409)
    aid = uid()
    query("INSERT INTO Appointments (appt_id,patient_id,doctor_id,scheduled_at,reason) VALUES (%s,%s,%s,%s,%s)",
          (aid, d['patient_id'], d['doctor_id'], d['scheduled_at'], d.get('reason')), fetch=False)
    audit('Appointments', aid, 'INSERT')
    return ok(appt_id=aid, code=201)

@app.route('/api/appointments/<aid>/status', methods=['PUT'])
def update_appt_status(aid):
    d = request.json or {}
    valid = ['Scheduled','Completed','Cancelled','No-Show']
    if d.get('status') not in valid: return bad(f"status must be: {', '.join(valid)}")
    query("UPDATE Appointments SET status=%s WHERE appt_id=%s", (d['status'], aid), fetch=False)
    audit('Appointments', aid, 'UPDATE', d['status'])
    return ok()

@app.route('/api/appointments/<aid>', methods=['DELETE'])
def delete_appointment(aid):
    query("DELETE FROM Appointments WHERE appt_id=%s", (aid,), fetch=False); return ok()

# ============================================================
# EMERGENCY
# ============================================================
@app.route('/api/emergency')
def get_emergency():
    s = request.args.get('status','')
    sql = "SELECT e.*,p.name AS patient_name,p.blood_group,p.phone AS patient_phone,p.emergency_contact FROM Emergency_Cases e JOIN Patients p ON e.patient_id=p.patient_id"
    p=[]
    if s: sql+=" WHERE e.status=%s"; p.append(s)
    sql+=" ORDER BY e.triage_level ASC, e.arrival_time ASC"
    return ok(rows(query(sql,p)))

@app.route('/api/emergency', methods=['POST'])
def add_emergency():
    d = request.json or {}
    m = need(d,'patient_id');
    if m: return bad(f"'{m}' required")
    lvl = int(d.get('triage_level',3))
    if not 1<=lvl<=5: return bad('triage_level must be 1–5')
    eid = uid()
    query("INSERT INTO Emergency_Cases (emergency_id,patient_id,triage_level,notes) VALUES (%s,%s,%s,%s)",
          (eid, d['patient_id'], lvl, d.get('notes')), fetch=False)
    audit('Emergency_Cases', eid, 'INSERT', f"Triage L{lvl}")
    return ok(emergency_id=eid, code=201)

@app.route('/api/emergency/<eid>/status', methods=['PUT'])
def update_emergency_status(eid):
    d = request.json or {}
    valid = ['Waiting','In Treatment','Admitted','Discharged']
    if d.get('status') not in valid: return bad(f"status must be: {', '.join(valid)}")
    query("UPDATE Emergency_Cases SET status=%s WHERE emergency_id=%s", (d['status'], eid), fetch=False)
    audit('Emergency_Cases', eid, 'UPDATE', d['status'])
    return ok()

@app.route('/api/emergency/<eid>', methods=['DELETE'])
def delete_emergency(eid):
    query("DELETE FROM Emergency_Cases WHERE emergency_id=%s", (eid,), fetch=False); return ok()

# ============================================================
# LAB TESTS
# ============================================================
@app.route('/api/labtests')
def get_lab_tests():
    s=request.args.get('status',''); pid=request.args.get('patient_id','')
    sql="SELECT l.*,p.name AS patient_name FROM Lab_Tests l JOIN Patients p ON l.patient_id=p.patient_id WHERE 1=1"; p=[]
    if s: sql+=" AND l.status=%s"; p.append(s)
    if pid: sql+=" AND l.patient_id=%s"; p.append(pid)
    sql+=" ORDER BY l.tested_at DESC LIMIT 200"
    return ok(rows(query(sql,p)))

@app.route('/api/labtests', methods=['POST'])
def add_lab_test():
    d = request.json or {}
    m = need(d,'patient_id','test_name');
    if m: return bad(f"'{m}' required")
    tid = uid()
    query("INSERT INTO Lab_Tests (test_id,patient_id,test_name,result,status) VALUES (%s,%s,%s,%s,%s)",
          (tid, d['patient_id'], d['test_name'].strip(), d.get('result',''), d.get('status','Pending')), fetch=False)
    audit('Lab_Tests', tid, 'INSERT', d['test_name'])
    return ok(test_id=tid, code=201)

@app.route('/api/labtests/<tid>', methods=['PUT'])
def update_lab_test(tid):
    d = request.json or {}
    query("UPDATE Lab_Tests SET result=%s,status=%s WHERE test_id=%s", (d.get('result'), d.get('status'), tid), fetch=False)
    audit('Lab_Tests', tid, 'UPDATE', d.get('status',''))
    return ok()

@app.route('/api/labtests/<tid>', methods=['DELETE'])
def delete_lab_test(tid):
    query("DELETE FROM Lab_Tests WHERE test_id=%s", (tid,), fetch=False); return ok()

# ============================================================
# MEDICAL RECORDS
# ============================================================
@app.route('/api/records')
def get_records():
    pid=request.args.get('patient_id','')
    sql="SELECT r.*,p.name AS patient_name,p.blood_group,d.name AS doctor_name,d.specialization FROM Medical_Records r JOIN Patients p ON r.patient_id=p.patient_id JOIN Doctors d ON r.doctor_id=d.doctor_id"
    p=[]
    if pid: sql+=" WHERE r.patient_id=%s"; p.append(pid)
    sql+=" ORDER BY r.created_at DESC LIMIT 100"
    audit('Medical_Records', pid or 'all', 'SELECT', 'Records accessed')
    return ok(rows(query(sql,p)))

@app.route('/api/records', methods=['POST'])
def add_record():
    d = request.json or {}
    m = need(d,'patient_id','doctor_id');
    if m: return bad(f"'{m}' required")
    rid = uid()
    query("INSERT INTO Medical_Records (record_id,patient_id,doctor_id,diagnosis,prescription,notes) VALUES (%s,%s,%s,%s,%s,%s)",
          (rid, d['patient_id'], d['doctor_id'], d.get('diagnosis'), d.get('prescription'), d.get('notes')), fetch=False)
    audit('Medical_Records', rid, 'INSERT')
    return ok(record_id=rid, code=201)

@app.route('/api/records/<rid>', methods=['PUT'])
def update_record(rid):
    d = request.json or {}
    query("UPDATE Medical_Records SET diagnosis=%s,prescription=%s,notes=%s WHERE record_id=%s",
          (d.get('diagnosis'), d.get('prescription'), d.get('notes'), rid), fetch=False)
    audit('Medical_Records', rid, 'UPDATE')
    return ok()

@app.route('/api/records/<rid>', methods=['DELETE'])
def delete_record(rid):
    query("DELETE FROM Medical_Records WHERE record_id=%s", (rid,), fetch=False)
    audit('Medical_Records', rid, 'DELETE')
    return ok()

# ============================================================
# BILLING
# ============================================================
@app.route('/api/billing')
def get_billing():
    pid=request.args.get('patient_id','')
    sql="SELECT b.*,p.name AS patient_name FROM Billing b JOIN Patients p ON b.patient_id=p.patient_id"
    p=[]
    if pid: sql+=" WHERE b.patient_id=%s"; p.append(pid)
    sql+=" ORDER BY b.created_at DESC LIMIT 100"
    return ok(rows(query(sql,p)))

@app.route('/api/billing', methods=['POST'])
def add_billing():
    d = request.json or {}
    m = need(d,'patient_id','amount');
    if m: return bad(f"'{m}' required")
    try: amount = float(d['amount'])
    except: return bad('amount must be a number')
    bid = uid()
    query("INSERT INTO Billing (bill_id,patient_id,description,amount,status) VALUES (%s,%s,%s,%s,%s)",
          (bid, d['patient_id'], d.get('description','General charges'), amount, d.get('status','Unpaid')), fetch=False)
    audit('Billing', bid, 'INSERT', f"₹{amount}")
    return ok(bill_id=bid, code=201)

@app.route('/api/billing/<bid>/pay', methods=['PUT'])
def pay_bill(bid):
    query("UPDATE Billing SET status='Paid',paid_at=NOW() WHERE bill_id=%s", (bid,), fetch=False)
    audit('Billing', bid, 'UPDATE', 'Paid')
    return ok()

@app.route('/api/billing/<bid>', methods=['DELETE'])
def delete_bill(bid):
    query("DELETE FROM Billing WHERE bill_id=%s", (bid,), fetch=False); return ok()

# ============================================================
# AUDIT
# ============================================================
@app.route('/api/audit')
def get_audit():
    t=request.args.get('table','')
    sql="SELECT * FROM Audit_Log"; p=[]
    if t: sql+=" WHERE table_name=%s"; p.append(t)
    sql+=" ORDER BY performed_at DESC LIMIT 500"
    return ok(rows(query(sql,p)))

# ============================================================
# RUN
# ============================================================
if __name__ == '__main__':
    print("="*55)
    print("  MediCore HMS  |  http://localhost:5000")
    print("  Ensure XAMPP MySQL is active on port 3306")
    print("="*55)
    app.run(debug=True, host='0.0.0.0', port=5000)
