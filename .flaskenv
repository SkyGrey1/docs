# Flask App Configuration
FLASK_APP=app.py
FLASK_DEBUG=1

# Secret Key
SECRET_KEY='change-this-in-production'

# Database URL for SQLite (for development in sandbox)
# For production, use the MySQL URL format: mysql+mysqlclient://user:password@host/dbname
DATABASE_URL='sqlite:///app.db'

# Email Configuration (for notifications)
# Replace with your own SMTP server details
MAIL_SERVER=smtp.googlemail.com
MAIL_PORT=587
MAIL_USE_TLS=1
MAIL_USERNAME='your-email@example.com'
MAIL_PASSWORD='your-email-password'
