# Hospital Management System (HMS)

A comprehensive web-based Hospital Management System built with Flask and MySQL. This application manages patients, doctors, appointments, emergency cases, lab tests, medical records, admissions, departments, beds, and billing.

## Prerequisites

Before you start, ensure you have the following installed:

1. **XAMPP** (for Apache & MySQL)
   - Download from: https://www.apachefriends.org/
   - Version: 7.4+ recommended
   
2. **Python** 
   - Version: 3.8 or higher
   - Download from: https://www.python.org/

3. **Git** (optional, for cloning)
   - Download from: https://git-scm.com/

## XAMPP Setup

### 1. Install XAMPP

1. Download and install XAMPP from the official website
2. Choose installation location (default is fine)
3. During installation, select:
   - Apache
   - MySQL
   - PHP (optional)

### 2. Start XAMPP Services

1. Open **XAMPP Control Panel**
2. Click **Start** next to:
   - **Apache** (if using web server)
   - **MySQL** (required)

   > ✓ Both should show green indicators when running

### 3. Create Database

1. Open **phpMyAdmin**: http://localhost/phpmyadmin
2. Create a new database:
   - Click **New** in the left panel
   - Database name: `hospital_mgmt`
   - Collation: `utf8mb4_unicode_ci`
   - Click **Create**

3. Import the SQL schema:
   - Select the `hospital_mgmt` database
   - Click **Import** tab
   - Choose `hospital.sql` from the project folder
   - Click **Go** to execute

### 4. Verify Database Connection

In **phpMyAdmin**, you should see these tables:
- Patients
- Doctors
- Departments
- Beds
- Admissions
- Appointments
- Emergency_Cases
- Lab_Tests
- Medical_Records
- Billing
- Audit_Log
- Views (v_bed_occupancy, etc.)

## Project Setup

### 1. Clone or Extract Project

```bash
# If using Git
git clone <repository-url>
cd hospital_mgmt

# Or simply extract the project folder
```

### 2. Install Python Dependencies

Navigate to the project directory and install required packages:

```bash
# Using pip
pip install -r requirements.txt

# Or install individual packages
pip install flask==3.0.3
pip install flask-cors==4.0.1
pip install mysql-connector-python==8.4.0
```

### 3. Verify Requirements

Check that all packages are installed:

```bash
pip list
```

Expected packages:
- Flask 3.0.3
- Flask-CORS 4.0.1
- mysql-connector-python 8.4.0

## Running the Application

### 1. Ensure MySQL is Running

Keep the XAMPP Control Panel open with MySQL running.

### 2. Start the Flask Server

From the project directory:

```bash
# Run with Python
python app.py
```

You should see:
```
===========================
  MediCore HMS  |  http://localhost:5000
  Ensure XAMPP MySQL is active on port 3306
===========================
```

### 3. Access the Application

Open your browser and navigate to:
```
http://localhost:5000
```

## Project Structure

```
hospital_mgmt/
├── app.py                 # Main Flask application
├── requirements.txt       # Python dependencies
├── hospital.sql           # Database schema
├── README.md             # This file
├── static/
│   ├── css/
│   │   └── style.css     # Styling
│   └── js/
│       └── app.js        # Frontend JavaScript
└── templates/
    └── index.html        # Main HTML template
```

## Database Configuration

The application uses these default MySQL credentials:

```python
DB_CONFIG = {
    'host': 'localhost',
    'port': 3306,
    'user': 'root',
    'password': '',          # Default XAMPP MySQL password (empty)
    'database': 'hospital_mgmt',
    'charset': 'utf8mb4'
}
```

### To Change Credentials:

1. Edit `app.py` (lines 18-23)
2. Update the `DB_CONFIG` dictionary with your credentials:

```python
DB_CONFIG = {
    'host': 'localhost',
    'port': 3306,
    'user': 'your_mysql_user',
    'password': 'your_password',
    'database': 'hospital_mgmt',
    'charset': 'utf8mb4'
}
```

## API Endpoints

### Dashboard
- `GET /api/dashboard` - Get all dashboard statistics

### Patients
- `GET /api/patients` - List all patients (with pagination & search)
- `GET /api/patients/<pid>` - Get patient details
- `POST /api/patients` - Add new patient
- `PUT /api/patients/<pid>` - Update patient
- `DELETE /api/patients/<pid>` - Delete patient

### Doctors
- `GET /api/doctors` - List all doctors
- `POST /api/doctors` - Add new doctor
- `PUT /api/doctors/<did>` - Update doctor
- `DELETE /api/doctors/<did>` - Delete doctor

### Departments
- `GET /api/departments` - List all departments
- `POST /api/departments` - Add department
- `PUT /api/departments/<dept_id>` - Update department
- `DELETE /api/departments/<dept_id>` - Delete department

### Beds
- `GET /api/beds` - List all beds (filter by type/occupancy)
- `POST /api/beds` - Add new bed
- `DELETE /api/beds/<bid>` - Delete bed

### Admissions
- `GET /api/admissions` - List admissions (filter by status)
- `POST /api/admissions` - Admit patient
- `PUT /api/admissions/<aid>/discharge` - Discharge patient

### Appointments
- `GET /api/appointments` - List appointments (filter by date/status/doctor)
- `POST /api/appointments` - Book appointment
- `PUT /api/appointments/<aid>/status` - Update appointment status
- `DELETE /api/appointments/<aid>` - Cancel appointment

### Emergency Cases
- `GET /api/emergency` - List emergency cases
- `POST /api/emergency` - Add emergency case
- `PUT /api/emergency/<eid>/status` - Update emergency status
- `DELETE /api/emergency/<eid>` - Delete emergency case

### Lab Tests
- `GET /api/labtests` - List lab tests (filter by patient/status)
- `POST /api/labtests` - Add lab test
- `PUT /api/labtests/<tid>` - Update lab test result
- `DELETE /api/labtests/<tid>` - Delete lab test

### Medical Records
- `GET /api/records` - List medical records (filter by patient)
- `POST /api/records` - Add medical record
- `PUT /api/records/<rid>` - Update medical record
- `DELETE /api/records/<rid>` - Delete medical record

### Billing
- `GET /api/billing` - List bills (filter by patient)
- `POST /api/billing` - Create bill
- `PUT /api/billing/<bid>/pay` - Mark bill as paid
- `DELETE /api/billing/<bid>` - Delete bill

### Audit Log
- `GET /api/audit` - View audit logs (filter by table)

## Troubleshooting

### Issue: "Import flask could not be resolved"
**Solution**: Install Python packages
```bash
pip install -r requirements.txt
```

### Issue: "MySQL connection refused"
**Solution**: 
1. Ensure XAMPP MySQL is running (green indicator)
2. Check MySQL is listening on port 3306
3. Verify credentials in `app.py`

### Issue: "No module named 'mysql.connector'"
**Solution**: Install MySQL connector
```bash
pip install mysql-connector-python==8.4.0
```

### Issue: "Database not found"
**Solution**:
1. Verify database exists in phpMyAdmin
2. Re-import `hospital.sql` file
3. Check `DB_CONFIG` in `app.py`

### Issue: CORS errors in browser
**Solution**: Flask-CORS is already enabled. If still having issues:
1. Clear browser cache (Ctrl+Shift+Delete)
2. Restart Flask server
3. Restart browser

## Development Tips

### Enable Debug Mode
Already enabled in `app.py`. Server auto-reloads on code changes.

### Check Logs
Errors appear in the terminal where Flask is running.

### Database Backup
To backup the database:
1. In phpMyAdmin, select `hospital_mgmt` database
2. Click **Export**
3. Choose format: `SQL`
4. Click **Go**

## Features

✓ Patient Management - Register and manage patient information
✓ Doctor Management - Manage doctors and their specializations
✓ Appointment Scheduling - Book and track appointments
✓ Emergency Triage - Handle emergency cases with priority levels
✓ Bed Management - Track bed availability and occupancy
✓ Patient Admissions - Manage hospital admissions and discharges
✓ Lab Tests - Order and track lab test results
✓ Medical Records - Maintain patient medical history
✓ Billing System - Generate and track patient bills
✓ Audit Logging - Track all system changes
✓ Department Management - Organize doctors by departments
✓ Dashboard Analytics - View key hospital metrics

## Default MySQL Credentials (XAMPP)

- **Username**: root
- **Password**: (empty/blank)
- **Host**: localhost
- **Port**: 3306

## Support

For issues or questions:
1. Check the Troubleshooting section above
2. Verify XAMPP MySQL is running
3. Review error messages in Flask terminal
4. Check database connection in phpMyAdmin

## License

This project is provided as-is for educational and operational use.

---

**Last Updated**: April 2026
**Compatible with**: Python 3.8+, XAMPP 7.4+
