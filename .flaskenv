FLASK_APP=app.py
FLASK_ENV=development
SECRET_KEY='a-very-secret-key-that-should-be-changed'
# Using SQLite for simplicity in this environment.
# The original 'mysql+mysqlclient://user:password@host/dbname' can be used in production.
DATABASE_URL='sqlite:///app.db'
