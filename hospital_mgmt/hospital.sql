CREATE DATABASE IF NOT EXISTS hospital_mgmt
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE hospital_mgmt;

SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- DEPARTMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS Departments (
    dept_id       INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    floor         INT DEFAULT 1,
    head_doctor_id INT,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- DOCTORS
-- ============================================================
CREATE TABLE IF NOT EXISTS Doctors (
    doctor_id       CHAR(36) PRIMARY KEY,
    name            VARCHAR(150) NOT NULL,
    specialization  VARCHAR(100),
    dept_id         INT,
    email           VARCHAR(120) UNIQUE,
    phone           VARCHAR(20),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dept_id) REFERENCES Departments(dept_id) ON DELETE SET NULL
);

-- ============================================================
-- PATIENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS Patients (
    patient_id        CHAR(36) PRIMARY KEY,
    name              VARCHAR(150) NOT NULL,
    dob               DATE,
    blood_group       VARCHAR(5),
    emergency_contact VARCHAR(20),
    email             VARCHAR(120),
    phone             VARCHAR(20),
    address           TEXT,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- BEDS
-- ============================================================
CREATE TABLE IF NOT EXISTS Beds (
    bed_id      INT AUTO_INCREMENT PRIMARY KEY,
    ward        VARCHAR(50),
    bed_number  VARCHAR(20) NOT NULL,
    type        ENUM('General','ICU','Emergency','Private') DEFAULT 'General',
    is_occupied BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- ADMISSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS Admissions (
    admission_id  CHAR(36) PRIMARY KEY,
    patient_id    CHAR(36) NOT NULL,
    bed_id        INT,
    admitted_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    discharged_at TIMESTAMP NULL,
    notes         TEXT,
    FOREIGN KEY (patient_id) REFERENCES Patients(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (bed_id)     REFERENCES Beds(bed_id) ON DELETE SET NULL
);

-- ============================================================
-- APPOINTMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS Appointments (
    appt_id      CHAR(36) PRIMARY KEY,
    patient_id   CHAR(36) NOT NULL,
    doctor_id    CHAR(36) NOT NULL,
    scheduled_at DATETIME NOT NULL,
    status       ENUM('Scheduled','Completed','Cancelled','No-Show') DEFAULT 'Scheduled',
    reason       TEXT,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES Patients(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id)  REFERENCES Doctors(doctor_id)  ON DELETE CASCADE
);

-- ============================================================
-- MEDICAL RECORDS
-- ============================================================
CREATE TABLE IF NOT EXISTS Medical_Records (
    record_id    CHAR(36) PRIMARY KEY,
    patient_id   CHAR(36) NOT NULL,
    doctor_id    CHAR(36) NOT NULL,
    diagnosis    TEXT,
    prescription TEXT,
    notes        TEXT,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES Patients(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id)  REFERENCES Doctors(doctor_id)  ON DELETE CASCADE
);

-- ============================================================
-- EMERGENCY CASES
-- ============================================================
CREATE TABLE IF NOT EXISTS Emergency_Cases (
    emergency_id CHAR(36) PRIMARY KEY,
    patient_id   CHAR(36) NOT NULL,
    triage_level TINYINT CHECK (triage_level BETWEEN 1 AND 5),
    arrival_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status       ENUM('Waiting','In Treatment','Admitted','Discharged') DEFAULT 'Waiting',
    notes        TEXT,
    FOREIGN KEY (patient_id) REFERENCES Patients(patient_id) ON DELETE CASCADE
);

-- ============================================================
-- LAB TESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS Lab_Tests (
    test_id    CHAR(36) PRIMARY KEY,
    patient_id CHAR(36) NOT NULL,
    test_name  VARCHAR(150) NOT NULL,
    result     TEXT,
    tested_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status     ENUM('Pending','Completed','Cancelled') DEFAULT 'Pending',
    FOREIGN KEY (patient_id) REFERENCES Patients(patient_id) ON DELETE CASCADE
);

-- ============================================================
-- BILLING  (NEW)
-- ============================================================
CREATE TABLE IF NOT EXISTS Billing (
    bill_id     CHAR(36) PRIMARY KEY,
    patient_id  CHAR(36) NOT NULL,
    description VARCHAR(255) DEFAULT 'General charges',
    amount      DECIMAL(10,2) NOT NULL,
    status      ENUM('Unpaid','Paid','Waived') DEFAULT 'Unpaid',
    paid_at     TIMESTAMP NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES Patients(patient_id) ON DELETE CASCADE
);

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS Audit_Log (
    log_id       INT AUTO_INCREMENT PRIMARY KEY,
    table_name   VARCHAR(50),
    record_id    VARCHAR(36),
    action       ENUM('SELECT','INSERT','UPDATE','DELETE'),
    performed_by VARCHAR(100) DEFAULT 'admin',
    performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    details      TEXT
);

-- ============================================================
-- PERFORMANCE INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_emergency_triage    ON Emergency_Cases(triage_level, arrival_time);
CREATE INDEX IF NOT EXISTS idx_emergency_status    ON Emergency_Cases(status);
CREATE INDEX IF NOT EXISTS idx_appt_doctor_dt      ON Appointments(doctor_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_appt_patient        ON Appointments(patient_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_appt_status         ON Appointments(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_admissions_patient  ON Admissions(patient_id);
CREATE INDEX IF NOT EXISTS idx_admissions_active   ON Admissions(discharged_at);
CREATE INDEX IF NOT EXISTS idx_beds_avail          ON Beds(is_occupied, type);
CREATE INDEX IF NOT EXISTS idx_records_patient     ON Medical_Records(patient_id, created_at);
CREATE INDEX IF NOT EXISTS idx_lab_patient         ON Lab_Tests(patient_id, tested_at);
CREATE INDEX IF NOT EXISTS idx_lab_status          ON Lab_Tests(status);
CREATE INDEX IF NOT EXISTS idx_billing_patient     ON Billing(patient_id);
CREATE INDEX IF NOT EXISTS idx_billing_status      ON Billing(status);
CREATE INDEX IF NOT EXISTS idx_patients_name       ON Patients(name);
CREATE INDEX IF NOT EXISTS idx_audit_table         ON Audit_Log(table_name, performed_at);

-- ============================================================
-- TRIGGERS
-- ============================================================
DROP TRIGGER IF EXISTS trg_admission_bed_occupy;
DROP TRIGGER IF EXISTS trg_admission_bed_free;

DELIMITER //

-- Auto-occupy bed on admission
CREATE TRIGGER trg_admission_bed_occupy
AFTER INSERT ON Admissions
FOR EACH ROW
BEGIN
    IF NEW.bed_id IS NOT NULL THEN
        UPDATE Beds SET is_occupied = TRUE WHERE bed_id = NEW.bed_id;
    END IF;
END//

-- Free bed on discharge
CREATE TRIGGER trg_admission_bed_free
AFTER UPDATE ON Admissions
FOR EACH ROW
BEGIN
    IF NEW.discharged_at IS NOT NULL AND OLD.discharged_at IS NULL AND NEW.bed_id IS NOT NULL THEN
        UPDATE Beds SET is_occupied = FALSE WHERE bed_id = NEW.bed_id;
    END IF;
END//

DELIMITER ;

-- ============================================================
-- VIEWS
-- ============================================================

-- Bed occupancy summary by type
CREATE OR REPLACE VIEW v_bed_occupancy AS
SELECT
    type,
    COUNT(*)                        AS total_beds,
    SUM(is_occupied)                AS occupied,
    COUNT(*) - SUM(is_occupied)     AS available,
    ROUND(SUM(is_occupied)*100.0/COUNT(*), 1) AS occupancy_pct
FROM Beds
GROUP BY type;

-- Critical emergency queue (triage 1-2)
CREATE OR REPLACE VIEW v_critical_queue AS
SELECT
    e.emergency_id, e.triage_level, e.arrival_time, e.status,
    p.name AS patient_name, p.blood_group,
    b.bed_number, b.type AS bed_type
FROM Emergency_Cases e
JOIN Patients p ON e.patient_id = p.patient_id
LEFT JOIN Admissions a ON a.patient_id = p.patient_id AND a.discharged_at IS NULL
LEFT JOIN Beds b ON a.bed_id = b.bed_id AND b.is_occupied = FALSE AND b.type = 'ICU'
WHERE e.triage_level <= 2
ORDER BY e.arrival_time ASC;

-- Active admissions with full info
CREATE OR REPLACE VIEW v_active_admissions AS
SELECT
    a.admission_id, a.admitted_at, a.notes,
    p.name AS patient_name, p.blood_group, p.phone,
    b.bed_number, b.type AS bed_type, b.ward,
    TIMESTAMPDIFF(HOUR, a.admitted_at, NOW()) AS hours_admitted
FROM Admissions a
JOIN Patients p ON a.patient_id = p.patient_id
LEFT JOIN Beds b ON a.bed_id = b.bed_id
WHERE a.discharged_at IS NULL
ORDER BY a.admitted_at;

-- Unpaid bills summary
CREATE OR REPLACE VIEW v_unpaid_bills AS
SELECT
    b.bill_id, b.description, b.amount, b.created_at,
    p.name AS patient_name, p.phone
FROM Billing b
JOIN Patients p ON b.patient_id = p.patient_id
WHERE b.status = 'Unpaid'
ORDER BY b.created_at;

-- ============================================================
-- SAMPLE DATA
-- ============================================================
INSERT IGNORE INTO Departments (dept_id, name, floor) VALUES
(1,'Emergency',1),(2,'ICU',2),(3,'General Medicine',3),
(4,'Surgery',4),(5,'Pediatrics',3),(6,'Cardiology',5),
(7,'Radiology',2),(8,'Oncology',4);

INSERT IGNORE INTO Doctors (doctor_id,name,specialization,dept_id,email,phone) VALUES
(UUID(),'Dr. Arjun Mehta','Emergency Medicine',1,'arjun.mehta@medicore.in','9876543210'),
(UUID(),'Dr. Priya Sharma','Cardiology',6,'priya.sharma@medicore.in','9876543211'),
(UUID(),'Dr. Ravi Kumar','General Surgery',4,'ravi.kumar@medicore.in','9876543212'),
(UUID(),'Dr. Sneha Patel','Pediatrics',5,'sneha.patel@medicore.in','9876543213'),
(UUID(),'Dr. Anil Gupta','Radiology',7,'anil.gupta@medicore.in','9876543214'),
(UUID(),'Dr. Meena Joshi','ICU / Critical Care',2,'meena.joshi@medicore.in','9876543215');

INSERT IGNORE INTO Beds (ward,bed_number,type,is_occupied) VALUES
('A','A-101','General',FALSE),('A','A-102','General',TRUE),
('A','A-103','General',FALSE),('A','A-104','General',FALSE),
('B','B-201','ICU',FALSE),('B','B-202','ICU',TRUE),
('B','B-203','ICU',FALSE),
('C','C-301','Emergency',FALSE),('C','C-302','Emergency',FALSE),('C','C-303','Emergency',TRUE),
('D','D-401','Private',FALSE),('D','D-402','Private',TRUE),('D','D-403','Private',FALSE);

INSERT IGNORE INTO Patients (patient_id,name,dob,blood_group,emergency_contact,phone,email) VALUES
(UUID(),'Rahul Verma','1985-06-15','O+','9999999001','9888888001','rahul.v@gmail.com'),
(UUID(),'Anita Singh','1992-03-22','A+','9999999002','9888888002','anita.s@gmail.com'),
(UUID(),'Mohammed Ali','1978-11-05','B-','9999999003','9888888003','m.ali@gmail.com'),
(UUID(),'Kavya Reddy','2000-08-30','AB+','9999999004','9888888004','kavya.r@gmail.com'),
(UUID(),'Suresh Nair','1965-01-18','O-','9999999005','9888888005','suresh.n@gmail.com'),
(UUID(),'Pooja Desai','1998-12-10','B+','9999999006','9888888006','pooja.d@gmail.com');

SET FOREIGN_KEY_CHECKS = 1;
